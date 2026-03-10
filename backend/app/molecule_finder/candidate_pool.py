"""Multi-pool compound loader for MoleculeFinder use cases.

Three curated pools, each stored as a JSON file in the pools/ subdirectory:
  - pools/druglike_pool.json  : PubChem CNS drug-like compounds (logD/SA optimisation)
  - pools/sweetness_pool.json : Sweet compounds for P(sweet)/logS/MW optimisation
  - pools/colorant_pool.json  : Natural yellow/orange pigments (scaffold hopping)

Pools are NOT auto-generated at startup.  The frontend checks pool status via
GET /candidates/meta and triggers generation explicitly via
POST /candidates/generate/{key}.  Generation is tracked in-process so the UI
can show a spinner while it runs.
"""
from __future__ import annotations

import json
import logging
import threading
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_POOL_DIR = Path(__file__).parent / "pools"
_POOL_DIR.mkdir(parents=True, exist_ok=True)

_DRUGLIKE_FILE  = _POOL_DIR / "druglike_pool.json"
_SWEETNESS_FILE = _POOL_DIR / "sweetness_pool.json"
_COLORANT_FILE  = _POOL_DIR / "colorant_pool.json"

_POOL_FILES: dict[str, Path] = {
    "cnsdrug":  _DRUGLIKE_FILE,
    "sweetness": _SWEETNESS_FILE,
    "colorant":  _COLORANT_FILE,
}

# In-process tracking of which pools are currently being generated
_generating: set[str] = set()
_generating_lock = threading.Lock()


# ── Loaders (lru_cache — never trigger generation) ───────────────────────────

@lru_cache(maxsize=1)
def _load_druglike() -> dict:
    if not _DRUGLIKE_FILE.exists():
        raise FileNotFoundError("druglike_pool.json not found.")
    return json.loads(_DRUGLIKE_FILE.read_text())


@lru_cache(maxsize=1)
def _load_sweetness() -> dict:
    if not _SWEETNESS_FILE.exists():
        raise FileNotFoundError("sweetness_pool.json not found.")
    return json.loads(_SWEETNESS_FILE.read_text())


@lru_cache(maxsize=1)
def _load_colorant() -> dict:
    if not _COLORANT_FILE.exists():
        raise FileNotFoundError("colorant_pool.json not found.")
    return json.loads(_COLORANT_FILE.read_text())


_LOADERS = {
    "cnsdrug":  _load_druglike,
    "sweetness": _load_sweetness,
    "colorant":  _load_colorant,
}

_CACHE_CLEARS = {
    "cnsdrug":  _load_druglike.cache_clear,
    "sweetness": _load_sweetness.cache_clear,
    "colorant":  _load_colorant.cache_clear,
}


# ── Pool status ───────────────────────────────────────────────────────────────

def get_pool_status(key: str) -> str:
    """Return "ready" | "generating" | "missing"."""
    with _generating_lock:
        if key in _generating:
            return "generating"
    if _POOL_FILES[key].exists():
        return "ready"
    return "missing"


# ── On-demand generation ──────────────────────────────────────────────────────

def generate_pool_on_demand(key: str) -> str:
    """Start background generation for *key* if not already running.

    Returns one of: "started" | "already_generating" | "already_exists".
    """
    if key not in _POOL_FILES:
        raise ValueError(f"Unknown pool key: {key!r}")

    if _POOL_FILES[key].exists():
        return "already_exists"

    with _generating_lock:
        if key in _generating:
            return "already_generating"
        _generating.add(key)

    def _run() -> None:
        from app.molecule_finder.pool_generator import generate_pool
        try:
            logger.info("Generating pool '%s'…", key)
            generate_pool(key)
            logger.info("Pool '%s' generated successfully.", key)
            _CACHE_CLEARS[key]()
        except Exception:
            logger.exception("Pool '%s' generation failed.", key)
        finally:
            with _generating_lock:
                _generating.discard(key)

    t = threading.Thread(target=_run, name=f"pool-gen-{key}", daemon=True)
    t.start()
    return "started"


# ── Public getters ────────────────────────────────────────────────────────────

def get_druglike_pool() -> list[dict]:
    return _load_druglike()["compounds"]


def get_sweetness_pool() -> list[dict]:
    return _load_sweetness()["compounds"]


def get_colorant_pool() -> list[dict]:
    return _load_colorant()["compounds"]


def _pool_meta(data: dict) -> dict:
    return {
        "n_candidates": data.get("n_candidates", len(data.get("compounds", []))),
        "source":       data.get("source", ""),
        "seeds":        data.get("seeds", []),
        "seed_cids":    data.get("seed_cids", []),
        "threshold":    data.get("threshold", 0),
        "mw_range":     data.get("mw_range", []),
    }


def get_druglike_pool_meta() -> dict:
    return _pool_meta(_load_druglike())


def get_sweetness_pool_meta() -> dict:
    return _pool_meta(_load_sweetness())


def get_colorant_pool_meta() -> dict:
    return _pool_meta(_load_colorant())


# ── Backwards-compatibility aliases ───────────────────────────────────────────
def get_candidates() -> list[dict]:
    return get_sweetness_pool()


def get_pool_meta() -> dict:
    return get_sweetness_pool_meta()


def ensure_pools_exist() -> None:
    """No-op — kept for import compatibility. Pools are now generated on demand."""
    pass
