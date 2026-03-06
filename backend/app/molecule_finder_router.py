"""FastAPI router for the MoleculeFinder workflow.

Property prediction (/available-datasets, /train) performs real RandomForest
training on public molecular datasets via training_service.py.

Optimisation endpoints:
  /optimize-2obj  — logD (ChEMBL RF, pH 7.4) + MW minimisation. Requires lipophilicity training.
  /optimize-3obj  — logD + MW + P(sweet) from FartDB RF. Requires both models trained.

/regulatory-check — Look up FEMA GRAS + EU 1334/2008 status for a list of compounds.
"""
from __future__ import annotations

import asyncio
import json
import threading

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.molecule_finder.candidate_pool  import get_candidates, get_pool_meta
from app.molecule_finder.molecular_utils import compute_properties, validate_smiles, ecfp4_bits
from app.molecule_finder               import training_service
from app.molecule_finder.training_service import DATASETS
from app.molecule_finder.food_case_data  import REFERENCE_COMPOUND
from app.molecule_finder.nsga2_optimizer import run_nsga2_generative, iter_nsga2_generative
from app.molecule_finder.food_regulatory_data import get_status_for_compound

router = APIRouter()

# Load any previously persisted models into memory when this module is imported
# (i.e., when uvicorn starts the FastAPI app).
training_service.load_saved_models()

# ── Optimization results cache ─────────────────────────────────────────────────
# Persists the final state of 2-obj and 3-obj optimization runs across restarts.

_OPT_CACHE_FILE = training_service.CACHE_DIR / "optimization_results.json"
_OPT_RESULTS: dict[str, dict] = {}


def _load_opt_cache() -> None:
    global _OPT_RESULTS
    if _OPT_CACHE_FILE.exists():
        try:
            with open(_OPT_CACHE_FILE) as f:
                _OPT_RESULTS = json.load(f)
        except Exception:
            _OPT_RESULTS = {}


def _save_opt_cache() -> None:
    try:
        training_service.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(_OPT_CACHE_FILE, "w") as f:
            json.dump(_OPT_RESULTS, f)
    except Exception:
        pass


_load_opt_cache()


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


def _enrich_pareto_with_mol_props(pareto: list[dict]) -> list[dict]:
    """Add QED, SA score, PAINS flags, and Murcko scaffold to each Pareto candidate."""
    if not training_service.RDKIT_OK:
        return pareto
    for c in pareto:
        smiles = c.get("smiles")
        if not smiles:
            continue
        c["qed"]      = training_service.compute_qed(smiles)
        c["sa_score"] = training_service.compute_sa_score(smiles)
        c["pains"]    = training_service.check_pains(smiles)
        c["scaffold"] = training_service.get_murcko_scaffold(smiles)
    return pareto


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


@router.get("/saved-models")
def saved_models_endpoint():
    """Return results metadata for all models previously persisted to disk."""
    return {"models": training_service.get_saved_results()}


@router.delete("/saved-models")
def clear_saved_models_endpoint():
    """Delete all persisted model files and clear the in-memory model cache."""
    training_service.clear_saved_models()
    return {"ok": True}


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


def _rename_2obj(candidates: list[dict]) -> list[dict]:
    """Rename optimizer key 'logD' → 'psweet' for the 2-obj sweetness run."""
    for c in candidates:
        if "logD" in c:
            c["psweet"] = c.pop("logD")
    return candidates


def _rename_3obj(candidates: list[dict]) -> list[dict]:
    """Rename optimizer keys for the 3-obj run: 'psweet'→'psafe', 'logD'→'psweet'."""
    for c in candidates:
        if "psweet" in c:
            c["psafe"] = c.pop("psweet")
        if "logD" in c:
            c["psweet"] = c.pop("logD")
    return candidates


