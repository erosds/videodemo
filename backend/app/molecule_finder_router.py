"""FastAPI router for the MoleculeFinder workflow.

Property prediction (/available-datasets, /train) performs real RandomForest
training on public molecular datasets via training_service.py.

Optimisation endpoints:
  /optimize-2obj  — logP (Crippen, RDKit) + MW minimisation. No external model.
  /optimize-3obj  — logP + MW + P(sweet) from FartDB RF. Requires FartDB training.

/regulatory-check — Look up FEMA GRAS + EU 1334/2008 status for a list of compounds.
"""
from __future__ import annotations

import asyncio

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel

from app.molecule_finder.candidate_pool  import get_candidates, get_pool_meta
from app.molecule_finder.molecular_utils import compute_properties, validate_smiles, ecfp4_bits
from app.molecule_finder               import training_service
from app.molecule_finder.training_service import DATASETS
from app.molecule_finder.food_case_data  import REFERENCE_COMPOUND
from app.molecule_finder.nsga2_optimizer import run_nsga2_generative
from app.molecule_finder.food_regulatory_data import get_status_for_compound

router = APIRouter()


# ── Pydantic request/response models ─────────────────────────────────────────

class ValidateSmilesRequest(BaseModel):
    smiles: str


class FingerprintRequest(BaseModel):
    smiles: str


class TrainRequest(BaseModel):
    dataset_id: str


class RegulatoryCompound(BaseModel):
    cid: int | None = None
    name: str | None = None
    smiles: str | None = None


class RegulatoryCheckRequest(BaseModel):
    compounds: list[RegulatoryCompound]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _pubchem_lookup_inchikey(inchikey: str) -> dict | None:
    """Return {cid, name} from PubChem for a given InChIKey, or None on miss."""
    url = (
        f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/inchikey"
        f"/{inchikey}/property/IUPACName,MolecularFormula/JSON"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url)
        if r.status_code != 200:
            return None
        data = r.json()
        props = data.get("PropertyTable", {}).get("Properties", [])
        if not props:
            return None
        p = props[0]
        return {"cid": int(p["CID"]), "name": p.get("IUPACName", "Unknown")}
    except Exception:
        return None


async def _enrich_pareto_with_pubchem(pareto: list[dict]) -> list[dict]:
    """For generated compounds (cid=None), attempt PubChem InChIKey lookup."""
    if not training_service.RDKIT_OK:
        return pareto

    from rdkit import Chem
    from rdkit.Chem.inchi import MolToInchi, InchiToInchiKey

    enriched = []
    tasks = []
    indices_to_lookup: list[int] = []

    for i, c in enumerate(pareto):
        if c.get("cid") is None and c.get("smiles"):
            try:
                mol = Chem.MolFromSmiles(c["smiles"])
                if mol:
                    inchi = MolToInchi(mol)
                    if inchi:
                        inchikey = InchiToInchiKey(inchi)
                        tasks.append(_pubchem_lookup_inchikey(inchikey))
                        indices_to_lookup.append(i)
                        continue
            except Exception:
                pass
        enriched_c = dict(c)
        enriched.append((i, enriched_c))

    # Run all PubChem lookups concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Map lookup results back
    lookup_map: dict[int, dict | None] = {}
    for k, idx in enumerate(indices_to_lookup):
        res = results[k]
        lookup_map[idx] = res if isinstance(res, dict) else None

    # Build final list preserving order
    all_entries: list[tuple[int, dict]] = list(enriched)
    for k, idx in enumerate(indices_to_lookup):
        c = dict(pareto[idx])
        hit = lookup_map[idx]
        if hit:
            c["cid"] = hit["cid"]
            c["name"] = hit["name"]
            c["pubchem_verified"] = True
        else:
            c["pubchem_verified"] = False
        all_entries.append((idx, c))

    all_entries.sort(key=lambda x: x[0])
    return [c for _, c in all_entries]


