"""FastAPI router for the MoleculeFinder workflow.

Three distinct use cases, each with SSE streaming + batch endpoints:

  /optimize-2obj  — logD (ChEMBL Lipophilicity LightGBM) + SA Score↓ — CNS lipophilicity-guided lead discovery
                    Pool: druglike_pool.json (drug-like CNS compounds). Requires lipophilicity model.

  /optimize-3obj  — P(sweet)↑ + MW↓ + logS↑ (AqSolDB RF) — sweetness discovery
                    Pool: sweetness_pool.json (sweet compounds seeded on Glucose/Sucrose/Aspartame/Saccharin/Stevioside). Requires flavor_sensory + aqsoldb.

  /optimize-scaffold — conjugation_score↑ + MW↓ + regulatory_score↑ — colorant scaffold hopping
                    Pool: colorant_pool.json (natural yellow/orange pigments). No ML model required.
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

from app.molecule_finder.candidate_pool import (
    get_druglike_pool, get_druglike_pool_meta,
    get_sweetness_pool, get_sweetness_pool_meta,
    get_colorant_pool, get_colorant_pool_meta,
    ensure_pools_exist,
)
from app.molecule_finder.molecular_utils import compute_properties, validate_smiles, ecfp4_bits
from app.molecule_finder               import training_service
from app.molecule_finder.training_service import DATASETS
from app.molecule_finder.food_case_data      import REFERENCE_COMPOUNDS
from app.molecule_finder.food_regulatory_data import REGULATORY as REGULATORY_DB
from app.molecule_finder.nsga2_optimizer import iter_nsga2_generative

router = APIRouter()

# Load any previously persisted models into memory when this module is imported.
training_service.load_saved_models()

# Generate any missing pool JSON files in a background thread (non-blocking).
ensure_pools_exist()

# ── Optimization results cache ─────────────────────────────────────────────────
_OPT_CACHE_FILE = training_service.CACHE_DIR / "optimization_results.json"
_OPT_RESULTS: dict[str, dict] = {}

_VALID_RUN_TYPES = ("2obj", "3obj", "scaffold")


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


# ── Pydantic models ───────────────────────────────────────────────────────────

class ValidateSmilesRequest(BaseModel):
    smiles: str


class FingerprintRequest(BaseModel):
    smiles: str


class TrainRequest(BaseModel):
    dataset_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _pubchem_lookup_inchikey(inchikey: str) -> dict | None:
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
    if not training_service.RDKIT_OK:
        return pareto
    from rdkit import Chem
    from rdkit.Chem.inchi import MolToInchi, InchiToInchiKey

    enriched: list[tuple[int, dict]] = []
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
        enriched.append((i, dict(c)))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    lookup_map: dict[int, dict | None] = {
        idx: (results[k] if isinstance(results[k], dict) else None)
        for k, idx in enumerate(indices_to_lookup)
    }

    for k, idx in enumerate(indices_to_lookup):
        c = dict(pareto[idx])
        hit = lookup_map[idx]
        if hit:
            c["cid"] = hit["cid"]
            c["name"] = hit["name"]
            c["pubchem_verified"] = True
        else:
            c["pubchem_verified"] = False
        enriched.append((idx, c))

    enriched.sort(key=lambda x: x[0])
    return [c for _, c in enriched]


def _enrich_pareto_with_mol_props(pareto: list[dict]) -> list[dict]:
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
    from rdkit import Chem
    lookup: dict[str, dict] = {}
    for c in candidates:
        mol = Chem.MolFromSmiles(c["smiles"])
        if mol:
            canon = Chem.MolToSmiles(mol, canonical=True)
            lookup[canon] = {"name": c["name"], "cid": c.get("cid")}
    return lookup


def _build_regulatory_lookup(colorant_pool: list[dict]) -> dict[str, float]:
    """Build canonical-SMILES → regulatory_score from the colorant pool."""
    from rdkit import Chem
    lookup: dict[str, float] = {}
    for c in colorant_pool:
        mol = Chem.MolFromSmiles(c["smiles"])
        if mol:
            canon = Chem.MolToSmiles(mol, canonical=True)
            lookup[canon] = float(c.get("regulatory", 0.5))
    return lookup


def _rename_2obj(candidates: list[dict]) -> list[dict]:
    """Rename optimizer key 'mw' → 'sa_score' for the 2-obj logD+SA run."""
    for c in candidates:
        if "mw" in c:
            c["sa_score"] = c.pop("mw")
    return candidates


def _rename_3obj(candidates: list[dict]) -> list[dict]:
    """Rename optimizer keys for 3-obj: 'psweet'→'logS', 'logD'→'psweet'."""
    for c in candidates:
        if "psweet" in c:
            c["logS"] = c.pop("psweet")
        if "logD" in c:
            c["psweet"] = c.pop("logD")
    return candidates


def _rename_scaffold(candidates: list[dict]) -> list[dict]:
    """Rename optimizer keys for scaffold: 'logD'→'conj_score', 'psweet'→'reg_score'."""
    for c in candidates:
        if "psweet" in c:
            c["reg_score"] = c.pop("psweet")
        if "logD" in c:
            c["conj_score"] = c.pop("logD")
    return candidates


def _sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ── Pydantic models ────────────────────────────────────────────────────────────

class RegulatoryCompound(BaseModel):
    cid:    int | None  = None
    name:   str | None  = None
    smiles: str | None  = None

class RegulatoryCheckRequest(BaseModel):
    compounds: list[RegulatoryCompound]

class SafetyScreenRequest(BaseModel):
    run_type: str  # "2obj" | "3obj" | "scaffold"


# ── Core endpoints ─────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "molecule-finder"}


@router.get("/candidates/meta")
def candidates_meta():
    """Return metadata about all three compound pools.

    Each key is either a full meta dict (pool file present) or a
    {status:"pending", seeds, threshold, target_n, mw_range} dict (file absent,
    generation running in background).  Always returns 200.
    """
    from app.molecule_finder.pool_generator import POOL_CONFIGS

    def _meta_or_pending(loader, pool_key: str) -> dict:
        try:
            return loader()
        except FileNotFoundError:
            cfg = POOL_CONFIGS.get(pool_key, {})
            return {
                "status":    "pending",
                "seeds":     [s["name"] for s in cfg.get("seeds", [])],
                "seed_cids": [s["cid"]  for s in cfg.get("seeds", [])],
                "threshold": cfg.get("threshold"),
                "target_n":  cfg.get("target_n"),
                "mw_range":  [cfg.get("mw_min"), cfg.get("mw_max")],
            }

    return {
        "solubility": _meta_or_pending(get_druglike_pool_meta, "aromatic"),
        "sweetness":  _meta_or_pending(get_sweetness_pool_meta, "sweetness"),
        "colorant":   _meta_or_pending(get_colorant_pool_meta,  "colorant"),
    }


@router.post("/regulatory-check")
def regulatory_check(req: RegulatoryCheckRequest):
    """Cross-reference a list of compounds against FEMA GRAS + EU EC 1334/2008."""
    results = []
    n_approved = n_restricted = n_banned = n_not_evaluated = 0
    for compound in req.compounds:
        cid = compound.cid
        entry = REGULATORY_DB.get(cid) if cid else None
        if entry:
            r = {
                "name":        entry.get("name") or compound.name,
                "cid":         cid,
                "status":      entry.get("status", "not_evaluated"),
                "fema":        entry.get("fema"),
                "eu_fl":       entry.get("eu_fl"),
                "max_use_ppm": entry.get("max_use_ppm"),
                "restriction": entry.get("restriction"),
                "is_new":      False,
            }
        else:
            r = {
                "name":        compound.name,
                "cid":         cid,
                "status":      "not_evaluated",
                "fema":        None,
                "eu_fl":       None,
                "max_use_ppm": None,
                "restriction": None,
                "is_new":      cid is None,
            }
        status = r["status"]
        if status == "approved":       n_approved      += 1
        elif status == "restricted":   n_restricted    += 1
        elif status == "banned":       n_banned        += 1
        else:                          n_not_evaluated += 1
        results.append(r)
    return {
        "results":         results,
        "n_approved":      n_approved,
        "n_restricted":    n_restricted,
        "n_banned":        n_banned,
        "n_not_evaluated": n_not_evaluated,
    }


@router.post("/safety-screen-pareto")
async def safety_screen_pareto(req: SafetyScreenRequest):
    """AMES mutagenicity screen on Pareto-optimal candidates from a saved run.

    run_type: "2obj" | "3obj" | "scaffold"
    Loads the saved optimization result, extracts non-dominated candidates from
    the final generation, and predicts AMES mutagenicity for each.
    """
    if req.run_type not in _VALID_RUN_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid run_type: {req.run_type}")

    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed.")
        if "ames_mutagenicity" not in training_service._MODEL_CACHE:
            raise ValueError("AMES Mutagenicity model not trained yet.")

        saved = _OPT_RESULTS.get(req.run_type)
        if not saved or not saved.get("generations"):
            raise ValueError(f"No saved results for run_type='{req.run_type}'. Run the optimization first.")

        last_gen = saved["generations"][-1]
        pareto = [c for c in (last_gen.get("candidates") or []) if not c.get("dominated")]
        if not pareto:
            raise ValueError("No Pareto-optimal candidates found in saved run.")

        rf = training_service._MODEL_CACHE["ames_mutagenicity"]
        results = []
        for c in pareto:
            smiles = c.get("smiles")
            if not smiles:
                continue
            vec = training_service.featurize_smiles(smiles)
            if vec is None:
                continue
            try:
                proba   = rf.predict_proba(vec.reshape(1, -1))[0]
                classes = list(rf.classes_)
                p_mut   = float(proba[classes.index(1)]) if 1 in classes else float(proba[1])
                ad      = training_service.get_ad_score(smiles, "ames_mutagenicity")
                results.append({
                    "name":        c.get("name", "In silico candidate"),
                    "smiles":      smiles,
                    "cid":         c.get("cid"),
                    "is_new":      c.get("cid") is None,
                    "p_mutagenic": round(p_mut, 3),
                    "mutagenic":   p_mut > 0.5,
                    "ad_score":    round(ad, 3) if ad is not None else None,
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


@router.post("/fingerprint")
def compute_fingerprint(req: FingerprintRequest):
    bits = ecfp4_bits(req.smiles)
    if bits is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")
    return {"bits": bits, "n_bits": len(bits), "set_bits": int(sum(bits))}


@router.get("/structure/{cid}")
async def get_structure_image(cid: int):
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
        if r.status_code == 200:
            return Response(content=r.content, media_type="image/png")
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail="Structure not found on PubChem")
        # 503 ServerBusy or other transient errors — propagate faithfully
        raise HTTPException(status_code=r.status_code,
                            detail=f"PubChem returned {r.status_code}")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach PubChem")


@router.post("/validate-smiles")
def validate_smiles_endpoint(request: ValidateSmilesRequest):
    is_valid = validate_smiles(request.smiles)
    props = compute_properties(request.smiles) if is_valid else {}
    return {"valid": is_valid, "properties": props}


# ── Property prediction ────────────────────────────────────────────────────────

@router.get("/available-datasets")
def available_datasets():
    safe_keys = {"id", "name", "subtitle", "tag", "description", "task_type",
                 "target_label", "max_samples", "domain", "color", "model_role",
                 "model_name"}
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
    return {"models": training_service.get_saved_results()}


@router.delete("/saved-models")
def clear_saved_models_endpoint():
    training_service.clear_saved_models()
    return {"ok": True}


@router.post("/train")
async def train_endpoint(request: TrainRequest):
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


# ── Use case 1: Lipophilicity-guided design (logD + SA Score) ────────────────

@router.post("/optimize-2obj/stream")
async def optimize_2obj_stream():
    """SSE: 2-obj NSGA-II — maximize logD (ChEMBL Lipophilicity LightGBM) + minimize SA Score.
    Pool: druglike_pool.json (93 drug-like CNS compounds, seeded on Diazepam / Lorazepam / Carbamazepine / Haloperidol / Phenytoin).
    Reference: Diazepam (logD ~2.82, CNS-optimal window 1-3).
    """
    REF = REFERENCE_COMPOUNDS["solubility"]
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[str | None] = asyncio.Queue()
    result: dict = {}

    def _run() -> None:
        try:
            if not training_service.RDKIT_OK:
                raise RuntimeError("RDKit is not installed in this environment.")
            if "lipophilicity" not in training_service._MODEL_CACHE:
                raise ValueError(
                    "ChEMBL Lipophilicity model not trained yet. "
                    "Go to the Property Prediction tab, select 'ChEMBL Lipophilicity', "
                    "and click Train Model first."
                )

            lipo_cfg = DATASETS["lipophilicity"]
            oob_r2   = training_service._RESULTS_CACHE.get("lipophilicity", {}).get("metrics", {}).get("oob_r2")

            candidates_raw = get_druglike_pool()
            pool_meta_ = get_druglike_pool_meta()

            from rdkit import Chem
            valid_pool = [c for c in candidates_raw if Chem.MolFromSmiles(c["smiles"]) is not None]
            if len(valid_pool) < 10:
                raise RuntimeError("Too few valid compounds in the aromatic pool.")

            name_lookup = _build_name_lookup(valid_pool)
            ref_logd = training_service.predict_logD(REF["smiles"])
            ref_sa   = training_service.compute_sa_score(REF["smiles"])

            loop.call_soon_threadsafe(q.put_nowait, _sse("meta", {
                "pool_meta": {
                    "n_candidates": pool_meta_["n_candidates"],
                    "source":       pool_meta_["source"],
                    "seeds":        pool_meta_["seeds"],
                    "threshold":    pool_meta_["threshold"],
                },
                "model_meta": {
                    "dataset":      lipo_cfg["name"],
                    "oob_r2":       oob_r2,
                    "n_train":      training_service._RESULTS_CACHE.get("lipophilicity", {}).get("n_valid"),
                    "logD_method":  "ChEMBL Lipophilicity LightGBM",
                    "sa_method":    "RDKit SA Score",
                },
                "reference": {
                    "name":     REF["name"],
                    "smiles":   REF["smiles"],
                    "cas":      REF["cas"],
                    "logD":     round(ref_logd, 3) if ref_logd is not None else None,
                    "sa_score": round(ref_sa, 2)   if ref_sa   is not None else None,
                },
                "total_generations": 10,
            }))

            last_gen = None
            for gen_data in iter_nsga2_generative(
                initial_pool=valid_pool,
                logD_fn=training_service.predict_logD,
                mw_fn=training_service.compute_sa_score,
                name_lookup=name_lookup,
                taste_fn=None,
                n_generations=10,
                pop_size=100,
                seed=42,
            ):
                _rename_2obj(gen_data.get("candidates", []))

                if gen_data["gen"] == 0:
                    cands = gen_data["candidates"]
                    all_ld = [c["logD"]     for c in cands if c.get("logD")     is not None]
                    all_sa = [c["sa_score"] for c in cands if c.get("sa_score") is not None]
                    gen_data["property_range"] = {
                        "logD_min": round(min(all_ld), 3) if all_ld else None,
                        "logD_max": round(max(all_ld), 3) if all_ld else None,
                        "sa_min":   round(min(all_sa), 2) if all_sa else None,
                        "sa_max":   round(max(all_sa), 2) if all_sa else None,
                    }

                last_gen = gen_data
                loop.call_soon_threadsafe(q.put_nowait, _sse("generation", gen_data))

            result["pareto"] = sorted(
                [c for c in (last_gen or {}).get("candidates", []) if not c["dominated"]],
                key=lambda c: -(c.get("logD") or -2),
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

    async def _generate():
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
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Use case 2: Sweetness enhancer discovery (P(sweet) + MW + P(safe)) ────────

@router.post("/optimize-3obj/stream")
async def optimize_3obj_stream():
    """SSE: 3-obj NSGA-II — P(sweet)↑ + MW↓ + logS↑ (AqSolDB RF) — sweetness discovery.
    Pool: sweetness_pool.json (sweet compounds). Requires flavor_sensory + aqsoldb.
    """
    REF = REFERENCE_COMPOUNDS["sweetness"]
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[str | None] = asyncio.Queue()
    result: dict = {}

    def _run() -> None:
        try:
            if not training_service.RDKIT_OK:
                raise RuntimeError("RDKit is not installed in this environment.")

            missing = []
            if "flavor_sensory" not in training_service._MODEL_CACHE:
                missing.append("FartDB Taste")
            if "aqsoldb" not in training_service._MODEL_CACHE:
                missing.append("AqSolDB Solubility")
            if missing:
                raise ValueError(
                    f"Missing trained models: {', '.join(missing)}. "
                    "Go to the Property Prediction tab and train them first."
                )

            taste_cfg = DATASETS["flavor_sensory"]
            oob_acc   = training_service._RESULTS_CACHE.get("flavor_sensory", {}).get("metrics", {}).get("oob_accuracy")
            oob_sol   = training_service._RESULTS_CACHE.get("aqsoldb", {}).get("metrics", {}).get("oob_r2")

            candidates_raw = get_sweetness_pool()
            pool_meta_ = get_sweetness_pool_meta()
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
            ref_psweet = training_service.predict_taste_sweet(REF["smiles"])
            ref_mw     = training_service.get_mw(REF["smiles"])
            ref_logS   = training_service.predict_log_solubility(REF["smiles"])

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
                    "oob_accuracy_taste":  oob_acc,
                    "oob_r2_solubility":   oob_sol,
                    "psweet_method":       "FartDB taste RF",
                    "logS_method":         "AqSolDB RF regressor",
                    "mw_method":           "RDKit ExactMolWt",
                },
                "reference": {
                    "name":   REF["name"],
                    "smiles": REF["smiles"],
                    "cas":    REF["cas"],
                    "psweet": round(ref_psweet, 3) if ref_psweet is not None else None,
                    "mw":     round(ref_mw, 1)     if ref_mw     is not None else None,
                    "logS":   round(ref_logS, 3)   if ref_logS   is not None else None,
                },
                "total_generations": 10,
            }))

            last_gen = None
            for gen_data in iter_nsga2_generative(
                initial_pool=filtered,
                logD_fn=training_service.predict_taste_sweet,
                mw_fn=training_service.get_mw,
                name_lookup=name_lookup,
                taste_fn=training_service.predict_log_solubility,
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

    async def _generate():
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
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Use case 3: Colorant scaffold hopping (conj_score + MW + regulatory) ──────

@router.post("/optimize-scaffold/stream")
async def optimize_scaffold_stream():
    """SSE: 3-obj NSGA-II — conjugation_score↑ + MW↓ + regulatory_score↑.
    Pool: colorant_pool.json (63 natural pigments). No ML model required.
    """
    REF = REFERENCE_COMPOUNDS["colorant"]
    loop = asyncio.get_running_loop()
    q: asyncio.Queue[str | None] = asyncio.Queue()
    result: dict = {}

    def _run() -> None:
        try:
            if not training_service.RDKIT_OK:
                raise RuntimeError("RDKit is not installed in this environment.")

            colorant_pool = get_colorant_pool()
            pool_meta_ = get_colorant_pool_meta()

            from rdkit import Chem
            valid_pool = [c for c in colorant_pool if Chem.MolFromSmiles(c["smiles"]) is not None]
            if len(valid_pool) < 10:
                raise RuntimeError("Too few valid compounds in the colorant pool.")

            reg_lookup = _build_regulatory_lookup(valid_pool)

            def regulatory_fn(smiles: str) -> float:
                mol = Chem.MolFromSmiles(smiles)
                if mol is None:
                    return 0.5
                canon = Chem.MolToSmiles(mol, canonical=True)
                return reg_lookup.get(canon, 0.5)

            name_lookup = _build_name_lookup(valid_pool)
            ref_conj = training_service.compute_conjugation_score(REF["smiles"])
            ref_mw   = training_service.get_mw(REF["smiles"])
            ref_reg  = regulatory_fn(REF["smiles"])

            loop.call_soon_threadsafe(q.put_nowait, _sse("meta", {
                "pool_meta": {
                    "n_candidates": pool_meta_["n_candidates"],
                    "source":       pool_meta_["source"],
                    "seeds":        pool_meta_["seeds"],
                    "threshold":    pool_meta_["threshold"],
                },
                "model_meta": {
                    "conj_method": "RDKit sp2 atom count / 20 (curcumin baseline)",
                    "reg_method":  "Colorant pool regulatory lookup (EU E-number)",
                    "mw_method":   "RDKit ExactMolWt",
                },
                "reference": {
                    "name":       REF["name"],
                    "smiles":     REF["smiles"],
                    "cas":        REF["cas"],
                    "conj_score": round(ref_conj, 3) if ref_conj is not None else None,
                    "mw":         round(ref_mw, 1)   if ref_mw   is not None else None,
                    "reg_score":  round(ref_reg, 2),
                },
                "total_generations": 10,
            }))

            last_gen = None
            for gen_data in iter_nsga2_generative(
                initial_pool=valid_pool,
                logD_fn=training_service.compute_conjugation_score,
                mw_fn=training_service.get_mw,
                name_lookup=name_lookup,
                taste_fn=regulatory_fn,
                n_generations=10,
                pop_size=100,
                seed=42,
            ):
                _rename_scaffold(gen_data.get("candidates", []))

                if gen_data["gen"] == 0:
                    cands = gen_data["candidates"]
                    all_cs = [c["conj_score"] for c in cands if c.get("conj_score") is not None]
                    all_mw = [c["mw"]         for c in cands]
                    gen_data["property_range"] = {
                        "conj_min": round(min(all_cs), 3) if all_cs else None,
                        "conj_max": round(max(all_cs), 3) if all_cs else None,
                        "mw_min":   round(min(all_mw), 1),
                        "mw_max":   round(max(all_mw), 1),
                    }

                last_gen = gen_data
                loop.call_soon_threadsafe(q.put_nowait, _sse("generation", gen_data))

            result["pareto"] = sorted(
                [c for c in (last_gen or {}).get("candidates", []) if not c["dominated"]],
                key=lambda c: -(c.get("conj_score") or 0),
            )

        except Exception as exc:
            loop.call_soon_threadsafe(
                q.put_nowait, _sse("error", {"detail": str(exc), "status": 500})
            )
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)

    threading.Thread(target=_run, daemon=True).start()

    async def _generate():
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
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Optimization results persistence ─────────────────────────────────────────

@router.post("/save-optimization/{run_type}")
async def save_optimization(run_type: str, request: Request):
    if run_type not in _VALID_RUN_TYPES:
        raise HTTPException(status_code=400, detail=f"run_type must be one of {_VALID_RUN_TYPES}")
    data = await request.json()
    _OPT_RESULTS[run_type] = data
    _save_opt_cache()
    return {"ok": True}


@router.get("/saved-optimization/{run_type}")
async def get_saved_optimization(run_type: str):
    if run_type not in _VALID_RUN_TYPES:
        raise HTTPException(status_code=400, detail=f"run_type must be one of {_VALID_RUN_TYPES}")
    result = _OPT_RESULTS.get(run_type)
    if result is None:
        return Response(status_code=204)
    return result


@router.delete("/saved-optimization/{run_type}")
async def delete_saved_optimization(run_type: str):
    if run_type not in _VALID_RUN_TYPES:
        raise HTTPException(status_code=400, detail=f"run_type must be one of {_VALID_RUN_TYPES}")
    _OPT_RESULTS.pop(run_type, None)
    _save_opt_cache()
    return {"ok": True}


@router.delete("/saved-optimization")
async def delete_all_saved_optimization():
    _OPT_RESULTS.clear()
    _save_opt_cache()
    return {"ok": True}


# ── AMES safety screen on pool ─────────────────────────────────────────────────

@router.get("/safety-screen")
async def safety_screen():
    """AMES mutagenicity screen on aromatic pool compounds."""
    def _run() -> dict:
        if not training_service.RDKIT_OK:
            raise RuntimeError("RDKit is not installed in this environment.")
        if "ames_mutagenicity" not in training_service._MODEL_CACHE:
            raise ValueError(
                "AMES Mutagenicity model not trained yet. "
                "Go to the Property Prediction tab and train it first."
            )
        rf = training_service._MODEL_CACHE["ames_mutagenicity"]
        candidates = get_druglike_pool()
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
            "results":     results[:60],
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
