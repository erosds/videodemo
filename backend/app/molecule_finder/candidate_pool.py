"""Multi-pool compound loader for MoleculeFinder use cases.

Three curated pools, each stored as a JSON file next to this module:
  - druglike_pool.json  : PubChem CNS drug-like compounds (lipophilicity use case)
  - sweetness_pool.json : Sweet compounds (sugars, synthetic, semi-natural sweeteners) for P(sweet)/logS/MW optimisation
  - colorant_pool.json  : natural yellow/orange pigments (colorant scaffold hopping)

Missing pools are generated once in a background thread at server startup via
ensure_pools_exist().  The _load_* functions are pure readers — they never
trigger generation themselves, so lru_cache works correctly and no request
ever blocks on a PubChem query.
"""
from __future__ import annotations

import json
import logging
import threading
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_POOL_DIR = Path(__file__).parent

_DRUGLIKE_FILE  = _POOL_DIR / "druglike_pool.json"
_SWEETNESS_FILE = _POOL_DIR / "sweetness_pool.json"
_COLORANT_FILE  = _POOL_DIR / "colorant_pool.json"

_POOL_FILES = {
    "aromatic":  _DRUGLIKE_FILE,
    "sweetness": _SWEETNESS_FILE,
    "colorant":  _COLORANT_FILE,
}


@lru_cache(maxsize=1)
def _load_druglike() -> dict:
    if not _DRUGLIKE_FILE.exists():
        raise FileNotFoundError(
            "druglike_pool.json not found. "
            "Pool generation runs at startup — check server logs or wait a few minutes."
        )
    return json.loads(_DRUGLIKE_FILE.read_text())


@lru_cache(maxsize=1)
def _load_sweetness() -> dict:
    if not _SWEETNESS_FILE.exists():
        raise FileNotFoundError(
            "sweetness_pool.json not found. "
            "Pool generation runs at startup — check server logs or wait a few minutes."
        )
    return json.loads(_SWEETNESS_FILE.read_text())


@lru_cache(maxsize=1)
def _load_colorant() -> dict:
    if not _COLORANT_FILE.exists():
        raise FileNotFoundError(
            "colorant_pool.json not found. "
            "Pool generation runs at startup — check server logs or wait a few minutes."
        )
    return json.loads(_COLORANT_FILE.read_text())


def ensure_pools_exist() -> None:
    """Spawn a daemon thread that generates any missing pool JSON files.

    Call once at server startup (e.g. from the FastAPI router module level).
    Returns immediately — generation happens in the background so startup is
    not blocked.  If a pool file already exists it is never overwritten.
    """
    missing = [key for key, path in _POOL_FILES.items() if not path.exists()]
    if not missing:
        return

    def _generate_missing() -> None:
        from app.molecule_finder.pool_generator import generate_pool
        for key in missing:
            try:
                logger.info("Auto-generating pool '%s' (file absent)…", key)
                generate_pool(key)
                logger.info("Pool '%s' generated successfully.", key)
                # Invalidate the lru_cache for the just-created file so the
                # next load call reads the real data instead of a cached miss.
                if key == "aromatic":
                    _load_druglike.cache_clear()
                elif key == "sweetness":
                    _load_sweetness.cache_clear()
                elif key == "colorant":
                    _load_colorant.cache_clear()
            except Exception:
                logger.exception("Auto-generation of pool '%s' failed.", key)

    t = threading.Thread(target=_generate_missing, name="pool-generator", daemon=True)
    t.start()


def get_druglike_pool() -> list[dict]:
    """PubChem CNS drug-like compounds — lipophilicity-guided design."""
    return _load_druglike()["compounds"]


def get_sweetness_pool() -> list[dict]:
    """Sweet compounds (sugars, synthetic, semi-natural sweeteners) — P(sweet)/logS/MW Pareto optimisation."""
    return _load_sweetness()["compounds"]


def get_colorant_pool() -> list[dict]:
    """Natural yellow/orange pigments — colorant scaffold hopping."""
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
    """Alias → get_sweetness_pool() (backwards compat)."""
    return get_sweetness_pool()


def get_pool_meta() -> dict:
    """Alias → get_sweetness_pool_meta() (backwards compat)."""
    return get_sweetness_pool_meta()
