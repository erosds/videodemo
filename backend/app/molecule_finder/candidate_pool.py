"""Multi-pool compound loader for MoleculeFinder use cases.

Three curated pools are available (auto-generated on first use if the JSON file is absent):
  - druglike_pool.json  : PubChem CNS drug-like compounds (lipophilicity use case)
  - sweetness_pool.json : DHC/isocoumarin/flavanone compounds seeded on sweet phenolics (sweetness use case)
  - colorant_pool.json  : natural yellow/orange pigments (colorant scaffold hopping)
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_POOL_DIR = Path(__file__).parent

_DRUGLIKE_FILE  = _POOL_DIR / "druglike_pool.json"
_SWEETNESS_FILE = _POOL_DIR / "sweetness_pool.json"
_COLORANT_FILE  = _POOL_DIR / "colorant_pool.json"


def _ensure_pool(key: str, path: Path) -> None:
    """Generate the pool JSON on first use if it is absent."""
    if not path.exists():
        from app.molecule_finder.pool_generator import generate_pool
        generate_pool(key)


@lru_cache(maxsize=1)
def _load_aromatic() -> dict:
    _ensure_pool("aromatic", _DRUGLIKE_FILE)
    return json.loads(_DRUGLIKE_FILE.read_text())


@lru_cache(maxsize=1)
def _load_sweetness() -> dict:
    _ensure_pool("sweetness", _SWEETNESS_FILE)
    return json.loads(_SWEETNESS_FILE.read_text())


@lru_cache(maxsize=1)
def _load_colorant() -> dict:
    _ensure_pool("colorant", _COLORANT_FILE)
    return json.loads(_COLORANT_FILE.read_text())


def get_druglike_pool() -> list[dict]:
    """PubChem CNS drug-like compounds — lipophilicity-guided design."""
    return _load_aromatic()["compounds"]


def get_sweetness_pool() -> list[dict]:
    """DHC/isocoumarin/flavanone compounds seeded on sweet phenolics — sweetness enhancer discovery."""
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