def _build_name_lookup(candidates: list[dict]) -> dict[str, dict]:
    """Build {canonical_smiles: {name, cid}} from pool candidates."""
    from rdkit import Chem
    lookup: dict[str, dict] = {}
    for c in candidates:
        mol = Chem.MolFromSmiles(c["smiles"])
        if mol:
            canon = Chem.MolToSmiles(mol, canonical=True)
            lookup[canon] = {"name": c["name"], "cid": c.get("cid")}
    return lookup


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "molecule-finder"}


@router.get("/candidates/meta")
def candidates_meta():
    """Return metadata about the pre-built PubChem aromatic compound pool."""
    try:
        meta = get_pool_meta()
        return meta
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/fingerprint")
def compute_fingerprint(req: FingerprintRequest):
    """Compute ECFP4 2048-bit fingerprint from a SMILES string."""
    bits = ecfp4_bits(req.smiles)
    if bits is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")
    return {"bits": bits, "n_bits": len(bits), "set_bits": int(sum(bits))}


@router.get("/structure/{cid}")
async def get_structure_image(cid: int):
    """Proxy PubChem 2D structure PNG to avoid browser network/CORS issues."""
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="Structure not found on PubChem")
        return Response(content=r.content, media_type="image/png")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach PubChem")


@router.post("/validate-smiles")
def validate_smiles_endpoint(request: ValidateSmilesRequest):
    """Validate a SMILES string and return basic molecular properties."""
    is_valid = validate_smiles(request.smiles)
    props = compute_properties(request.smiles) if is_valid else {}
    return {"valid": is_valid, "properties": props}


# ── Property prediction — real training ───────────────────────────────────────

@router.get("/available-datasets")
def available_datasets():
    """Return metadata for all available training datasets."""
    safe_keys = {"id", "name", "subtitle", "tag", "description", "task_type",
                 "target_label", "n_molecules", "max_samples", "domain", "color", "model_role"}
    result = []
    for cfg in DATASETS.values():
        d = {k: v for k, v in cfg.items() if k in safe_keys}
        cached_n = training_service.get_cached_count(cfg["id"])
        if cached_n is not None:
            max_s = cfg.get("max_samples")
            d["n_cached"] = min(cached_n, max_s) if max_s else cached_n
        result.append(d)
    return result


@router.post("/train")
async def train_endpoint(request: TrainRequest):
    """Download (or load cached) dataset and train a RandomForest predictor."""
    if request.dataset_id not in DATASETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown dataset: {request.dataset_id!r}. "
                   f"Valid options: {list(DATASETS.keys())}",
        )
    try:
        result = await run_in_threadpool(training_service.train_model, request.dataset_id)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Optimisation endpoints — PubChem pool ─────────────────────────────────────

