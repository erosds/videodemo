"""Multi-pool compound loader for MoleculeFinder use cases.

Pool files are stored in the persistent volume at POOL_DIR (see below).
On first access, bundled seed files (shipped inside the Docker image at
_SEED_DIR) are copied to POOL_DIR so the volume is pre-populated without
requiring an explicit "Generate pool" click.

Three curated pools:
  - druglike_pool.json       : PubChem CNS drug-like compounds (logD/SA optimisation)
  - sweetness_pool.json      : Sweet compounds for P(sweet)/logS/MW optimisation
  - citrus_terpene_pool.json : Aromatic citrus flavour compounds (citrus aroma optimisation)

Pools can be deleted via DELETE /candidates/pool/{key} (persists across restarts
because the volume is writable).  After deletion the frontend shows the
"Generate pool" button which triggers POST /candidates/generate/{key}.
"""
from __future__ import annotations

import json
import logging
import shutil
import threading
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Directory layout ──────────────────────────────────────────────────────────

# Bundled seed files — baked into the Docker image (read-only in production).
_SEED_DIR = Path(__file__).parent / "pools"
_SEED_DIR.mkdir(parents=True, exist_ok=True)

# Persistent volume directory — writable, survives container restarts.
# Falls back to _SEED_DIR when running outside Docker (local dev without volumes).
import os as _os
_VOLUME_BASE = Path(_os.environ.get("ML_DATASETS_DIR", "/app/datasets/molecule_finder"))
_POOL_DIR = _VOLUME_BASE / "pools"
_POOL_DIR.mkdir(parents=True, exist_ok=True)

_POOL_FILENAMES = {
    "cnsdrug":        "druglike_pool.json",
    "sweetness":      "sweetness_pool.json",
    "citrus_terpene": "citrus_terpene_pool.json",
}

_POOL_FILES: dict[str, Path] = {
    key: _POOL_DIR / fname for key, fname in _POOL_FILENAMES.items()
}

# In-process tracking of which pools are currently being generated
_generating: set[str] = set()
_generating_lock = threading.Lock()


# ── Seed-copy helper ──────────────────────────────────────────────────────────

def _seed_pool(key: str) -> None:
    """Copy bundled seed file → volume path if volume path is missing."""
    dest = _POOL_FILES[key]
    if dest.exists():
        return
    seed = _SEED_DIR / _POOL_FILENAMES[key]
    if seed.exists():
        try:
            shutil.copy2(seed, dest)
            logger.info("Seeded pool '%s' from bundled file → %s", key, dest)
        except Exception:
            logger.warning("Could not seed pool '%s' from %s", key, seed)


def _seed_all() -> None:
    for key in _POOL_FILES:
        _seed_pool(key)


# Seed on module import so the volume is populated at startup.
_seed_all()


# ── Loaders (lru_cache — never trigger generation) ───────────────────────────

@lru_cache(maxsize=1)
def _load_druglike() -> dict:
    if not _POOL_FILES["cnsdrug"].exists():
        raise FileNotFoundError("druglike_pool.json not found.")
    return json.loads(_POOL_FILES["cnsdrug"].read_text())


@lru_cache(maxsize=1)
def _load_sweetness() -> dict:
    if not _POOL_FILES["sweetness"].exists():
        raise FileNotFoundError("sweetness_pool.json not found.")
    return json.loads(_POOL_FILES["sweetness"].read_text())


@lru_cache(maxsize=1)
def _load_citrus_terpene() -> dict:
    if not _POOL_FILES["citrus_terpene"].exists():
        raise FileNotFoundError("citrus_terpene_pool.json not found.")
    return json.loads(_POOL_FILES["citrus_terpene"].read_text())


_LOADERS = {
    "cnsdrug":        _load_druglike,
    "sweetness":      _load_sweetness,
    "citrus_terpene": _load_citrus_terpene,
}

_CACHE_CLEARS = {
    "cnsdrug":        _load_druglike.cache_clear,
    "sweetness":      _load_sweetness.cache_clear,
    "citrus_terpene": _load_citrus_terpene.cache_clear,
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


def get_citrus_terpene_pool() -> list[dict]:
    return _load_citrus_terpene()["compounds"]


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


def get_citrus_terpene_pool_meta() -> dict:
    return _pool_meta(_load_citrus_terpene())


# ── Backwards-compatibility aliases ───────────────────────────────────────────
def get_candidates() -> list[dict]:
    return get_sweetness_pool()


def get_pool_meta() -> dict:
    return get_sweetness_pool_meta()


def ensure_pools_exist() -> None:
    """No-op — kept for import compatibility. Pools are now generated on demand."""
    pass
