"""FastAPI router for the MoleculeFinder workflow.

Property prediction (/available-datasets, /train) performs real RandomForest
training on public molecular datasets via training_service.py.

Optimisation endpoints (/optimize-2obj, /optimize-3obj) use the pre-built
PubChem aromatic pool (~600 compounds) as candidates.
"""
from __future__ import annotations

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

router = APIRouter()


# ── Pydantic request models ───────────────────────────────────────────────────

class ValidateSmilesRequest(BaseModel):
    smiles: str


class FingerprintRequest(BaseModel):
    smiles: str


class TrainRequest(BaseModel):
    dataset_id: str


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

    Objectives:
      Obj-1: maximise logS (aqueous solubility, predicted by RF)
      Obj-2: minimise MW  (computed by RDKit)

    Requires the AqSolDB RF to be trained via /train first.

    Response shape:
    {
      "pool_meta":        { n_candidates, source, seeds, threshold },
      "model_meta":       { dataset, oob_r2, n_train, target },
      "property_range":   { logS_min, logS_max, mw_min, mw_max },
      "reference":        { name, smiles, logS, mw },
      "generations":      [ { gen, candidates: [...] }, ... ],
      "pareto_final":     [...]
    }
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")

        if "aqsoldb" not in training_service._RF_MODEL_CACHE:
            raise ValueError(
                "AqSolDB model not trained yet. "
                "Go to the Property Prediction tab, select 'AqSolDB', and click Train Model first."
            )
        rf = training_service._RF_MODEL_CACHE["aqsoldb"]
        esol_cfg = DATASETS["aqsoldb"]
        oob_r2 = round(float(rf.oob_score_), 3)

        # Load candidate pool and validate
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

        # Build name lookup: canonical_smiles → name
        name_lookup: dict[str, str] = {}
        for c in valid_pool:
            mol = Chem.MolFromSmiles(c["smiles"])
            if mol:
                canon = Chem.MolToSmiles(mol, canonical=True)
                name_lookup[canon] = c["name"]

        # Reference compound (Vanillin)
        ref_vec  = training_service.featurize_smiles(REFERENCE_COMPOUND["smiles"])
        ref_mw   = training_service.get_mw(REFERENCE_COMPOUND["smiles"])
        ref_logS = float(rf.predict(ref_vec.reshape(1, -1))[0]) if ref_vec is not None else None

        # Run generative NSGA-II
        generations = run_nsga2_generative(
            initial_pool=valid_pool,
            rf_model=rf,
            featurize_fn=training_service.featurize_smiles,
            mw_fn=training_service.get_mw,
            name_lookup=name_lookup,
            n_generations=8,
            pop_size=30,
            seed=42,
        )

        # Derive property ranges from gen0 candidates
        gen0_cands = generations[0]["candidates"]
        all_logS = [c["logS"] for c in gen0_cands]
        all_mw   = [c["mw"]   for c in gen0_cands]

        final_gen    = generations[-1]["candidates"]
        pareto_final = sorted(
            [c for c in final_gen if not c["dominated"]],
            key=lambda c: -c["logS"],
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
                "dataset":  esol_cfg["name"],
                "oob_r2":   oob_r2,
                "n_train":  len(valid_pool),
                "target":   esol_cfg["target_label"],
                "n_evaluated": n_total_evaluated,
            },
            "property_range": {
                "logS_min": round(min(all_logS), 2),
                "logS_max": round(max(all_logS), 2),
                "mw_min":   round(min(all_mw), 1),
                "mw_max":   round(max(all_mw), 1),
            },
            "reference": {
                "name":   REFERENCE_COMPOUND["name"],
                "smiles": REFERENCE_COMPOUND["smiles"],
                "cas":    REFERENCE_COMPOUND["cas"],
                "logS":   round(ref_logS, 3) if ref_logS is not None else None,
                "mw":     round(ref_mw, 1) if ref_mw is not None else None,
            },
            "generations":  generations,
            "pareto_final": pareto_final,
        }

    try:
        result = await run_in_threadpool(_run)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/optimize-3obj")
