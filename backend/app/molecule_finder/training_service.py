"""Real ML training on public molecular property datasets.

Downloads public CSV files (cached locally after first fetch), featurises
each molecule with ECFP4 (2048-bit) + 10 RDKit descriptors, trains a
model (LightGBM for lipophilicity, RandomForest for all other datasets),
then returns real metrics and real feature importances.

Trained model objects are kept in _MODEL_CACHE so that the food-case
optimisation endpoints can reuse a previously trained model without retraining.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor

import joblib
import numpy as np
import pandas as pd

import os

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    roc_auc_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

try:
    from lightgbm import LGBMRegressor, LGBMClassifier
    import warnings as _w
    # LightGBM 4.x exposes feature_names_in_ as a read-only property derived from
    # the booster's auto-generated column names ('Column_0', ...).  sklearn 1.8
    # raises a UserWarning when predict() receives a plain numpy array (no names).
    # The prediction is identical either way — suppress the noise.
    _w.filterwarnings(
        "ignore",
        message="X does not have valid feature names",
        category=UserWarning,
        module=r"sklearn\.utils\.validation",
    )
    LGBM_AVAILABLE = True
except ImportError:
    LGBM_AVAILABLE = False

logger = logging.getLogger(__name__)
if not LGBM_AVAILABLE:
    logger.warning("LightGBM not installed — falling back to RandomForest")
logging.basicConfig(level=logging.INFO)

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, DataStructs
    from rdkit import RDLogger
    RDLogger.DisableLog("rdApp.*")

    # Use the new Generator API (RDKit ≥ 2022.09) to avoid the MorganGenerator
    # deprecation warning emitted by the legacy AllChem.GetMorganFingerprintAsBitVect.
    try:
        from rdkit.Chem.rdFingerprintGenerator import GetMorganGenerator as _GetMorganGenerator
        _fp_gen = _GetMorganGenerator(radius=2, fpSize=2048)

        def _morgan_bits(mol) -> list[int]:
            return _fp_gen.GetFingerprintAsNumPy(mol).tolist()

        def _get_fp(mol):
            """Return ECFP4 ExplicitBitVect for Tanimoto computation."""
            return _fp_gen.GetFingerprint(mol)

    except ImportError:
        # Older RDKit — fall back to AllChem (may show deprecation warning)
        from rdkit.Chem import AllChem

        def _morgan_bits(mol) -> list[int]:
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
            return [int(b) for b in fp.ToBitString()]

        def _get_fp(mol):
            """Return ECFP4 ExplicitBitVect for Tanimoto computation."""
            return AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)

    RDKIT_OK = True
except ImportError:
    RDKIT_OK = False

# In-memory cache: dataset_id → trained model (LGBMRegressor or RandomForest*)
_MODEL_CACHE: dict = {}
_SCALER_CACHE: dict[str, StandardScaler] = {}

# In-memory cache: dataset_id → ECFP4 bool array (N×2048) for AD estimation
_TRAIN_FPS_CACHE: dict[str, "np.ndarray"] = {}

# Lazily initialised PAINS filter catalog
_PAINS_CATALOG = None

# In-memory cache: dataset_id → training results dict (metrics, curves, etc.)
_RESULTS_CACHE: dict[str, dict] = {}

# Cache directory — sits next to the existing molecule_finder JSON data
CACHE_DIR = Path(__file__).parent.parent.parent / "datasets" / "molecule_finder"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Directory for persisted model files
MODELS_DIR = CACHE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ── Public dataset registry ────────────────────────────────────────────────────

DATASETS: dict[str, dict] = {
    "aqsoldb": {
        "id": "aqsoldb",
        "name": "AqSolDB",
        "subtitle": "Aqueous solubility · log S",
        "tag": "SOLUBILITY",
        "model_name": "Random Forest",
        "description": (
            "Compounds with measured aqueous solubility (log S mol/L), "
            "curated from 9 public sources. The most comprehensive open solubility reference set — "
            "a direct upgrade to the classic Delaney ESOL benchmark."
        ),
        "source": "huggingface",
        "hf_repo": "maomlab/AqSolDB",
        "hf_smiles_col": "SMILES",
        "hf_target_col": "Y",
        "smiles_col": "smiles",     # after normalisation
        "target_col": "logS",       # after normalisation
        "task_type": "regression",
        "target_label": "log S (mol/L)",
        "domain": "Drug-like compounds",
        "color": "#ad7dff",
        "model_role": "solubility",
    },
    "flavor_sensory": {
        "id": "flavor_sensory",
        "name": "FartDB",
        "subtitle": "Taste classification · sweet / bitter",
        "tag": "TASTE",
        "model_name": "Random Forest",
        "description": (
            "Sweet and bitter compounds from FartDB — a multi-source taste database. "
            "Classes are balanced (equal sweet / bitter count). "
            "Once trained, predicts sweetness probability as an additional objective in multi-objective design."
        ),
        "source": "huggingface",
        "hf_repo": "FartLabs/FartDB",
        "hf_smiles_col": "Canonicalized SMILES",
        "hf_taste_col": "Canonicalized Taste",
        "taste_classes": ["sweet", "bitter"],
        "label_map": {"sweet": 1.0, "bitter": 0.0},
        "smiles_col": "smiles",   # after normalisation
        "target_col": "taste_label",
        "task_type": "classification",
        "target_label": "P(sweet)",
        "domain": "Multi-source taste compounds",
        "color": "#7961ff",
        "model_role": "flavor",
    },
    "lipophilicity": {
        "id": "lipophilicity",
        "name": "ChEMBL Lipophilicity",
        "subtitle": "LogD at pH 7.4 · oil-water partition",
        "tag": "LIPOPHILICITY",
        "model_name": "LightGBM",
        "description": (
            "Compounds with experimental logD at pH 7.4 from ChEMBL, curated by MoleculeNet. "
            "LogD accounts for ionisation — unlike logP. "
            "Predicts how a flavour compound distributes between aqueous and lipid food phases."
        ),
        "url": "https://deepchemdata.s3-us-west-1.amazonaws.com/datasets/Lipophilicity.csv",
        "smiles_col": "smiles",
        "target_col": "exp",
        "task_type": "regression",
        "target_label": "logD (pH 7.4)",
        "max_samples": 4200,
        "domain": "Food-matrix lipid-water partitioning",
        "color": "#2dd4bf",
        "model_role": "lipophilicity",
    },
    "ames_mutagenicity": {
        "id": "ames_mutagenicity",
        "name": "AMES Mutagenicity",
        "subtitle": "AMES bacterial reverse-mutation test · mutagenic / non-mutagenic",
        "tag": "SAFETY",
        "model_name": "Random Forest",
        "description": (
            "Compounds with binary AMES mutagenicity labels from the TDC benchmark "
            "(Therapeutics Data Commons, Harvard). "
            "The AMES test is the primary genotoxicity screen for all novel food flavouring substances. "
        ),
        "url": "https://dataverse.harvard.edu/api/access/datafile/4259564",
        "sep": "\t",
        "smiles_col": "Drug",
        "target_col": "Y",
        "task_type": "classification",
        "target_label": "P(mutagenic)",
        "max_samples": 7255,
        "domain": "Food safety / regulatory genotoxicology",
        "color": "#f97316",
        "model_role": "mutagenicity",
    },
    "citrus_aroma": {
        "id": "citrus_aroma",
        "name": "GoodScents",
        "subtitle": "Aroma classification · citrus / non-citrus",
        "tag": "AROMA",
        "model_name": "Random Forest",
        "description": (
            "Merged dataset of aroma labels. "
            "Binary classification: citrus, lemon, orange and lime labelled as citrus (1), "
            "all other odor classes as non-citrus (0). "
            "Once trained, predicts P(citrus aroma) as the primary objective for citrus flavour design."
        ),
        "source": "merged_pyrfume",
        # Leffingwell — binary odor matrix, CID-indexed (negative ints)
        "url_leff_molecules": "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/leffingwell/molecules.csv",
        "url_leff_behavior":  "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/leffingwell/behavior.csv",
        # GoodScents — semicolon-string odors, CAS-indexed; stimuli maps CAS→CID
        "url_gs_molecules": "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/goodscents/molecules.csv",
        "url_gs_stimuli":   "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/goodscents/stimuli.csv",
        "url_gs_behavior":  "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/goodscents/behavior.csv",
        # Sigma 2014 — binary odor matrix, Stimulus (negative int) → stimuli.csv → CID
        "url_sigma_molecules": "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/sigma_2014/molecules.csv",
        "url_sigma_stimuli":   "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/sigma_2014/stimuli.csv",
        "url_sigma_behavior":  "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/sigma_2014/behavior.csv",
        # FlavorDB — text percepts, Stimulus = positive CID directly
        "url_fdb_molecules":   "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/flavordb/molecules.csv",
        "url_fdb_behavior":    "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/flavordb/behavior.csv",
        # FlavorNet — 716 FEMA-GRAS compounds, semicolon descriptors, Stimulus = CID
        "url_fn_molecules":    "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/flavornet/molecules.csv",
        "url_fn_behavior":     "https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/flavornet/behavior.csv",
        "citrus_labels": ["citrus", "lemon", "orange", "lime", "grapefruit", "mandarin"],
        "smiles_col": "smiles",
        "target_col": "citrus_label",
        "task_type": "classification",
        "target_label": "P(citrus)",
        "domain": "Food-grade aromatic flavour compounds",
        "color": "#f59e0b",
        "model_role": "citrus",
    },
}

# n_estimators checkpoints for the learning curve.
# Start at 25: with RF bootstrap and n_jobs>1, fewer than ~20 trees can leave
# some samples without OOB estimates, triggering a sklearn warning.
# For LightGBM the curve is computed via num_iteration (no re-training needed).
TREE_STEPS = [25, 50, 100, 150, 200, 300, 500]

# Names for the physicochemical descriptors appended after the 2048 ECFP4 bits.
# Bump FEATURE_VERSION whenever this list changes so that old .npz caches are
# automatically bypassed (they won't match the new versioned filename).
FEATURE_VERSION = "v2"   # v1: 10 desc  |  v2: 10 desc + 6 ionization features

DESCRIPTOR_NAMES = [
    # ── physicochemical (10) ────────────────────────────────────────────────
    "MW",
    "logP",
    "TPSA",
    "HBD",
    "HBA",
    "RotBonds",
    "RingCount",
    "FractionCSP3",
    "AromaticRings",
    "HeavyAtoms",
    # ── pKa / ionization at pH 7.4 (6) ─────────────────────────────────────
    "n_acid_groups",   # count of acidic ionisable sites
    "n_base_groups",   # count of basic ionisable sites
    "net_charge_74",   # estimated net formal charge at pH 7.4
    "acid_charge_74",  # anionic contribution (≤0)
    "base_charge_74",  # cationic contribution (≥0)
    "abs_charge_74",   # |net_charge| — penalises highly ionic molecules
]

# ── Ionization features (pKa-based, for logD at pH 7.4) ────────────────────────
# (SMARTS, typical_pKa, "acid"|"base")
_IONIZATION_GROUPS = [
    ("[CX3](=O)[OX2H1]",                          4.5,  "acid"),  # carboxylic acid
    ("c[OX2H1]",                                   9.5,  "acid"),  # phenol
    ("[SX4](=O)(=O)[NX3H1]",                      10.0,  "acid"),  # sulfonamide NH
    ("[SX4](=O)(=O)[OX2H1]",                       1.0,  "acid"),  # sulfonic acid
    ("[NX3;H2;!$(N-C(=O));!$(N-c)]",             10.5,  "base"),  # primary aliphatic amine
    ("[NX3;H1;!$(N-C(=O));!$(N-c)]",              9.5,  "base"),  # secondary aliphatic amine
    ("[NX3;H0;!$(N-C(=O));!$(N-c);!$(N=*)]",      8.0,  "base"),  # tertiary aliphatic amine
    ("[nH0X2]",                                    5.5,  "base"),  # pyridine-like aromatic N
]

_PH_PRED = 7.4
_ION_PATS = None  # lazy-compiled per process (None in each fresh subprocess worker)


def _get_ion_pats():
    """Compile ionisation SMARTS once per process; cached in module-level var."""
    global _ION_PATS
    if _ION_PATS is None:
        _ION_PATS = [
            (Chem.MolFromSmarts(sma), pka, kind)
            for sma, pka, kind in _IONIZATION_GROUPS
        ]
    return _ION_PATS


def _ionization_features(mol) -> list:
    """Return 6 pKa-derived features for ionisation state at pH 7.4.

    Uses Henderson-Hasselbalch with heuristic pKa values for common ionisable
    functional groups. For logD prediction these features directly encode the
    ionisation penalty: logD(pH) = logP + log(f_neutral).

    Features: [n_acid, n_base, net_charge_74, acid_charge_74, base_charge_74, abs_charge_74]
    """
    n_acid, n_base = 0, 0
    acid_q, base_q = 0.0, 0.0

    for pat, pka, kind in _get_ion_pats():
        if pat is None:
            continue
        n = len(mol.GetSubstructMatches(pat))
        if n == 0:
            continue
        if kind == "acid":
            # f_ionised = 1 / (1 + 10^(pKa − pH)) — ionised acid carries −1 charge
            f = 1.0 / (1.0 + 10.0 ** (pka - _PH_PRED))
            n_acid += n
            acid_q -= n * f
        else:
            # f_protonated = 1 / (1 + 10^(pH − pKa)) — protonated base carries +1 charge
            f = 1.0 / (1.0 + 10.0 ** (_PH_PRED - pka))
            n_base += n
            base_q += n * f

    net_q = acid_q + base_q
    return [
        float(n_acid),
        float(n_base),
        float(net_q),
        float(acid_q),
        float(base_q),
        float(abs(net_q)),
    ]

# ── Dataset loading ────────────────────────────────────────────────────────────

def _hf_import():
    """Import HuggingFace 'datasets', bypassing the local backend/datasets/ directory
    which Python resolves as a namespace package and shadows the real package.
    """
    import sys, importlib

    # If the real HF datasets package is already imported (has load_dataset),
    # return it directly without evicting from sys.modules.  Evicting and
    # re-importing causes Arrow extension types (e.g. Array2DExtensionType) to
    # be registered twice, raising "already defined" errors on the second call.
    if "datasets" in sys.modules and hasattr(sys.modules["datasets"], "load_dataset"):
        _hf = sys.modules["datasets"]
        return _hf, _hf.load_dataset

    # The local datasets/ dir that causes the conflict
    _local_root = str(Path(__file__).parent.parent.parent)  # backend/

    # Remove it (and any equivalent path) from sys.path temporarily
    _saved = sys.path[:]
    sys.path = [p for p in sys.path
                if p and str(Path(p).resolve()) != str(Path(_local_root).resolve())]

    # Evict any cached namespace-package stub so importlib re-resolves
    for _k in [k for k in list(sys.modules) if k == "datasets" or k.startswith("datasets.")]:
        del sys.modules[_k]

    try:
        import datasets as _hf
        from datasets import load_dataset as _ld
        return _hf, _ld
    finally:
        sys.path = _saved  # restore — HF package stays in sys.modules


def _load_hf_dataset(dataset_id: str, cfg: dict) -> pd.DataFrame:
    """Load a HuggingFace dataset, optionally filter/balance, and cache as CSV.

    Handles both regression (rename columns) and classification (filter + balance).
    """
    cache_path = CACHE_DIR / f"{dataset_id}.csv"
    if cache_path.exists():
        return pd.read_csv(cache_path)

    _hf_datasets, hf_load = _hf_import()

    raw = hf_load(cfg["hf_repo"])
    if isinstance(raw, _hf_datasets.DatasetDict):
        df = pd.concat([s.to_pandas() for s in raw.values()], ignore_index=True)
    else:
        df = raw.to_pandas()

    if cfg.get("task_type") == "classification":
        taste_col  = cfg["hf_taste_col"]
        smiles_col = cfg["hf_smiles_col"]
        classes    = cfg["taste_classes"]
        label_map  = cfg["label_map"]

        df = df[df[taste_col].isin(classes)].dropna(subset=[smiles_col]).copy()

        # Balance: 20% class-1 / 80% class-0 when class-0 outnumbers class-1,
        # otherwise 50/50 (symmetric case).
        rng = np.random.default_rng(42)
        pos_cls = max(label_map, key=label_map.get)   # class mapped to 1 (sweet)
        neg_cls = min(label_map, key=label_map.get)   # class mapped to 0 (bitter)
        pos_df  = df[df[taste_col] == pos_cls]
        neg_df  = df[df[taste_col] == neg_cls]

        n_pos = len(pos_df)
        n_neg = len(neg_df)

        if n_neg > n_pos:
            # Class 0 dominates → target 20% pos, 80% neg
            target_neg = min(n_neg, round(n_pos * 80 / 20))
            neg_idx = rng.choice(n_neg, target_neg, replace=False)
            parts = [pos_df, neg_df.iloc[neg_idx]]
        else:
            # Class 1 dominates or equal → standard 50/50
            min_n = min(n_pos, n_neg)
            parts = [
                pos_df.iloc[rng.choice(n_pos, min_n, replace=False)],
                neg_df.iloc[rng.choice(n_neg, min_n, replace=False)],
            ]

        df = (
            pd.concat(parts, ignore_index=True)
            .sample(frac=1, random_state=42)
            .reset_index(drop=True)
        )

        df["taste_label"] = df[taste_col].map(label_map)
        df = df.rename(columns={smiles_col: "smiles"})[["smiles", "taste_label"]]
    else:
        # Regression: rename raw HF columns to the standard names used by _featurize
        hf_smiles  = cfg.get("hf_smiles_col", "SMILES")
        hf_target  = cfg.get("hf_target_col", "Y")
        target_col = cfg["target_col"]
        df = df[[hf_smiles, hf_target]].dropna().copy()
        df = df.rename(columns={hf_smiles: "smiles", hf_target: target_col})

    df.to_csv(cache_path, index=False)
    return df


def _dataset_cache_key(cfg: dict) -> str:
    """Return a short hash of the fields that determine dataset content.

    If any URL, label list, or source type changes, the hash changes → old
    cached CSV is automatically discarded and rebuilt on next training request.
    """
    import hashlib, json as _json
    key_fields = {
        k: cfg[k]
        for k in sorted(cfg)
        if k.startswith("url") or k in ("source", "citrus_labels", "target_col", "sep")
    }
    return hashlib.md5(_json.dumps(key_fields, sort_keys=True).encode()).hexdigest()[:12]


def _check_and_invalidate_cache(dataset_id: str, cfg: dict) -> None:
    """Delete the cached CSV (and its key file) if the config has changed since last build."""
    cache_path = CACHE_DIR / f"{dataset_id}.csv"
    key_path   = CACHE_DIR / f"{dataset_id}.cache_key"

    if not cache_path.exists():
        return  # nothing to invalidate

    current_key = _dataset_cache_key(cfg)

    if key_path.exists():
        stored_key = key_path.read_text().strip()
        if stored_key == current_key:
            return  # cache is fresh
        logger.info(
            "Dataset '%s' config changed (%s → %s) — invalidating cache.",
            dataset_id, stored_key, current_key,
        )
    else:
        logger.info(
            "Dataset '%s' has no cache key file — invalidating stale cache.",
            dataset_id,
        )

    cache_path.unlink(missing_ok=True)
    key_path.unlink(missing_ok=True)

    # Also remove derived artefacts (feature matrix, model) so they are rebuilt
    for pattern in (
        f"{dataset_id}_features_v2.npz",
        f"models/{dataset_id}.joblib",
        f"models/{dataset_id}.json",
        f"models/{dataset_id}_fps.npy",
    ):
        p = CACHE_DIR / pattern
        if p.exists():
            p.unlink()
            logger.info("  removed %s", p)


def _write_cache_key(dataset_id: str, cfg: dict) -> None:
    """Persist the current config hash next to the cached CSV."""
    key_path = CACHE_DIR / f"{dataset_id}.cache_key"
    key_path.write_text(_dataset_cache_key(cfg))


def _download_url_to_df(url: str, sep: str = ",") -> pd.DataFrame:
    """Download a CSV/TSV from URL using httpx (follows redirects, sets User-Agent).

    More robust than pd.read_csv(url) — gives clear HTTP error messages and
    correctly follows redirects that pandas cannot handle.
    """
    import io
    import httpx
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        resp = client.get(url, headers={"User-Agent": "MolFinderDemo/1.0"})
    if resp.status_code != 200:
        raise RuntimeError(
            f"Failed to download dataset (HTTP {resp.status_code}) from: {url}"
        )
    df = pd.read_csv(io.StringIO(resp.text), sep=sep)
    # Strip BOM (\ufeff) and surrounding whitespace from column names
    df.columns = [c.strip().lstrip("\ufeff") for c in df.columns]
    return df


def _load_leffingwell_frame(cfg: dict, citrus_cols: list[str]) -> "pd.DataFrame | None":
    """Load Leffingwell binary-matrix dataset → DataFrame[smiles, citrus_label]."""
    try:
        mol_df = _download_url_to_df(cfg["url_leff_molecules"])
        mol_df.columns = [c.strip() for c in mol_df.columns]
        cid_col = next((c for c in mol_df.columns if c.upper() in ("CID", "STIMULUS")), None)
        smiles_col = next((c for c in mol_df.columns if "SMILES" in c.upper()), None)
        if cid_col is None or smiles_col is None:
            raise RuntimeError(f"Cannot find CID/SMILES in Leffingwell molecules. Cols: {mol_df.columns.tolist()}")
        mol_df = mol_df.rename(columns={cid_col: "CID", smiles_col: "smiles"})
        mol_df = mol_df[["CID", "smiles"]].dropna()
        mol_df["CID"] = mol_df["CID"].astype(int)

        beh_df = _download_url_to_df(cfg["url_leff_behavior"])
        beh_df.columns = [c.strip().lower() for c in beh_df.columns]
        cid_beh = next((c for c in beh_df.columns if c in ("cid", "stimulus")), beh_df.columns[0])
        beh_df = beh_df.rename(columns={cid_beh: "CID"})
        beh_df["CID"] = beh_df["CID"].astype(int)

        available = [l for l in citrus_cols if l in beh_df.columns]
        if not available:
            raise RuntimeError(f"No citrus columns found in Leffingwell behavior. Cols: {beh_df.columns.tolist()}")
        beh_df["citrus_label"] = beh_df[available].max(axis=1).astype(float)

        merged = mol_df.merge(beh_df[["CID", "citrus_label"]], on="CID", how="inner")
        merged = merged[["smiles", "citrus_label"]].dropna()
        logger.info("Leffingwell: %d compounds loaded", len(merged))
        return merged
    except Exception as exc:
        logger.warning("Leffingwell loading failed: %s", exc)
        return None


def _load_goodscents_frame(cfg: dict, citrus_cols: list[str]) -> "pd.DataFrame | None":
    """Load GoodScents (CAS-keyed, semicolon-string) dataset → DataFrame[smiles, citrus_label]."""
    try:
        # molecules: CID → SMILES
        gs_mol = _download_url_to_df(cfg["url_gs_molecules"])
        gs_mol.columns = [c.strip() for c in gs_mol.columns]
        cid_col = next((c for c in gs_mol.columns if c.upper() == "CID"), None)
        smi_col = next((c for c in gs_mol.columns if "SMILES" in c.upper()), None)
        if cid_col is None or smi_col is None:
            raise RuntimeError(f"Cannot find CID/SMILES in GoodScents molecules. Cols: {gs_mol.columns.tolist()}")
        gs_mol = gs_mol.rename(columns={cid_col: "CID", smi_col: "smiles"})[["CID", "smiles"]].dropna()
        gs_mol["CID"] = gs_mol["CID"].astype(int)

        # stimuli: CAS → CID
        gs_stim = _download_url_to_df(cfg["url_gs_stimuli"])
        gs_stim.columns = [c.strip() for c in gs_stim.columns]
        stim_cid_col = next((c for c in gs_stim.columns if c.upper() == "CID"), None)
        if stim_cid_col is None:
            raise RuntimeError(f"Cannot find CID in GoodScents stimuli. Cols: {gs_stim.columns.tolist()}")
        cas_col = gs_stim.columns[0]  # first column = CAS (Stimulus)
        gs_stim = gs_stim[[cas_col, stim_cid_col]].dropna()
        gs_stim = gs_stim.rename(columns={cas_col: "CAS", stim_cid_col: "CID"})
        gs_stim["CID"] = gs_stim["CID"].astype(int)

        # behavior: CAS → semicolon-separated descriptor string
        gs_beh = _download_url_to_df(cfg["url_gs_behavior"])
        gs_beh.columns = [c.strip() for c in gs_beh.columns]
        beh_cas_col = gs_beh.columns[0]
        beh_desc_col = gs_beh.columns[1]
        gs_beh = gs_beh.rename(columns={beh_cas_col: "CAS", beh_desc_col: "Descriptors"})

        def _has_citrus(desc: str) -> float:
            if not isinstance(desc, str):
                return 0.0
            parts = {d.strip().lower() for d in desc.split(";")}
            return 1.0 if parts & set(citrus_cols) else 0.0

        gs_beh["citrus_label"] = gs_beh["Descriptors"].apply(_has_citrus)

        # join: behavior (CAS) → stimuli (CAS→CID) → molecules (CID→SMILES)
        merged = (
            gs_beh[["CAS", "citrus_label"]]
            .merge(gs_stim, on="CAS", how="inner")
            .merge(gs_mol, on="CID", how="inner")
        )[["smiles", "citrus_label"]].dropna()
        logger.info("GoodScents: %d compounds loaded", len(merged))
        return merged
    except Exception as exc:
        logger.warning("GoodScents loading failed: %s", exc)
        return None


def _load_sigma2014_frame(cfg: dict, citrus_cols: list[str]) -> "pd.DataFrame | None":
    """Load Sigma 2014 binary-matrix dataset → DataFrame[smiles, citrus_label].

    behavior.csv Stimulus uses internal negative IDs; stimuli.csv maps them to PubChem CIDs.
    """
    try:
        mol_df = _download_url_to_df(cfg["url_sigma_molecules"])
        mol_df.columns = [c.strip() for c in mol_df.columns]
        cid_col = next((c for c in mol_df.columns if c.upper() == "CID"), None)
        smi_col = next((c for c in mol_df.columns if "SMILES" in c.upper()), None)
        if cid_col is None or smi_col is None:
            raise RuntimeError(f"Cannot find CID/SMILES in Sigma 2014 molecules. Cols: {mol_df.columns.tolist()}")
        mol_df = mol_df.rename(columns={cid_col: "CID", smi_col: "smiles"})[["CID", "smiles"]].dropna()
        mol_df["CID"] = mol_df["CID"].astype(int)

        beh_df = _download_url_to_df(cfg["url_sigma_behavior"])
        beh_df.columns = [c.strip().lower() for c in beh_df.columns]
        stim_col = next((c for c in beh_df.columns if c in ("stimulus", "cid")), beh_df.columns[0])
        beh_df = beh_df.rename(columns={stim_col: "stim_key"})
        beh_df["stim_key"] = beh_df["stim_key"].astype(int)

        available = [l for l in citrus_cols if l in beh_df.columns]
        if not available:
            raise RuntimeError(f"No citrus columns in Sigma 2014 behavior. Cols: {beh_df.columns[:30].tolist()}")
        beh_df["citrus_label"] = beh_df[available].max(axis=1).astype(float)

        # Try direct join (stim_key == CID)
        merged = (beh_df[["stim_key", "citrus_label"]]
                  .rename(columns={"stim_key": "CID"})
                  .merge(mol_df, on="CID", how="inner"))

        if len(merged) == 0:
            # Fall back: use stimuli.csv to map stim_key → CID
            stim_df = _download_url_to_df(cfg["url_sigma_stimuli"])
            stim_df.columns = [c.strip() for c in stim_df.columns]
            stim_cid_col = next((c for c in stim_df.columns if c.upper() == "CID"), None)
            if stim_cid_col is None:
                raise RuntimeError(f"Cannot find CID in Sigma 2014 stimuli. Cols: {stim_df.columns.tolist()}")
            stim_key_col = stim_df.columns[0]
            stim_df = stim_df[[stim_key_col, stim_cid_col]].dropna()
            stim_df = stim_df.rename(columns={stim_key_col: "stim_key", stim_cid_col: "CID"})
            stim_df["stim_key"] = stim_df["stim_key"].astype(int)
            stim_df["CID"] = stim_df["CID"].astype(int)
            merged = (beh_df[["stim_key", "citrus_label"]]
                      .merge(stim_df, on="stim_key", how="inner")
                      .merge(mol_df, on="CID", how="inner"))

        result = merged[["smiles", "citrus_label"]].dropna()
        logger.info("Sigma 2014: %d compounds loaded", len(result))
        return result
    except Exception as exc:
        logger.warning("Sigma 2014 loading failed: %s", exc)
        return None


def _load_flavordb_frame(cfg: dict, citrus_cols: list[str]) -> "pd.DataFrame | None":
    """Load FlavorDB (Pyrfume) text-percept dataset → DataFrame[smiles, citrus_label].

    behavior.csv Stimulus = positive PubChem CID; odor percepts are semicolon-separated text.
    """
    import re as _re
    try:
        mol_df = _download_url_to_df(cfg["url_fdb_molecules"])
        mol_df.columns = [c.strip() for c in mol_df.columns]
        cid_col = next((c for c in mol_df.columns if c.upper() == "CID"), None)
        smi_col = next((c for c in mol_df.columns if "SMILES" in c.upper()), None)
        if cid_col is None or smi_col is None:
            raise RuntimeError(f"Cannot find CID/SMILES in FlavorDB molecules. Cols: {mol_df.columns.tolist()}")
        mol_df = mol_df.rename(columns={cid_col: "CID", smi_col: "smiles"})[["CID", "smiles"]].dropna()
        mol_df["CID"] = mol_df["CID"].astype(int)

        beh_df = _download_url_to_df(cfg["url_fdb_behavior"])
        beh_df.columns = [c.strip() for c in beh_df.columns]
        stim_col = beh_df.columns[0]
        odor_col  = next((c for c in beh_df.columns if "Odor"   in c and "Percept" in c), None)
        flavor_col = next((c for c in beh_df.columns if "Flavor" in c and "Percept" in c), None)
        if odor_col is None and flavor_col is None:
            raise RuntimeError(f"Cannot find Odor/Flavor Percept columns in FlavorDB behavior. Cols: {beh_df.columns.tolist()}")

        # Vectorised citrus check on concatenated text
        pattern = "|".join(_re.escape(kw) for kw in citrus_cols)
        text = (beh_df[odor_col].fillna("") if odor_col else pd.Series("", index=beh_df.index))
        if flavor_col:
            text = text + ";" + beh_df[flavor_col].fillna("")
        citrus_mask = text.str.lower().str.contains(pattern, regex=True, na=False)
        beh_df["citrus_label"] = citrus_mask.astype(float)

        beh_df = beh_df.rename(columns={stim_col: "CID"})
        beh_df["CID"] = beh_df["CID"].astype(int)

        merged = beh_df[["CID", "citrus_label"]].merge(mol_df, on="CID", how="inner")
        result = merged[["smiles", "citrus_label"]].dropna()
        logger.info("FlavorDB: %d compounds loaded", len(result))
        return result
    except Exception as exc:
        logger.warning("FlavorDB loading failed: %s", exc)
        return None


def _load_flavornet_frame(cfg: dict, citrus_cols: list[str]) -> "pd.DataFrame | None":
    """Load FlavorNet (Pyrfume) semicolon-descriptor dataset → DataFrame[smiles, citrus_label].

    behavior.csv: Stimulus = PubChem CID, Descriptors = semicolon-separated odor terms.
    molecules.csv: CID → IsomericSMILES.
    """
    try:
        mol_df = _download_url_to_df(cfg["url_fn_molecules"])
        mol_df.columns = [c.strip() for c in mol_df.columns]
        cid_col = next((c for c in mol_df.columns if c.upper() == "CID"), None)
        smi_col = next((c for c in mol_df.columns if "SMILES" in c.upper()), None)
        if cid_col is None or smi_col is None:
            raise RuntimeError(f"Cannot find CID/SMILES in FlavorNet molecules. Cols: {mol_df.columns.tolist()}")
        mol_df = mol_df.rename(columns={cid_col: "CID", smi_col: "smiles"})[["CID", "smiles"]].dropna()
        mol_df["CID"] = mol_df["CID"].astype(int)

        beh_df = _download_url_to_df(cfg["url_fn_behavior"])
        beh_df.columns = [c.strip() for c in beh_df.columns]
        stim_col = next((c for c in beh_df.columns if "Stimulus" in c or c.upper() == "CID"), beh_df.columns[0])
        desc_col = next((c for c in beh_df.columns if "Descri" in c or "Odor" in c), None)
        if desc_col is None:
            raise RuntimeError(f"Cannot find descriptors column in FlavorNet behavior. Cols: {beh_df.columns.tolist()}")
        beh_df = beh_df.rename(columns={stim_col: "CID"})
        beh_df["CID"] = beh_df["CID"].astype(int)

        def _has_citrus(desc: str) -> float:
            if not isinstance(desc, str):
                return 0.0
            parts = {d.strip().lower() for d in desc.split(";")}
            return 1.0 if parts & set(citrus_cols) else 0.0

        beh_df["citrus_label"] = beh_df[desc_col].apply(_has_citrus)
        merged = beh_df[["CID", "citrus_label"]].merge(mol_df, on="CID", how="inner")
        result = merged[["smiles", "citrus_label"]].dropna()
        logger.info("FlavorNet: %d compounds loaded", len(result))
        return result
    except Exception as exc:
        logger.warning("FlavorNet loading failed: %s", exc)
        return None


def _load_citrus_aroma_dataset(dataset_id: str, cfg: dict) -> pd.DataFrame:
    """Merge Pyrfume Leffingwell + GoodScents + Sigma 2014 + FlavorDB + FlavorNet into a citrus classifier dataset."""
    _check_and_invalidate_cache(dataset_id, cfg)
    cache_path = CACHE_DIR / f"{dataset_id}.csv"
    if cache_path.exists():
        return pd.read_csv(cache_path)

    citrus_cols = [l.lower() for l in cfg["citrus_labels"]]

    frames = []
    for loader, name in [
        (_load_leffingwell_frame, "Leffingwell"),
        (_load_goodscents_frame,  "GoodScents"),
        (_load_sigma2014_frame,   "Sigma 2014"),
        (_load_flavordb_frame,    "FlavorDB"),
        (_load_flavornet_frame,   "FlavorNet"),
    ]:
        frame = loader(cfg, citrus_cols)
        if frame is not None and len(frame) > 0:
            frames.append(frame)

    if not frames:
        raise RuntimeError("Failed to load any citrus aroma data (Leffingwell and GoodScents both failed).")

    combined = pd.concat(frames, ignore_index=True)
    combined["citrus_label"] = combined["citrus_label"].astype(float)

    # Canonicalize SMILES and deduplicate (OR-logic: keep positive label)
    if RDKIT_OK:
        def _canon(s: str) -> "str | None":
            try:
                mol = Chem.MolFromSmiles(str(s))
                return Chem.MolToSmiles(mol) if mol else None
            except Exception:
                return None
        combined["smiles"] = combined["smiles"].apply(_canon)
        combined = combined.dropna(subset=["smiles"])

    agg = combined.groupby("smiles", as_index=False).agg(citrus_sum=("citrus_label", "sum"))
    combined = agg[["smiles"]].copy()
    combined["citrus_label"] = (agg["citrus_sum"] >= 2).astype(float)

    pos = combined[combined["citrus_label"] == 1.0]
    neg = combined[combined["citrus_label"] == 0.0]
    if len(pos) < 20:
        raise RuntimeError(
            f"Too few citrus-labelled samples ({len(pos)}). "
            "Check that the Pyrfume datasets are accessible."
        )
    n_pos, n_neg = len(pos), len(neg)
    if n_neg > n_pos:
        # Class 0 dominates → target 20% pos, 80% neg
        target_neg = min(n_neg, round(n_pos * 80 / 20))
        neg_sample = neg.sample(n=target_neg, random_state=42)
        pos_sample = pos
    else:
        # Class 1 dominates or equal → standard 50/50
        min_n = min(n_pos, n_neg)
        pos_sample = pos.sample(n=min_n, random_state=42)
        neg_sample = neg.sample(n=min_n, random_state=42)

    df = (
        pd.concat([pos_sample, neg_sample], ignore_index=True)
        .sample(frac=1, random_state=42)
        .reset_index(drop=True)
    )
    df.to_csv(cache_path, index=False)
    _write_cache_key(dataset_id, cfg)
    logger.info(
        "citrus_aroma dataset (4-source merge): %d citrus + %d non-citrus = %d total (from %d raw)",
        len(pos_sample), len(neg_sample), len(df), len(combined),
    )
    return df


def _load_dataset(dataset_id: str) -> pd.DataFrame:
    """Return dataset as a DataFrame, downloading and caching if necessary."""
    cfg = DATASETS[dataset_id]

    if cfg.get("source") == "huggingface":
        return _load_hf_dataset(dataset_id, cfg)

    if cfg.get("source") in ("multi_url", "merged_pyrfume"):
        return _load_citrus_aroma_dataset(dataset_id, cfg)

    _check_and_invalidate_cache(dataset_id, cfg)
    cache_path = CACHE_DIR / f"{dataset_id}.csv"
    if cache_path.exists():
        return pd.read_csv(cache_path)
    sep = cfg.get("sep", ",")
    df = _download_url_to_df(cfg["url"], sep=sep)
    df.to_csv(cache_path, index=False)
    _write_cache_key(dataset_id, cfg)
    return df


# ── Featurisation ──────────────────────────────────────────────────────────────

def _featurize_one(args):
    smi, tgt = args

    mol = Chem.MolFromSmiles(str(smi))
    if mol is None:
        return None

    try:

        desc = [
            Descriptors.MolWt(mol),
            Descriptors.MolLogP(mol),
            Descriptors.TPSA(mol),
            float(Descriptors.NumHDonors(mol)),
            float(Descriptors.NumHAcceptors(mol)),
            float(Descriptors.NumRotatableBonds(mol)),
            float(Descriptors.RingCount(mol)),
            float(Descriptors.FractionCSP3(mol)),
            float(Descriptors.NumAromaticRings(mol)),
            float(Descriptors.HeavyAtomCount(mol)),
        ]

        fp = _morgan_bits(mol)
        ion = _ionization_features(mol)  # 6 pKa features

        return fp + desc + ion, float(tgt)  # 2048 + 10 + 6 = 2064 features

    except Exception as e:
        logger.warning("Featurization failed: %s", e)
        return None


def _featurize(smiles_list, targets):

    workers = min(os.cpu_count(), 8)

    with ProcessPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(_featurize_one, zip(smiles_list, targets)))

    X = []
    y = []
    smiles_valid = []

    for smi, r in zip(smiles_list, results):
        if r is None:
            continue

        feats, tgt = r
        X.append(feats)
        y.append(tgt)
        smiles_valid.append(smi)

    return (
        np.array(X, dtype=np.float32),
        np.array(y, dtype=np.float32),
        smiles_valid
    )

# Caching
def _dataset_cache_path(dataset_id):
    return CACHE_DIR / f"{dataset_id}_features_{FEATURE_VERSION}.npz"

def _scaffold_split(smiles, test_size=0.2):

    scaffolds = [get_murcko_scaffold(s) for s in smiles]

    unique_scaffolds = list(set(scaffolds))
    rng = np.random.default_rng(42)

    rng.shuffle(unique_scaffolds)

    split = int(len(unique_scaffolds) * (1 - test_size))
    train_scaffolds = set(unique_scaffolds[:split])

    train_idx = [i for i, s in enumerate(scaffolds) if s in train_scaffolds]
    test_idx = [i for i, s in enumerate(scaffolds) if s not in train_scaffolds]

    return train_idx, test_idx


# ── Training ───────────────────────────────────────────────────────────────────

def train_model(dataset_id: str) -> dict:
    """Full pipeline: load → featurise → train RF → return real results dict.

    This is a synchronous, CPU-bound function — call it from an async endpoint
    via ``run_in_threadpool`` to avoid blocking the event loop.
    """
    if not RDKIT_OK:
        raise RuntimeError("RDKit is not installed in this environment.")

    cfg = DATASETS[dataset_id]
    df = _load_dataset(dataset_id)

    smiles = df[cfg["smiles_col"]].tolist()
    targets = df[cfg["target_col"]].values

    cache_file = _dataset_cache_path(dataset_id)

    if cache_file.exists():
        logger.info("Loading cached features for %s", dataset_id)

        data = np.load(cache_file)
        X = data["X"]
        y = data["y"]

    else:
        X, y, smiles = _featurize(smiles, targets)

        np.savez_compressed(cache_file, X=X, y=y)

    # Optional sample cap (Lipo dataset is large — cap for demo speed)
    max_n = cfg.get("max_samples", len(X))
    if len(X) > max_n:
        rng = np.random.default_rng(42)
        idx = rng.choice(len(X), max_n, replace=False)
        X = X[idx]
        y = y[idx]
        smiles = [smiles[i] for i in idx] if len(smiles) == len(X) + (len(X) - max_n) else smiles[:max_n]

    if len(X) < 50:
        raise RuntimeError(
            f"Only {len(X)} valid molecules found — dataset may be corrupted or unavailable."
        )

    is_clf = cfg.get("task_type") == "classification"

    train_idx, test_idx = _scaffold_split(smiles)

    X_train = X[train_idx]
    X_test = X[test_idx]

    y_train = y[train_idx]
    y_test = y[test_idx]

    scaler = StandardScaler()

    desc_start = 2048

    X_train[:, desc_start:] = scaler.fit_transform(X_train[:, desc_start:])
    X_test[:, desc_start:] = scaler.transform(X_test[:, desc_start:])

    _SCALER_CACHE[dataset_id] = scaler

    # ── Model selection: LightGBM for lipophilicity, RF for everything else ───
    use_lgbm = LGBM_AVAILABLE and dataset_id == "lipophilicity"

    if use_lgbm:
        # lipophilicity is always regression
        model = LGBMRegressor(
            n_estimators=500,
            learning_rate=0.05,
            num_leaves=63,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.3,   # feature fraction per tree — good for sparse ECFP4
            reg_alpha=0.1,
            reg_lambda=0.1,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
    else:
        ModelClass = RandomForestClassifier if is_clf else RandomForestRegressor
        if is_clf:
            # Compute class weights from the actual y_train distribution so the
            # model adapts to whatever imbalance survives the dataset-level sampling
            # (e.g. 20 % citrus / 80 % non-citrus after the merge step).
            # sklearn "balanced" mode: w_c = n_samples / (n_classes * n_c)
            classes, counts = np.unique(y_train, return_counts=True)
            n_samples = len(y_train)
            n_classes  = len(classes)
            cw = {int(c): round(n_samples / (n_classes * cnt), 4)
                  for c, cnt in zip(classes, counts)}
            logger.info("RandomForest class weights (from y_train): %s", cw)
            model = ModelClass(
                n_estimators=500,
                max_depth=None,
                min_samples_leaf=2,
                max_features="sqrt",
                bootstrap=True,
                oob_score=True,
                class_weight=cw,
                random_state=42,
                n_jobs=-1,
            )
        else:
            model = ModelClass(
                n_estimators=500,
                max_depth=None,
                min_samples_leaf=2,
                max_features="sqrt",
                bootstrap=True,
                oob_score=True,
                random_state=42,
                n_jobs=-1,
            )

    cv_scores = cross_val_score(
        model,
        X_train,
        y_train,
        cv=5,
        scoring="accuracy" if is_clf else "r2",
    )

    cv_mean = float(np.mean(cv_scores))

    # ── Learning curve ─────────────────────────────────────────────────────────
    oob_curve: list[dict] = []
    if use_lgbm:
        # Train once, then predict at each checkpoint via num_iteration (no retraining)
        model.fit(X_train, y_train)
        for n in TREE_STEPS:
            pred = model.predict(X_test, num_iteration=min(n, model.n_estimators))
            oob_curve.append({"trees": n, "oob_score": round(float(r2_score(y_test, pred)), 4)})
    else:
        # RF warm-start: track OOB score incrementally, then keep final model
        for n in TREE_STEPS:
            model.n_estimators = n
            model.fit(X_train, y_train)
            oob_curve.append({"trees": n, "oob_score": round(float(model.oob_score_), 4)})
        model.n_estimators = 500
        model.fit(X_train, y_train)

    # Top-10 feature importances
    # LightGBM returns raw split counts; sklearn RF returns normalized MDI.
    # Normalize to [0, 1] so the frontend can display consistent percentages.
    feat_names = [f"ECFP4 bit {i}" for i in range(2048)] + DESCRIPTOR_NAMES
    importances = model.feature_importances_.astype(float)
    total = importances.sum()
    if total > 0:
        importances = importances / total
    top_idx = np.argsort(importances)[::-1][:10]
    feature_importances = [
        {"name": feat_names[i], "importance": round(float(importances[i]), 4)}
        for i in top_idx
    ]

    # Cache the trained model for reuse by other endpoints
    _MODEL_CACHE[dataset_id] = model

    # ── Task-specific metrics ──────────────────────────────────────────────────
    if is_clf:
        y_pred  = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]  # P(sweet)
        metrics = {
            "accuracy":     round(float(accuracy_score(y_test, y_pred)), 3),
            "f1":           round(float(f1_score(y_test, y_pred, average="binary")), 3),
            "auc":          round(float(roc_auc_score(y_test, y_proba)), 3),
            "oob_accuracy": round(oob_curve[-1]["oob_score"], 3),
        }
    else:
        y_pred  = model.predict(X_test)
        metrics = {
            "r2":     round(float(r2_score(y_test, y_pred)), 3),
            "mae":    round(float(mean_absolute_error(y_test, y_pred)), 3),
            "rmse":   round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 3),
            "oob_r2": round(oob_curve[-1]["oob_score"] if use_lgbm else cv_mean, 3),
        }

    results = {
        "dataset_id":          dataset_id,
        "n_train":             int(X_train.shape[0]),
        "n_test":              int(X_test.shape[0]),
        "n_valid":             int(len(X)),
        "task_type":           cfg["task_type"],
        "target_label":        cfg["target_label"],
        "model_name":          cfg.get("model_name", "Random Forest"),
        "oob_curve":           oob_curve,
        "feature_importances": feature_importances,
        "metrics":             metrics,
        "cv_score":            round(cv_mean, 3),
    }

    # Persist model, results, and training FPs (for applicability domain)
    _RESULTS_CACHE[dataset_id] = results
    _save_model_to_disk(dataset_id, results)
    _save_training_fps(dataset_id, X_train)

    return results


# ── Molecular property helpers ────────────────────────────────────────────────

def compute_qed(smiles: str) -> "float | None":
    """Quantitative Estimate of Drug-likeness (0–1, higher = more drug-like)."""
    if not RDKIT_OK:
        return None
    try:
        from rdkit.Chem.QED import qed
        mol = Chem.MolFromSmiles(str(smiles))
        return round(float(qed(mol)), 3) if mol else None
    except Exception:
        return None


def compute_sa_score(smiles: str) -> "float | None":
    """Synthetic Accessibility score (1 = easy, 10 = very hard; Ertl & Schuffenhauer)."""
    if not RDKIT_OK:
        return None
    try:
        mol = Chem.MolFromSmiles(str(smiles))
        if mol is None:
            return None
        from rdkit.Contrib.SA_Score import sascorer  # available in most rdkit installs
        return round(float(sascorer.calculateScore(mol)), 2)
    except (ImportError, Exception):
        return None


def _get_pains_catalog():
    """Return a lazily initialised PAINS A/B/C filter catalog."""
    global _PAINS_CATALOG
    if _PAINS_CATALOG is not None:
        return _PAINS_CATALOG
    if not RDKIT_OK:
        return None
    try:
        from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
        _PAINS_CATALOG = FilterCatalog(params)
    except Exception:
        _PAINS_CATALOG = None
    return _PAINS_CATALOG


def check_pains(smiles: str) -> list[str]:
    """Return list of PAINS pattern descriptions matched, or [] if clean."""
    if not RDKIT_OK:
        return []
    try:
        mol = Chem.MolFromSmiles(str(smiles))
        if mol is None:
            return []
        catalog = _get_pains_catalog()
        if catalog is None:
            return []
        return [m.GetDescription() for m in catalog.GetMatches(mol)]
    except Exception:
        return []


def get_murcko_scaffold(smiles: str) -> "str | None":
    """Return canonical SMILES of the Murcko scaffold."""
    if not RDKIT_OK:
        return None
    try:
        from rdkit.Chem.Scaffolds.MurckoScaffold import GetScaffoldForMol
        mol = Chem.MolFromSmiles(str(smiles))
        if mol is None:
            return None
        scaffold = GetScaffoldForMol(mol)
        return Chem.MolToSmiles(scaffold, canonical=True)
    except Exception:
        return None


# ── Applicability domain ───────────────────────────────────────────────────────

def _save_training_fps(dataset_id: str, X_train: "np.ndarray") -> None:
    """Save first 500 ECFP4 bit-rows from training set for AD estimation."""
    try:
        fps = X_train[:500, :2048].astype(np.uint8)
        np.save(str(MODELS_DIR / f"{dataset_id}_fps.npy"), fps)
        _TRAIN_FPS_CACHE[dataset_id] = fps
    except Exception:
        pass


def _load_training_fps(dataset_id: str) -> "np.ndarray | None":
    if dataset_id in _TRAIN_FPS_CACHE:
        return _TRAIN_FPS_CACHE[dataset_id]
    path = MODELS_DIR / f"{dataset_id}_fps.npy"
    if path.exists():
        try:
            fps = np.load(str(path))
            _TRAIN_FPS_CACHE[dataset_id] = fps
            return fps
        except Exception:
            pass
    return None


def get_ad_score(smiles: str, dataset_id: str, k: int = 5):

    train_fps = _load_training_fps(dataset_id)

    if train_fps is None:
        return None

    vec = featurize_smiles(smiles)
    if vec is None:
        return None

    q = vec[:2048].astype(np.uint8)

    inter = (q & train_fps).sum(axis=1)
    union = (q | train_fps).sum(axis=1)

    sims = np.where(union > 0, inter / union, 0)

    topk = np.sort(sims)[-k:]

    return round(float(np.mean(topk)), 3)


# ── Model persistence ─────────────────────────────────────────────────────────

def _save_model_to_disk(dataset_id: str, results: dict) -> None:
    """Persist the trained RF and its results metadata to MODELS_DIR."""
    if dataset_id not in _MODEL_CACHE:
        return
    try:
        joblib.dump(_MODEL_CACHE[dataset_id], MODELS_DIR / f"{dataset_id}.joblib")
        (MODELS_DIR / f"{dataset_id}.json").write_text(json.dumps(results))
    except Exception:
        pass  # persistence is best-effort; training result is still returned


def load_saved_models() -> dict[str, dict]:
    """Load all persisted models from MODELS_DIR into memory at startup.

    Populates _MODEL_CACHE and _RESULTS_CACHE.
    Returns the results dict for every successfully loaded model.
    """
    loaded: dict[str, dict] = {}
    for model_path in MODELS_DIR.glob("*.joblib"):
        dataset_id = model_path.stem
        if dataset_id not in DATASETS:
            continue
        results_path = MODELS_DIR / f"{dataset_id}.json"
        if not results_path.exists():
            continue
        try:
            rf = joblib.load(model_path)
            results = json.loads(results_path.read_text())
            _MODEL_CACHE[dataset_id] = rf
            _RESULTS_CACHE[dataset_id] = results
            loaded[dataset_id] = results
            _load_training_fps(dataset_id)   # pre-warm AD cache
        except Exception:
            pass
    return loaded


def get_saved_results() -> dict[str, dict]:
    """Return the in-memory results cache (populated at startup and after training)."""
    return dict(_RESULTS_CACHE)


def clear_saved_models() -> None:
    """Delete all persisted model files and clear all in-memory caches."""
    _MODEL_CACHE.clear()
    _RESULTS_CACHE.clear()
    _TRAIN_FPS_CACHE.clear()
    for pattern in ("*.joblib", "*.json", "*_fps.npy"):
        for f in MODELS_DIR.glob(pattern):
            try:
                f.unlink()
            except Exception:
                pass


# ── Helpers for inference (used by the food-case optimisation endpoint) ────────

def get_cached_count(dataset_id: str) -> "int | None":
    """Return the actual row count (excluding header) from the cached CSV, or None.

    Used by /available-datasets to expose real molecule counts without triggering
    a full download. Reads only newlines — O(file_size) but no pandas overhead.
    """
    cache_path = CACHE_DIR / f"{dataset_id}.csv"
    if not cache_path.exists():
        return None
    try:
        with open(cache_path, "rb") as f:
            return sum(1 for _ in f) - 1  # subtract header row
    except Exception:
        return None


def get_model(dataset_id: str):
    """Return the trained model for *dataset_id*, training it if not yet cached.

    Raises RuntimeError if RDKit is unavailable or the dataset is unknown.
    """
    if dataset_id in _MODEL_CACHE:
        return _MODEL_CACHE[dataset_id]
    # train_model populates the cache as a side-effect
    train_model(dataset_id)
    return _MODEL_CACHE[dataset_id]


# Backwards-compatibility alias
get_rf_model = get_model


def featurize_smiles(smiles: str) -> "np.ndarray | None":
    """Featurise a single SMILES string into a 2064-dim feature vector.

    Returns None if the SMILES is invalid or RDKit is unavailable.
    Vector layout: ECFP4 bits 0–2047 | 10 physicochemical descriptors
                   | 6 pKa/ionization features at pH 7.4.
    Must stay in sync with _featurize_one (training) and DESCRIPTOR_NAMES.
    """
    if not RDKIT_OK:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    try:
        desc = [
            Descriptors.MolWt(mol),
            Descriptors.MolLogP(mol),
            Descriptors.TPSA(mol),
            float(Descriptors.NumHDonors(mol)),
            float(Descriptors.NumHAcceptors(mol)),
            float(Descriptors.NumRotatableBonds(mol)),
            float(Descriptors.RingCount(mol)),
            float(Descriptors.FractionCSP3(mol)),
            float(Descriptors.NumAromaticRings(mol)),
            float(Descriptors.HeavyAtomCount(mol)),
        ]
        ion = _ionization_features(mol)  # 6 pKa features
        return np.array(_morgan_bits(mol) + desc + ion, dtype=np.float32)
    except Exception:
        return None


def get_mw(smiles: str) -> "float | None":
    """Return molecular weight for a SMILES string, or None if invalid."""
    if not RDKIT_OK:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    try:
        return float(Descriptors.MolWt(mol))
    except Exception:
        return None


def get_logP(smiles: str) -> "float | None":
    """Return Crippen logP for a SMILES string, or None if invalid."""
    if not RDKIT_OK:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    try:
        return float(Descriptors.MolLogP(mol))
    except Exception:
        return None


def predict_log_solubility(smiles: str) -> "float | None":
    """Predict aqueous logS (mol/L) using the trained AqSolDB RF regressor.

    Returns None if the model has not been trained yet.
    Higher logS (closer to 0) = more water-soluble.
    """
    if "aqsoldb" not in _MODEL_CACHE:
        return None
    rf = _MODEL_CACHE["aqsoldb"]
    vec = featurize_smiles(smiles)
    if vec is None:
        return None
    try:
        return round(float(rf.predict(vec.reshape(1, -1))[0]), 3)
    except Exception:
        return None



def predict_logD(smiles: str) -> "float | None":
    """Predict logD at pH 7.4 using the trained ChEMBL Lipophilicity model.

    Returns None if the model has not been trained yet.
    """
    if "lipophilicity" not in _MODEL_CACHE:
        return None
    model = _MODEL_CACHE["lipophilicity"]
    vec = featurize_smiles(smiles)
    if vec is None:
        return None
    try:
        return round(float(model.predict(vec.reshape(1, -1))[0]), 3)
    except Exception:
        return None


def predict_ames_safety(smiles: str) -> "float | None":
    """Return P(non-mutagenic) = 1 − P(mutagenic) using the AMES RF model.

    Range: 0.0 (likely mutagenic) → 1.0 (likely safe).
    Returns None if the model has not been trained yet.
    """
    if "ames_mutagenicity" not in _MODEL_CACHE:
        return None
    rf = _MODEL_CACHE["ames_mutagenicity"]
    vec = featurize_smiles(smiles)
    if vec is None:
        return None
    try:
        # AMES label: Y=1 means mutagenic → class index 1 = P(mutagenic)
        proba = rf.predict_proba(vec.reshape(1, -1))[0]
        return round(float(1.0 - proba[1]), 3)
    except Exception:
        return None


def predict_taste_sweet(smiles: str) -> "float | None":
    """Return P(sweet) for a SMILES using the trained FartDB classifier.

    Returns None if the model has not been trained yet.
    Range: 0.0 (strongly bitter) → 1.0 (strongly sweet).
    """
    if "flavor_sensory" not in _MODEL_CACHE:
        return None
    rf = _MODEL_CACHE["flavor_sensory"]
    vec = featurize_smiles(smiles)
    if vec is None:
        return None
    try:
        # label_map: sweet→1.0, bitter→0.0  → class index 1 = sweet
        proba = rf.predict_proba(vec.reshape(1, -1))[0]
        return round(float(proba[1]), 3)
    except Exception:
        return None


def get_model_by_role(role: str) -> "RandomForestRegressor | None":
    """Return the trained RF for a given role ('solubility' or 'flavor'), or None.

    Roles are defined in the DATASETS registry under the 'model_role' key.
    """
    for dataset_id, cfg in DATASETS.items():
        if cfg.get("model_role") == role and dataset_id in _MODEL_CACHE:
            return _MODEL_CACHE[dataset_id]
    return None


def compute_oxidation_stability(smiles: str) -> "float | None":
    """Estimate oxidation stability by penalising non-aromatic C=C double bonds.

    Non-aromatic C=C bonds (as in terpenes/monoterpenes) are easily auto-oxidised,
    which is the main source of off-flavour in citrus aroma compounds stored in
    aqueous beverages.  Each such bond subtracts 0.25 from the score.

    Returns 0.0–1.0, higher = more stable (fewer oxidisable alkene bonds).
    Limonene baseline: 2 non-aromatic C=C → score ≈ 0.50.
    """
    if not RDKIT_OK:
        return None
    mol = Chem.MolFromSmiles(str(smiles))
    if mol is None:
        return None
    try:
        from rdkit.Chem import rdchem
        n_unsat = sum(
            1 for bond in mol.GetBonds()
            if bond.GetBondType() == rdchem.BondType.DOUBLE
            and not bond.GetIsAromatic()
            and bond.GetBeginAtom().GetAtomicNum() == 6
            and bond.GetEndAtom().GetAtomicNum() == 6
        )
        return round(max(0.0, 1.0 - n_unsat * 0.25), 3)
    except Exception:
        return None


def predict_citrus_aroma(smiles: str) -> "float | None":
    """Return P(citrus aroma) for a SMILES using the trained Leffingwell RF classifier.

    Range: 0.0 (non-citrus) → 1.0 (strongly citrus).
    Returns None if the model has not been trained yet.
    """
    if "citrus_aroma" not in _MODEL_CACHE:
        return None
    rf = _MODEL_CACHE["citrus_aroma"]
    vec = featurize_smiles(smiles)
    if vec is None:
        return None
    try:
        proba = rf.predict_proba(vec.reshape(1, -1))[0]
        classes = list(rf.classes_)
        # citrus_label=1.0 is the positive class
        p_idx = classes.index(1) if 1 in classes else (classes.index(1.0) if 1.0 in classes else 1)
        return round(float(proba[p_idx]), 3)
    except Exception:
        return None


def compute_tanimoto_to_ref(smiles_list: list[str], ref_smiles: str) -> "np.ndarray":
    """Compute ECFP4 Tanimoto similarity of each SMILES to a reference compound.

    Returns a float32 array of shape (n,) with values in [0, 1].
    Compounds that fail RDKit parsing receive similarity 0.0.
    """
    n = len(smiles_list)
    if not RDKIT_OK:
        return np.zeros(n, dtype=np.float32)

    ref_mol = Chem.MolFromSmiles(str(ref_smiles))
    if ref_mol is None:
        return np.zeros(n, dtype=np.float32)

    try:
        ref_fp = _get_fp(ref_mol)
    except Exception:
        return np.zeros(n, dtype=np.float32)

    results: list[float] = []
    for smi in smiles_list:
        mol = Chem.MolFromSmiles(str(smi))
        if mol is None:
            results.append(0.0)
            continue
        try:
            fp  = _get_fp(mol)
            sim = DataStructs.TanimotoSimilarity(ref_fp, fp)
            results.append(float(sim))
        except Exception:
            results.append(0.0)

    return np.array(results, dtype=np.float32)