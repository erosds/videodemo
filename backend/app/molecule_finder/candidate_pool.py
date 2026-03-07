"""Multi-pool compound loader for MoleculeFinder use cases.

Three curated pools are available:
  - aromatic_pool.json  : 607 PubChem aromatic compounds (solubility use case)
  - sweetness_pool.json : 80 flavanone/chalcone/polyphenol compounds (sweetness use case)
  - colorant_pool.json  : 63 natural yellow/orange pigments (colorant scaffold hopping)
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_POOL_DIR = Path(__file__).parent

_AROMATIC_FILE  = _POOL_DIR / "aromatic_pool.json"
_SWEETNESS_FILE = _POOL_DIR / "sweetness_pool.json"
_COLORANT_FILE  = _POOL_DIR / "colorant_pool.json"


@lru_cache(maxsize=1)
def _load_aromatic() -> dict:
    if not _AROMATIC_FILE.exists():
        raise FileNotFoundError(f"aromatic_pool.json not found at {_AROMATIC_FILE}.")
    return json.loads(_AROMATIC_FILE.read_text())


@lru_cache(maxsize=1)
def _load_sweetness() -> dict:
    if not _SWEETNESS_FILE.exists():
        raise FileNotFoundError(f"sweetness_pool.json not found at {_SWEETNESS_FILE}.")
    return json.loads(_SWEETNESS_FILE.read_text())


@lru_cache(maxsize=1)
def _load_colorant() -> dict:
    if not _COLORANT_FILE.exists():
        raise FileNotFoundError(f"colorant_pool.json not found at {_COLORANT_FILE}.")
    return json.loads(_COLORANT_FILE.read_text())


def get_aromatic_pool() -> list[dict]:
    """607 PubChem aromatic compounds — solubility-guided design."""
    return _load_aromatic()["compounds"]


def get_sweetness_pool() -> list[dict]:
    """80 flavanone/chalcone/polyphenol compounds — sweetness enhancer discovery."""
    return _load_sweetness()["compounds"]


def get_colorant_pool() -> list[dict]:
    """63 natural yellow/orange pigments — colorant scaffold hopping."""
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


def get_aromatic_pool_meta() -> dict:
    return _pool_meta(_load_aromatic())


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