@router.post("/optimize-2obj")
async def optimize_2obj():
    """2-objective NSGA-II on the sweetness-enhancer pool.

    Objectives:
      Obj-1: maximise P(sweet)  (FartDB taste RF — must be trained first)
      Obj-2: minimise MW        (RDKit ExactMolWt)

    Response shape:
    {
      "pool_meta":        { n_candidates, source, seeds, threshold },
      "model_meta":       { dataset, oob_accuracy, n_train, psweet_method, mw_method },
      "property_range":   { psweet_min, psweet_max, mw_min, mw_max },
      "reference":        { name, smiles, psweet, mw },
      "generations":      [ { gen, n_new, n_evaluated, candidates: [...] }, ... ],
      "pareto_final":     [...]
    }
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")

        if "flavor_sensory" not in training_service._RF_MODEL_CACHE:
            raise ValueError(
                "FartDB Taste model not trained yet. "
                "Go to the Property Prediction tab, select 'FartDB', and click Train Model first."
            )
        rf_taste  = training_service._RF_MODEL_CACHE["flavor_sensory"]
        taste_cfg = DATASETS["flavor_sensory"]
        oob_acc   = round(float(rf_taste.oob_score_), 3)

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
        ref_psweet = training_service.predict_taste_sweet(REFERENCE_COMPOUND["smiles"])
        ref_mw     = training_service.get_mw(REFERENCE_COMPOUND["smiles"])

        # Run generative 2-objective NSGA-II (P(sweet) as obj-1, no third obj)
        generations = run_nsga2_generative(
            initial_pool=valid_pool,
            logD_fn=training_service.predict_taste_sweet,
            mw_fn=training_service.get_mw,
            name_lookup=name_lookup,
            taste_fn=None,
            n_generations=10,
            pop_size=100,
            seed=42,
        )

        # Rename internal 'logD' key → 'psweet' throughout all generations
        for gen in generations:
            _rename_2obj(gen.get("candidates", []))

        gen0_cands = generations[0]["candidates"]
        all_ps = [c["psweet"] for c in gen0_cands if c.get("psweet") is not None]
        all_mw = [c["mw"]     for c in gen0_cands]

        final_gen    = generations[-1]["candidates"]
        pareto_final = sorted(
            [c for c in final_gen if not c["dominated"]],
            key=lambda c: -(c.get("psweet") or 0),
        )
        n_total_evaluated = generations[-1]["n_evaluated"]

        return {
            "pool_meta": {
                "n_candidates": pool_meta["n_candidates"],
                "source":       pool_meta["source"],
                "seeds":        pool_meta["seeds"],
                "threshold":    pool_meta["threshold"],
            },
            "model_meta": {
                "dataset":       taste_cfg["name"],
                "oob_accuracy":  oob_acc,
                "n_train":       taste_cfg.get("n_molecules", 2000),
                "psweet_method": "FartDB taste RF",
                "mw_method":     "RDKit ExactMolWt",
                "n_evaluated":   n_total_evaluated,
            },
            "property_range": {
                "psweet_min": round(min(all_ps), 3) if all_ps else None,
                "psweet_max": round(max(all_ps), 3) if all_ps else None,
                "mw_min":     round(min(all_mw), 1),
                "mw_max":     round(max(all_mw), 1),
            },
            "reference": {
                "name":   REFERENCE_COMPOUND["name"],
                "smiles": REFERENCE_COMPOUND["smiles"],
                "cas":    REFERENCE_COMPOUND["cas"],
                "psweet": round(ref_psweet, 3) if ref_psweet is not None else None,
                "mw":     round(ref_mw, 1)     if ref_mw     is not None else None,
            },
            "generations":  generations,
            "pareto_final": pareto_final,
        }

    try:
        result = await run_in_threadpool(_run)
        result["pareto_final"] = await _enrich_pareto_with_pubchem(result["pareto_final"])
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/optimize-3obj")
async def optimize_3obj():
    """3-objective NSGA-II: P(sweet) ↑, MW ↓, P(safe) ↑.

    P(sweet) is predicted by the FartDB taste RF.
    P(safe)  is predicted as 1 − P(mutagenic) from the AMES RF.
    Requires BOTH models to be trained via /train first.

    Also applies a structural purity filter: excludes compounds with heavy
    halogens (F, Cl, Br, I) or metal atoms.

    Response shape:
    {
      "pool_meta":        { n_candidates, n_after_filter, n_excluded, ... },
      "model_meta":       { oob_accuracy_taste, oob_accuracy_ames, n_evaluated },
      "property_range":   { psweet_min, psweet_max, mw_min, mw_max },
      "reference":        { name, smiles, psweet, mw, psafe },
      "generations":      [ { gen, n_new, n_evaluated, candidates: [...] }, ... ],
      "pareto_final":     [...]
    }
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")

        missing = []
        if "flavor_sensory" not in training_service._RF_MODEL_CACHE:
            missing.append("FartDB Taste")
        if "ames_mutagenicity" not in training_service._RF_MODEL_CACHE:
            missing.append("AMES Mutagenicity")
        if missing:
            raise ValueError(
                f"Missing trained models: {', '.join(missing)}. "
                "Go to the Property Prediction tab and train them first."
            )

        rf_taste   = training_service._RF_MODEL_CACHE["flavor_sensory"]
        rf_ames    = training_service._RF_MODEL_CACHE["ames_mutagenicity"]
        taste_cfg  = DATASETS["flavor_sensory"]
        oob_acc    = round(float(rf_taste.oob_score_), 3)
        oob_ames   = round(float(rf_ames.oob_score_), 3)

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

        def is_pure_phenolic(smiles: str) -> bool:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return False
            for atom in mol.GetAtoms():
                an = atom.GetAtomicNum()
                if an in HEAVY_HALOGENS or an in METAL_NUMS:
                    return False
            return True

        filtered = [c for c in candidates_raw if is_pure_phenolic(c["smiles"])]
        n_excluded = n_total - len(filtered)

        if len(filtered) < 10:
            raise RuntimeError("Too few valid compounds after structural filter.")

        name_lookup = _build_name_lookup(filtered)

        # Reference compound properties
        ref_psweet = training_service.predict_taste_sweet(REFERENCE_COMPOUND["smiles"])
        ref_mw     = training_service.get_mw(REFERENCE_COMPOUND["smiles"])
        ref_psafe  = training_service.predict_ames_safety(REFERENCE_COMPOUND["smiles"])

        # Run generative 3-objective NSGA-II: P(sweet) as obj-1, P(safe AMES) as obj-3
        generations = run_nsga2_generative(
            initial_pool=filtered,
            logD_fn=training_service.predict_taste_sweet,
            mw_fn=training_service.get_mw,
            name_lookup=name_lookup,
            taste_fn=training_service.predict_ames_safety,
            n_generations=10,
            pop_size=100,
            seed=42,
        )

        # Rename: 'psweet' (was obj-3 slot) → 'psafe', 'logD' (was obj-1 slot) → 'psweet'
        for gen in generations:
            _rename_3obj(gen.get("candidates", []))

        gen0_cands = generations[0]["candidates"]
        all_ps = [c["psweet"] for c in gen0_cands if c.get("psweet") is not None]
        all_mw = [c["mw"]     for c in gen0_cands]

        final_gen    = generations[-1]["candidates"]
        pareto_final = sorted(
            [c for c in final_gen if not c["dominated"]],
            key=lambda c: -(c.get("psweet") or 0),
        )
        n_total_evaluated = generations[-1]["n_evaluated"]

        return {
            "pool_meta": {
                "n_candidates":   pool_meta["n_candidates"],
                "n_after_filter": len(filtered),
                "n_excluded":     n_excluded,
                "source":         pool_meta["source"],
                "seeds":          pool_meta["seeds"],
                "threshold":      pool_meta["threshold"],
            },
            "model_meta": {
                "oob_accuracy_taste": oob_acc,
                "oob_accuracy_ames":  oob_ames,
                "psweet_method":      "FartDB taste RF",
                "psafe_method":       "AMES Mutagenicity RF (1 − P(mutagenic))",
                "mw_method":          "RDKit ExactMolWt",
                "n_evaluated":        n_total_evaluated,
            },
            "property_range": {
                "psweet_min": round(min(all_ps), 3) if all_ps else None,
                "psweet_max": round(max(all_ps), 3) if all_ps else None,
                "mw_min":     round(min(all_mw), 1),
                "mw_max":     round(max(all_mw), 1),
            },
            "reference": {
                "name":   REFERENCE_COMPOUND["name"],
                "smiles": REFERENCE_COMPOUND["smiles"],
                "cas":    REFERENCE_COMPOUND["cas"],
                "psweet": round(ref_psweet, 3) if ref_psweet is not None else None,
                "mw":     round(ref_mw, 1)     if ref_mw     is not None else None,
                "psafe":  round(ref_psafe, 3)  if ref_psafe  is not None else None,
            },
            "generations":  generations,
            "pareto_final": pareto_final,
        }

    try:
        result = await run_in_threadpool(_run)
        result["pareto_final"] = await _enrich_pareto_with_pubchem(result["pareto_final"])
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── SSE helper ────────────────────────────────────────────────────────────────