async def optimize_3obj():
    """3-objective NSGA-II: logS ↑, MW ↓, Tanimoto similarity to Vanillin ↑.

    Also applies a structural purity filter: excludes compounds with heavy
    halogens or metal atoms (verified via RDKit).

    Response adds `known_alternatives_found` key listing which known industry
    vanillin alternatives appear on the final Pareto front.
    """
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")

        if "aqsoldb" not in training_service._RF_MODEL_CACHE:
            raise ValueError(
                "AqSolDB model not trained yet. "
                "Go to the Property Prediction tab, select 'AqSolDB', and click Train Model first."
            )
        rf = training_service._RF_MODEL_CACHE["aqsoldb"]
        esol_cfg = DATASETS["aqsoldb"]
        oob_r2 = round(float(rf.oob_score_), 3)

        candidates_raw = get_candidates()
        pool_meta = get_pool_meta()
        n_total = len(candidates_raw)

        # Structural purity filter: no heavy halogens (F, Cl, Br, I), no metals
        from rdkit import Chem
        HEAVY_HALOGENS = {9, 17, 35, 53}
        METAL_NUMS = {
            3,4,11,12,13,19,20,21,22,23,24,25,26,27,28,29,30,
            31,37,38,39,40,41,42,44,45,46,47,48,49,50,55,56,
            57,72,73,74,75,76,77,78,79,80,81,82,83
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

        # Build name lookup
        name_lookup: dict[str, str] = {}
        for c in filtered:
            mol = Chem.MolFromSmiles(c["smiles"])
            if mol:
                canon = Chem.MolToSmiles(mol, canonical=True)
                name_lookup[canon] = c["name"]

        # Reference compound
        ref_vec  = training_service.featurize_smiles(REFERENCE_COMPOUND["smiles"])
        ref_mw   = training_service.get_mw(REFERENCE_COMPOUND["smiles"])
        ref_logS = float(rf.predict(ref_vec.reshape(1, -1))[0]) if ref_vec is not None else None

        # Run generative 3-objective NSGA-II
        generations = run_nsga2_generative(
            initial_pool=filtered,
            rf_model=rf,
            featurize_fn=training_service.featurize_smiles,
            mw_fn=training_service.get_mw,
            name_lookup=name_lookup,
            tanimoto_ref_smiles=REFERENCE_COMPOUND["smiles"],
            compute_tanimoto_fn=training_service.compute_tanimoto_to_ref,
            n_generations=8,
            pop_size=30,
            seed=42,
        )

        # Derive property ranges from gen0
        gen0_cands = generations[0]["candidates"]
        all_logS = [c["logS"] for c in gen0_cands]
        all_mw   = [c["mw"]   for c in gen0_cands]

        final_gen    = generations[-1]["candidates"]
        pareto_final = sorted(
            [c for c in final_gen if not c["dominated"]],
            key=lambda c: -(c.get("tanimoto") or 0),
        )
        n_total_evaluated = generations[-1]["n_evaluated"]

        # Flag known vanillin alternatives on Pareto front
        known_set = {
            "Vanillin", "Ethylvanillin", "Piperonal", "Guaiacol",
            "4-Hydroxybenzaldehyde", "Anisaldehyde", "Heliotropin",
            "3,4-Dimethoxybenzaldehyde", "Syringaldehyde",
        }
        found_alternatives = [c["name"] for c in pareto_final if c["name"] in known_set]

        return {
            "pool_meta": {
                "n_candidates": pool_meta["n_candidates"],
                "n_after_filter": len(filtered),
                "n_excluded": n_excluded,
                "source": pool_meta["source"],
                "seeds": pool_meta["seeds"],
                "threshold": pool_meta["threshold"],
            },
            "model_meta": {
                "dataset":  esol_cfg["name"],
                "oob_r2":   oob_r2,
                "n_train":  len(filtered),
                "target":   esol_cfg["target_label"],
                "n_evaluated": n_total_evaluated,
            },
            "property_range": {
                "logS_min": round(min(all_logS), 2),
                "logS_max": round(max(all_logS), 2),
                "mw_min":   round(min(all_mw), 1),
                "mw_max":   round(max(all_mw), 1),
            },
            "reference": {
                "name":     REFERENCE_COMPOUND["name"],
                "smiles":   REFERENCE_COMPOUND["smiles"],
                "cas":      REFERENCE_COMPOUND["cas"],
                "logS":     round(ref_logS, 3) if ref_logS is not None else None,
                "mw":       round(ref_mw, 1) if ref_mw is not None else None,
                "tanimoto": 1.0,
            },
            "generations":  generations,
            "pareto_final": pareto_final,
            "known_alternatives_found": found_alternatives,
        }

    try:
        result = await run_in_threadpool(_run)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
