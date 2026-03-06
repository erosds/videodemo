"""Load the sweetness-enhancer compound pool and expose get_candidates().

The pool is a curated set of flavanones, chalcones, dihydrochalcones, and
related polyphenols with known sweetness-modulating activity, stored as
sweetness_pool.json next to this file. No network dependency at runtime.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_POOL_FILE = Path(__file__).parent / "sweetness_pool.json"


@lru_cache(maxsize=1)
def _load_pool() -> dict:
    if not _POOL_FILE.exists():
        raise FileNotFoundError(
            f"aromatic_pool.json not found at {_POOL_FILE}. "
            "Run fetch_pubchem_pool.py first."
        )
    return json.loads(_POOL_FILE.read_text())


def get_candidates() -> list[dict]:
    """Return list of candidate compounds from the pre-built pool."""
    return _load_pool()["compounds"]


def get_pool_meta() -> dict:
    """Return pool metadata (source, seeds, threshold, count, MW range)."""
    pool = _load_pool()
    return {
        "n_candidates": pool["n_candidates"],
        "source": pool["source"],
        "seeds": pool["seeds"],
        "seed_cids": pool["seed_cids"],
        "threshold": pool["threshold"],
        "mw_range": pool["mw_range"],
    }