@router.post("/optimize-2obj")
async def optimize_2obj():
    """2-objective NSGA-II on the PubChem aromatic pool.

    Objectives (all computed by RDKit — no external model needed):
      Obj-1: maximise logP  (Crippen method, lipophilicity proxy)
      Obj-2: minimise MW    (exact molecular weight)

    Response shape:
    {
      "pool_meta":        { n_candidates, source, seeds, threshold },
      "property_range":   { logP_min, logP_max, mw_min, mw_max },
      "reference":        { name, smiles, logP, mw },
      "generations":      [ { gen, n_new, n_evaluated, candidates: [...] }, ... ],
      "pareto_final":     [...]
    }
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")

        candidates_raw = get_candidates()
        pool_meta = get_pool_meta()

        from rdkit import Chem
        valid_pool: list[dict] = []
        for c in candidates_raw:
            mol = Chem.MolFromSmiles(c["smiles"])
            if mol is not None:
                valid_pool.append(c)

        if len(valid_pool) < 10:
            raise RuntimeError("Too few valid compounds in the pool.")

        name_lookup = _build_name_lookup(valid_pool)

        # Reference compound properties
        ref_logP = training_service.get_logP(REFERENCE_COMPOUND["smiles"])
        ref_mw   = training_service.get_mw(REFERENCE_COMPOUND["smiles"])

        # Run generative 2-objective NSGA-II (no taste_fn)
        generations = run_nsga2_generative(
            initial_pool=valid_pool,
            logP_fn=training_service.get_logP,
            mw_fn=training_service.get_mw,
            name_lookup=name_lookup,
            taste_fn=None,
            n_generations=10,
            pop_size=100,
            seed=42,
        )

        gen0_cands = generations[0]["candidates"]
        all_logP = [c["logP"] for c in gen0_cands]
        all_mw   = [c["mw"]   for c in gen0_cands]

        final_gen    = generations[-1]["candidates"]
        pareto_final = sorted(
            [c for c in final_gen if not c["dominated"]],
            key=lambda c: -c["logP"],
        )
        n_total_evaluated = generations[-1]["n_evaluated"]

        return {
            "pool_meta": {
                "n_candidates": pool_meta["n_candidates"],
                "source": pool_meta["source"],
                "seeds": pool_meta["seeds"],
                "threshold": pool_meta["threshold"],
            },
            "model_meta": {
                "logP_method": "Crippen (RDKit) — no external dataset",
                "mw_method":   "RDKit ExactMolWt",
                "n_evaluated": n_total_evaluated,
            },
            "property_range": {
                "logP_min": round(min(all_logP), 2),
                "logP_max": round(max(all_logP), 2),
                "mw_min":   round(min(all_mw), 1),
                "mw_max":   round(max(all_mw), 1),
            },
            "reference": {
                "name":   REFERENCE_COMPOUND["name"],
                "smiles": REFERENCE_COMPOUND["smiles"],
                "cas":    REFERENCE_COMPOUND["cas"],
                "logP":   round(ref_logP, 3) if ref_logP is not None else None,
                "mw":     round(ref_mw, 1) if ref_mw is not None else None,
            },
            "generations":  generations,
            "pareto_final": pareto_final,
        }

    try:
        result = await run_in_threadpool(_run)
        # Post-hoc: enrich generated compounds on the Pareto front with PubChem IDs
        result["pareto_final"] = await _enrich_pareto_with_pubchem(result["pareto_final"])
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/optimize-3obj")
async def optimize_3obj():
    """3-objective NSGA-II: logP ↑, MW ↓, P(sweet) ↑.

    P(sweet) is predicted by the FartDB taste classifier (RandomForest).
    Requires the FartDB model to be trained via /train first.

    Also applies a structural purity filter: excludes compounds with heavy
    halogens (F, Cl, Br, I) or metal atoms.

    Response shape:
    {
      "pool_meta":        { n_candidates, n_after_filter, n_excluded, ... },
      "model_meta":       { dataset, oob_accuracy, n_train, n_evaluated },
      "property_range":   { logP_min, logP_max, mw_min, mw_max },
      "reference":        { name, smiles, logP, mw, psweet },
      "generations":      [ { gen, n_new, n_evaluated, candidates: [...] }, ... ],
      "pareto_final":     [...]
    }
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")

        if "flavor_sensory" not in training_service._RF_MODEL_CACHE:
            raise ValueError(
                "FartDB taste model not trained yet. "
                "Go to the Property Prediction tab, select 'FartDB Taste', and click Train Model first."
            )
        rf_taste   = training_service._RF_MODEL_CACHE["flavor_sensory"]
        taste_cfg  = DATASETS["flavor_sensory"]
        oob_acc    = round(float(rf_taste.oob_score_), 3)

        candidates_raw = get_candidates()
        pool_meta = get_pool_meta()
        n_total = len(candidates_raw)

        # Structural purity filter: no heavy halogens, no metals
        from rdkit import Chem
        HEAVY_HALOGENS = {9, 17, 35, 53}
        METAL_NUMS = {
            3, 4, 11, 12, 13, 19, 20, 21, 22, 23, 24, 25,
            26, 27, 28, 29, 30, 31, 37, 38, 39, 40, 41, 42,
            44, 45, 46, 47, 48, 49, 50, 55, 56, 57, 72, 73,
            74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
        }

        def is_pure_aromatic(smiles: str) -> bool:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return False
            for atom in mol.GetAtoms():
                an = atom.GetAtomicNum()
                if an in HEAVY_HALOGENS or an in METAL_NUMS:
                    return False
            return True

        filtered = [c for c in candidates_raw if is_pure_aromatic(c["smiles"])]
        n_excluded = n_total - len(filtered)

        if len(filtered) < 10:
            raise RuntimeError("Too few valid compounds after structural filter.")

        name_lookup = _build_name_lookup(filtered)

        # Reference compound properties
        ref_logP   = training_service.get_logP(REFERENCE_COMPOUND["smiles"])
        ref_mw     = training_service.get_mw(REFERENCE_COMPOUND["smiles"])
        ref_psweet = training_service.predict_taste_sweet(REFERENCE_COMPOUND["smiles"])

        # Run generative 3-objective NSGA-II
        generations = run_nsga2_generative(
            initial_pool=filtered,
            logP_fn=training_service.get_logP,
            mw_fn=training_service.get_mw,
            name_lookup=name_lookup,
            taste_fn=training_service.predict_taste_sweet,
            n_generations=10,
            pop_size=100,
            seed=42,
        )

        gen0_cands = generations[0]["candidates"]
        all_logP = [c["logP"] for c in gen0_cands]
        all_mw   = [c["mw"]   for c in gen0_cands]

        final_gen    = generations[-1]["candidates"]
        pareto_final = sorted(
            [c for c in final_gen if not c["dominated"]],
            key=lambda c: -(c.get("psweet") or 0.5),
        )
        n_total_evaluated = generations[-1]["n_evaluated"]

        return {
            "pool_meta": {
                "n_candidates":  pool_meta["n_candidates"],
                "n_after_filter": len(filtered),
                "n_excluded":    n_excluded,
                "source":        pool_meta["source"],
                "seeds":         pool_meta["seeds"],
                "threshold":     pool_meta["threshold"],
            },
            "model_meta": {
                "dataset":      taste_cfg["name"],
                "oob_accuracy": oob_acc,
                "n_train":      len(filtered),
                "target":       taste_cfg["target_label"],
                "n_evaluated":  n_total_evaluated,
                "logP_method":  "Crippen (RDKit) — no external dataset",
                "mw_method":    "RDKit ExactMolWt",
            },
            "property_range": {
                "logP_min": round(min(all_logP), 2),
                "logP_max": round(max(all_logP), 2),
                "mw_min":   round(min(all_mw), 1),
                "mw_max":   round(max(all_mw), 1),
            },
            "reference": {
                "name":   REFERENCE_COMPOUND["name"],
                "smiles": REFERENCE_COMPOUND["smiles"],
                "cas":    REFERENCE_COMPOUND["cas"],
                "logP":   round(ref_logP, 3) if ref_logP is not None else None,
                "mw":     round(ref_mw, 1) if ref_mw is not None else None,
                "psweet": round(ref_psweet, 3) if ref_psweet is not None else None,
            },
            "generations":  generations,
            "pareto_final": pareto_final,
        }

    try:
        result = await run_in_threadpool(_run)
        # Post-hoc: enrich generated compounds on the Pareto front with PubChem IDs
        result["pareto_final"] = await _enrich_pareto_with_pubchem(result["pareto_final"])
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Regulatory check ──────────────────────────────────────────────────────────

@router.post("/regulatory-check")
async def regulatory_check(request: RegulatoryCheckRequest):
    """Look up FEMA GRAS + EU 1334/2008 regulatory status for a list of compounds.

    Accepts up to 200 compounds (identified by CID and/or name).
    Returns one status record per compound.
    """
    if len(request.compounds) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 compounds per request.")

    results = []
    for comp in request.compounds:
        status = get_status_for_compound(cid=comp.cid, name=comp.name)
        results.append({
            "cid":         comp.cid,
            "name":        comp.name,
            "smiles":      comp.smiles,
            "status":      status["status"],
            "fema":        status.get("fema"),
            "eu_fl":       status.get("eu_fl"),
            "max_use_ppm": status.get("max_use_ppm"),
            "restriction": status.get("restriction"),
        })

    return {"results": results, "n_approved": sum(1 for r in results if r["status"] == "approved"),
            "n_restricted": sum(1 for r in results if r["status"] == "restricted"),
            "n_banned": sum(1 for r in results if r["status"] == "banned"),
            "n_not_evaluated": sum(1 for r in results if r["status"] == "not_evaluated")}