def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ── Optimisation endpoints — SSE streaming ────────────────────────────────────

@router.post("/optimize-2obj/stream")
async def optimize_2obj_stream():
    """SSE streaming version of optimize_2obj.

    Emits the following events in order:
      meta        — pool_meta, model_meta, reference (before gen 0)
      generation  — one per NSGA-II generation (gen 0 also carries property_range)
      pareto_final — PubChem-enriched Pareto front (after all generations)
      done        — signals completion
      error       — on any failure
    """
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[str | None] = asyncio.Queue()
    result: dict = {}

    def _run() -> None:
        try:
            if not training_service.RDKIT_OK:
                raise RuntimeError("RDKit is not installed in this environment.")
            if "flavor_sensory" not in training_service._RF_MODEL_CACHE:
                raise ValueError(
                    "FartDB Taste model not trained yet. "
                    "Go to the Property Prediction tab, select 'FartDB', "
                    "and click Train Model first."
                )

            rf_taste  = training_service._RF_MODEL_CACHE["flavor_sensory"]
            taste_cfg = DATASETS["flavor_sensory"]
            oob_acc   = round(float(rf_taste.oob_score_), 3)

            candidates_raw = get_candidates()
            pool_meta_ = get_pool_meta()

            from rdkit import Chem
            valid_pool = [c for c in candidates_raw if Chem.MolFromSmiles(c["smiles"]) is not None]
            if len(valid_pool) < 10:
                raise RuntimeError("Too few valid compounds in the pool.")

            name_lookup = _build_name_lookup(valid_pool)
            ref_psweet = training_service.predict_taste_sweet(REFERENCE_COMPOUND["smiles"])
            ref_mw     = training_service.get_mw(REFERENCE_COMPOUND["smiles"])

            loop.call_soon_threadsafe(q.put_nowait, _sse("meta", {
                "pool_meta": {
                    "n_candidates": pool_meta_["n_candidates"],
                    "source":       pool_meta_["source"],
                    "seeds":        pool_meta_["seeds"],
                    "threshold":    pool_meta_["threshold"],
                },
                "model_meta": {
                    "dataset":       taste_cfg["name"],
                    "oob_accuracy":  oob_acc,
                    "n_train":       taste_cfg.get("n_molecules", 2000),
                    "psweet_method": "FartDB taste RF",
                    "mw_method":     "RDKit ExactMolWt",
                },
                "reference": {
                    "name":   REFERENCE_COMPOUND["name"],
                    "smiles": REFERENCE_COMPOUND["smiles"],
                    "cas":    REFERENCE_COMPOUND["cas"],
                    "psweet": round(ref_psweet, 3) if ref_psweet is not None else None,
                    "mw":     round(ref_mw, 1)     if ref_mw     is not None else None,
                },
                "total_generations": 10,
            }))

            last_gen = None
            for gen_data in iter_nsga2_generative(
                initial_pool=valid_pool,
                logD_fn=training_service.predict_taste_sweet,
                mw_fn=training_service.get_mw,
                name_lookup=name_lookup,
                taste_fn=None,
                n_generations=10,
                pop_size=100,
                seed=42,
            ):
                _rename_2obj(gen_data.get("candidates", []))

                if gen_data["gen"] == 0:
                    cands = gen_data["candidates"]
                    all_ps = [c["psweet"] for c in cands if c.get("psweet") is not None]
                    all_mw = [c["mw"]     for c in cands]
                    gen_data["property_range"] = {
                        "psweet_min": round(min(all_ps), 3) if all_ps else None,
                        "psweet_max": round(max(all_ps), 3) if all_ps else None,
                        "mw_min":     round(min(all_mw), 1),
                        "mw_max":     round(max(all_mw), 1),
                    }

                last_gen = gen_data
                loop.call_soon_threadsafe(q.put_nowait, _sse("generation", gen_data))

            result["pareto"] = sorted(
                [c for c in (last_gen or {}).get("candidates", []) if not c["dominated"]],
                key=lambda c: -(c.get("psweet") or 0),
            )

        except ValueError as exc:
            loop.call_soon_threadsafe(
                q.put_nowait, _sse("error", {"detail": str(exc), "status": 409})
            )
        except Exception as exc:
            loop.call_soon_threadsafe(
                q.put_nowait, _sse("error", {"detail": str(exc), "status": 500})
            )
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)

    threading.Thread(target=_run, daemon=True).start()

    async def _generate_2obj():
        while True:
            msg = await q.get()
            if msg is None:
                enriched = await _enrich_pareto_with_pubchem(result.get("pareto", []))
                enriched = _enrich_pareto_with_mol_props(enriched)
                yield _sse("pareto_final", enriched)
                yield _sse("done", {})
                return
            yield msg

    return StreamingResponse(
        _generate_2obj(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/optimize-3obj/stream")
async def optimize_3obj_stream():
    """SSE streaming version of optimize_3obj.

    Same event protocol as /optimize-2obj/stream.
    Also carries n_after_filter / n_excluded in pool_meta.
    """
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[str | None] = asyncio.Queue()
    result: dict = {}

    def _run() -> None:
        try:
            if not training_service.RDKIT_OK:
                raise RuntimeError("RDKit is not installed in this environment.")

            missing = []
            if "flavor_sensory" not in training_service._RF_MODEL_CACHE:
                missing.append("FartDB Taste")
            if "ames_mutagenicity" not in training_service._RF_MODEL_CACHE:
                missing.append("AMES Mutagenicity")
            if missing:
                raise ValueError(
                    f"Missing trained models: {', '.join(missing)}. "
                    "Go to the Property Prediction tab and train them first."
                )

            rf_taste  = training_service._RF_MODEL_CACHE["flavor_sensory"]
            rf_ames   = training_service._RF_MODEL_CACHE["ames_mutagenicity"]
            taste_cfg = DATASETS["flavor_sensory"]
            oob_acc   = round(float(rf_taste.oob_score_), 3)
            oob_ames  = round(float(rf_ames.oob_score_), 3)

            candidates_raw = get_candidates()
            pool_meta_ = get_pool_meta()
            n_total = len(candidates_raw)

            from rdkit import Chem
            HEAVY_HALOGENS = {9, 17, 35, 53}
            METAL_NUMS = {
                3, 4, 11, 12, 13, 19, 20, 21, 22, 23, 24, 25,
                26, 27, 28, 29, 30, 31, 37, 38, 39, 40, 41, 42,
                44, 45, 46, 47, 48, 49, 50, 55, 56, 57, 72, 73,
                74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
            }

            def is_pure_phenolic(smiles: str) -> bool:
                mol = Chem.MolFromSmiles(smiles)
                if mol is None:
                    return False
                for atom in mol.GetAtoms():
                    an = atom.GetAtomicNum()
                    if an in HEAVY_HALOGENS or an in METAL_NUMS:
                        return False
                return True

            filtered = [c for c in candidates_raw if is_pure_phenolic(c["smiles"])]
            n_excluded = n_total - len(filtered)

            if len(filtered) < 10:
                raise RuntimeError("Too few valid compounds after structural filter.")

            name_lookup = _build_name_lookup(filtered)
            ref_psweet = training_service.predict_taste_sweet(REFERENCE_COMPOUND["smiles"])
            ref_mw     = training_service.get_mw(REFERENCE_COMPOUND["smiles"])
            ref_psafe  = training_service.predict_ames_safety(REFERENCE_COMPOUND["smiles"])

            loop.call_soon_threadsafe(q.put_nowait, _sse("meta", {
                "pool_meta": {
                    "n_candidates":   pool_meta_["n_candidates"],
                    "n_after_filter": len(filtered),
                    "n_excluded":     n_excluded,
                    "source":         pool_meta_["source"],
                    "seeds":          pool_meta_["seeds"],
                    "threshold":      pool_meta_["threshold"],
                },
                "model_meta": {
                    "oob_accuracy_taste": oob_acc,
                    "oob_accuracy_ames":  oob_ames,
                    "psweet_method":      "FartDB taste RF",
                    "psafe_method":       "AMES Mutagenicity RF (1 − P(mutagenic))",
                    "mw_method":          "RDKit ExactMolWt",
                },
                "reference": {
                    "name":   REFERENCE_COMPOUND["name"],
                    "smiles": REFERENCE_COMPOUND["smiles"],
                    "cas":    REFERENCE_COMPOUND["cas"],
                    "psweet": round(ref_psweet, 3) if ref_psweet is not None else None,
                    "mw":     round(ref_mw, 1)     if ref_mw     is not None else None,
                    "psafe":  round(ref_psafe, 3)  if ref_psafe  is not None else None,
                },
                "total_generations": 10,
            }))

            last_gen = None
            for gen_data in iter_nsga2_generative(
                initial_pool=filtered,
                logD_fn=training_service.predict_taste_sweet,
                mw_fn=training_service.get_mw,
                name_lookup=name_lookup,
                taste_fn=training_service.predict_ames_safety,
                n_generations=10,
                pop_size=100,
                seed=42,
            ):
                _rename_3obj(gen_data.get("candidates", []))

                if gen_data["gen"] == 0:
                    cands = gen_data["candidates"]
                    all_ps = [c["psweet"] for c in cands if c.get("psweet") is not None]
                    all_mw = [c["mw"]     for c in cands]
                    gen_data["property_range"] = {
                        "psweet_min": round(min(all_ps), 3) if all_ps else None,
                        "psweet_max": round(max(all_ps), 3) if all_ps else None,
                        "mw_min":     round(min(all_mw), 1),
                        "mw_max":     round(max(all_mw), 1),
                    }

                last_gen = gen_data
                loop.call_soon_threadsafe(q.put_nowait, _sse("generation", gen_data))

            result["pareto"] = sorted(
                [c for c in (last_gen or {}).get("candidates", []) if not c["dominated"]],
                key=lambda c: -(c.get("psweet") or 0),
            )

        except ValueError as exc:
            loop.call_soon_threadsafe(
                q.put_nowait, _sse("error", {"detail": str(exc), "status": 409})
            )
        except Exception as exc:
            loop.call_soon_threadsafe(
                q.put_nowait, _sse("error", {"detail": str(exc), "status": 500})
            )
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)

    threading.Thread(target=_run, daemon=True).start()

    async def _generate_3obj():
        while True:
            msg = await q.get()
            if msg is None:
                enriched = await _enrich_pareto_with_pubchem(result.get("pareto", []))
                enriched = _enrich_pareto_with_mol_props(enriched)
                yield _sse("pareto_final", enriched)
                yield _sse("done", {})
                return
            yield msg

    return StreamingResponse(
        _generate_3obj(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Optimization results persistence ─────────────────────────────────────────

@router.post("/save-optimization/{run_type}")
async def save_optimization(run_type: str, request: Request):
    """Persist the final state of an optimization run (2obj or 3obj)."""
    if run_type not in ("2obj", "3obj"):
        raise HTTPException(status_code=400, detail="run_type must be '2obj' or '3obj'")
    data = await request.json()
    _OPT_RESULTS[run_type] = data
    _save_opt_cache()
    return {"ok": True}


@router.get("/saved-optimization/{run_type}")
async def get_saved_optimization(run_type: str):
    """Return a previously saved optimization run, or 204 if not present."""
    if run_type not in ("2obj", "3obj"):
        raise HTTPException(status_code=400, detail="run_type must be '2obj' or '3obj'")
    result = _OPT_RESULTS.get(run_type)
    if result is None:
        return Response(status_code=204)
    return result


@router.delete("/saved-optimization/{run_type}")
async def delete_saved_optimization(run_type: str):
    """Delete one saved optimization run."""
    if run_type not in ("2obj", "3obj"):
        raise HTTPException(status_code=400, detail="run_type must be '2obj' or '3obj'")
    _OPT_RESULTS.pop(run_type, None)
    _save_opt_cache()
    return {"ok": True}


@router.delete("/saved-optimization")
async def delete_all_saved_optimization():
    """Delete all saved optimization runs."""
    _OPT_RESULTS.clear()
    _save_opt_cache()
    return {"ok": True}


# ── AMES safety screen ────────────────────────────────────────────────────────

@router.get("/safety-screen")
async def safety_screen():
    """Predict AMES mutagenicity for the aromatic pool compounds.

    Requires the ames_mutagenicity model to be trained via /train first.
    Returns up to 60 pool compounds sorted by P(mutagenic) descending.
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")
        if "ames_mutagenicity" not in training_service._RF_MODEL_CACHE:
            raise ValueError(
                "AMES Mutagenicity model not trained yet. "
                "Go to the Property Prediction tab, select 'AMES Mutagenicity', and click Train Model first."
            )
        rf = training_service._RF_MODEL_CACHE["ames_mutagenicity"]
        candidates = get_candidates()
        results = []
        for c in candidates:
            vec = training_service.featurize_smiles(c["smiles"])
            if vec is None:
                continue
            try:
                proba = rf.predict_proba(vec.reshape(1, -1))[0]
                # AMES dataset: Y=1 means mutagenic → class index 1 = P(mutagenic)
                classes = list(rf.classes_)
                p_mut = float(proba[classes.index(1)]) if 1 in classes else float(proba[1])
                results.append({
                    "name":        c["name"],
                    "cid":         c.get("cid"),
                    "smiles":      c["smiles"],
                    "p_mutagenic": round(p_mut, 3),
                    "mutagenic":   p_mut > 0.5,
                })
            except Exception:
                continue
        results.sort(key=lambda x: x["p_mutagenic"], reverse=True)
        return {
            "results":       results[:60],
            "n_total":       len(results),
            "n_mutagenic":   sum(1 for r in results if r["mutagenic"]),
            "n_safe":        sum(1 for r in results if not r["mutagenic"]),
            "model_trained": True,
        }

    try:
        return await run_in_threadpool(_run)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── AMES screen on saved Pareto candidates ────────────────────────────────────

@router.get("/safety-screen-pareto")
async def safety_screen_pareto():
    """AMES mutagenicity screen on Pareto-optimal candidates from saved optimization runs.

    Collects all non-dominated candidates from the last generation of any saved
    2-obj and 3-obj runs, deduplicates by SMILES, and returns predictions sorted
    by P(mutagenic) descending.
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")
        if "ames_mutagenicity" not in training_service._RF_MODEL_CACHE:
            raise ValueError(
                "AMES Mutagenicity model not trained yet. "
                "Go to the Property Prediction tab, select 'AMES Mutagenicity', and click Train Model first."
            )

        rf = training_service._RF_MODEL_CACHE["ames_mutagenicity"]

        # Collect Pareto candidates from both saved runs, deduplicated by SMILES
        seen: set[str] = set()
        candidates: list[dict] = []
        for run_type, run_label in (("2obj", "Aroma 2-obj"), ("3obj", "Taste 3-obj")):
            saved = _OPT_RESULTS.get(run_type)
            if not saved:
                continue
            gens = saved.get("generations") or []
            if not gens:
                continue
            last_gen = gens[-1]
            for c in (last_gen.get("candidates") or []):
                if c.get("dominated"):
                    continue
                smiles = c.get("smiles")
                if not smiles or smiles in seen:
                    continue
                seen.add(smiles)
                candidates.append({**c, "_run": run_label})

        if not candidates:
            return {"results": [], "n_total": 0, "n_mutagenic": 0, "n_safe": 0}

        results = []
        for c in candidates:
            vec = training_service.featurize_smiles(c["smiles"])
            if vec is None:
                continue
            try:
                proba = rf.predict_proba(vec.reshape(1, -1))[0]
                classes = list(rf.classes_)
                p_mut = float(proba[classes.index(1)]) if 1 in classes else float(proba[1])
                results.append({
                    "name":        c.get("name") or c["smiles"],
                    "cid":         c.get("cid"),
                    "smiles":      c["smiles"],
                    "p_mutagenic": round(p_mut, 3),
                    "mutagenic":   p_mut > 0.5,
                    "run":         c["_run"],
                    "is_new":      c.get("is_new", False),
                    "ad_score":    training_service.get_ad_score(c["smiles"], "ames_mutagenicity"),
                })
            except Exception:
                continue

        results.sort(key=lambda x: x["p_mutagenic"], reverse=True)
        return {
            "results":     results,
            "n_total":     len(results),
            "n_mutagenic": sum(1 for r in results if r["mutagenic"]),
            "n_safe":      sum(1 for r in results if not r["mutagenic"]),
        }

    try:
        return await run_in_threadpool(_run)
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
