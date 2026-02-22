"""
Neural Safety MS — Backend Service
Parses EFSA/Wageningen ECRFS library:
  - ECRFS_library_final.mgf  → 102 MS2 spectra
  - ECRFS_metadata_final.csv → toxicological & chemical metadata
"""
import re
import csv
import logging
import threading
from pathlib import Path
from typing import List, Dict, Optional

# matchms emits a lot of WARNING-level noise (missing precursor_mz, etc.)
# that is expected for bulk public databases — suppress below ERROR.
logging.getLogger("matchms").setLevel(logging.ERROR)

DATASETS_DIR = Path(__file__).parent.parent / "datasets" / "neural_safety"
MGF_FILE = DATASETS_DIR / "ECRFS_library_final.mgf"
CSV_FILE  = DATASETS_DIR / "ECRFS_metadata_final.csv"

# In-memory caches (loaded once per process)
_spectra_cache: Optional[List[Dict]] = None
_csv_cache:     Optional[Dict[str, Dict]] = None
_library_cache: Optional[List[Dict]] = None


# ──────────────────────────────────────────────────────────────
#  Parsers
# ──────────────────────────────────────────────────────────────

def _parse_mgf() -> List[Dict]:
    """Read ECRFS_library_final.mgf and return a list of spectrum dicts."""
    spectra: List[Dict] = []

    with open(MGF_FILE, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    blocks = re.split(r"BEGIN IONS", content)
    for block in blocks[1:]:
        end_idx = block.find("END IONS")
        if end_idx == -1:
            continue
        block = block[:end_idx].strip()

        spectrum: Dict = {"peaks": [], "metadata": {}}
        for line in block.splitlines():
            line = line.strip()
            if not line:
                continue

            # Peak line: two floating-point numbers separated by whitespace
            parts = line.split()
            if len(parts) == 2:
                try:
                    mz = float(parts[0])
                    intensity = float(parts[1])
                    spectrum["peaks"].append({"mz": mz, "intensity": intensity})
                    continue
                except ValueError:
                    pass

            # Metadata line: KEY=VALUE
            if "=" in line:
                key, _, value = line.partition("=")
                spectrum["metadata"][key.strip()] = value.strip()

        if spectrum["metadata"].get("NAME"):
            spectra.append(spectrum)

    return spectra


def _parse_csv() -> Dict[str, Dict]:
    """Read ECRFS_metadata_final.csv (semicolon-separated) keyed by lowercase name."""
    metadata: Dict[str, Dict] = {}
    with open(CSV_FILE, "r", encoding="utf-8-sig", errors="replace") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            name = (row.get("Name") or "").strip()
            if name:
                metadata[name.lower()] = {k.strip(): (v or "").strip() for k, v in row.items()}
    return metadata


def _strip_adduct(name: str) -> str:
    """Remove ion notation like '[M+H]+', '[M-H]-' from MGF compound names."""
    return re.sub(r"\s*\[M[+\-][^\]]+\][+\-]?\s*$", "", name).strip()


# ──────────────────────────────────────────────────────────────
#  Public API
# ──────────────────────────────────────────────────────────────

def get_library() -> List[Dict]:
    """
    Return merged library: MGF spectra + CSV metadata.
    Each item contains key fields for the Knowledge Base Explorer sidebar and info panel.
    """
    global _spectra_cache, _csv_cache, _library_cache

    if _library_cache is not None:
        return _library_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()
    if _csv_cache is None:
        _csv_cache = _parse_csv()

    library: List[Dict] = []
    for i, spectrum in enumerate(_spectra_cache):
        meta = spectrum["metadata"]
        mgf_name   = meta.get("NAME", f"Unknown_{i}")
        clean_name = _strip_adduct(mgf_name)
        csv_row    = _csv_cache.get(clean_name.lower(), {})

        # CAS: prefer CSV, fall back to MGF NOTES field (3rd colon-separated token)
        cas = csv_row.get("CAS_RN", "N/A")
        if not cas or cas == "N/A":
            notes = meta.get("NOTES", "")
            tokens = notes.split(":")
            if len(tokens) >= 3:
                candidate = tokens[2].strip()
                if re.match(r"\d+-\d+-\d+", candidate):
                    cas = candidate

        tox_score    = csv_row.get("EFSA Tox Score", "N/A")
        tox_rel      = csv_row.get("Reliability of Tox Score", "N/A")
        tox_endpoint = csv_row.get("Endpoint for basis of scoring ", "N/A")  # trailing space in header
        if not tox_endpoint or tox_endpoint == "N/A":
            tox_endpoint = csv_row.get("Endpoint for basis of scoring", "N/A")

        rt_raw = csv_row.get("Retention_time", "N/A")

        # Retention time: MGF RTINSECONDS is reliable (in seconds)
        rt = meta.get("RTINSECONDS", "N/A")

        library.append({
            "id":              i,
            "name":            clean_name,
            "mgf_name":        mgf_name,
            "formula":         csv_row.get("Molecular Formula", meta.get("FORMULA", "N/A")),
            "exact_mass":      meta.get("EXACTMASS", "N/A"),
            "smiles":          meta.get("SMILES", csv_row.get("SMILES", "N/A")),
            "inchikey":        meta.get("INCHI", csv_row.get("StdInChIKey", "N/A")),
            "cas":             cas,
            "pubchem":         csv_row.get("PubChem", "N/A"),
            "tox_score":       tox_score,
            "tox_reliability": tox_rel,
            "tox_endpoint":    tox_endpoint,
            "retention_time":  rt,
            "ionmode":         meta.get("IONMODE", "N/A"),
            "instrument":      meta.get("SOURCE_INSTRUMENT", meta.get("INSTRUMENT", "N/A")),
            "activation":      meta.get("ACTIVATION", "N/A"),
            "spectrum_quality": meta.get("LIBRARYQUALITY", "N/A"),
            "peak_count":      len(spectrum["peaks"]),
        })

    _library_cache = library
    return library


# ──────────────────────────────────────────────────────────────
#  Real Spec2Vec embeddings (pre-trained GNPS AllPositive model)
# ──────────────────────────────────────────────────────────────

SPEC2VEC_KV_PATH = DATASETS_DIR / "spec2vec_model" / "spec2vec_wv.kv"

_embeddings_3d_cache: Optional[List[Dict]] = None
_spec2vec_wv = None   # gensim KeyedVectors, loaded once


def _load_spec2vec_wv():
    """Load pre-trained Spec2Vec KeyedVectors (once per process)."""
    global _spec2vec_wv
    if _spec2vec_wv is not None:
        return _spec2vec_wv
    from gensim.models import KeyedVectors
    _spec2vec_wv = KeyedVectors.load(str(SPEC2VEC_KV_PATH), mmap="r")
    return _spec2vec_wv


def _spectrum_to_embedding(spectrum: Dict, intensity_power: float = 0.5) -> "np.ndarray":
    """
    Convert a spectrum to a 300-D Spec2Vec embedding using the pre-trained
    GNPS AllPositive model (Huber et al. 2021, Zenodo 4173596).

    Tokenisation: each peak becomes "peak@{mz:.2f}" — identical to the
    SpectrumDocument convention used during model training.
    Embedding: intensity-weighted average of token vectors (weight = intensity^power),
    then L2-normalised.  Peaks whose token is OOV are skipped.
    """
    import numpy as np

    wv   = _load_spec2vec_wv()
    dim  = wv.vector_size          # 300
    peaks = spectrum["peaks"]
    if not peaks:
        return np.zeros(dim)

    max_i = max(p["intensity"] for p in peaks) or 1.0
    vec   = np.zeros(dim, dtype=float)
    total_weight = 0.0

    for p in peaks:
        token  = f"peak@{p['mz']:.2f}"
        if token not in wv:
            continue
        weight = (p["intensity"] / max_i) ** intensity_power
        vec   += weight * wv[token]
        total_weight += weight

    if total_weight > 0:
        vec /= total_weight

    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec


def get_embedding(spectrum_id: int) -> Dict:
    """Return the 300-D pseudo-embedding for one spectrum."""
    import numpy as np
    global _spectra_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()
    if spectrum_id < 0 or spectrum_id >= len(_spectra_cache):
        raise ValueError(f"Spectrum ID {spectrum_id} out of range")

    vec = _spectrum_to_embedding(_spectra_cache[spectrum_id])
    return {"embedding": vec.tolist(), "dimensions": int(vec.shape[0])}


_pca_model_cache = None


def _get_pca():
    """Fit (once) and cache PCA on the 102 ECRFS embeddings."""
    import numpy as np
    from sklearn.decomposition import PCA
    global _pca_model_cache, _spectra_cache

    if _pca_model_cache is not None:
        return _pca_model_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    matrix = np.array([_spectrum_to_embedding(sp) for sp in _spectra_cache])
    pca = PCA(n_components=3, random_state=42)
    pca.fit(matrix)
    _pca_model_cache = pca
    return pca


def get_embeddings_3d() -> List[Dict]:
    """
    Return PCA-reduced 3-D coordinates for all 102 molecules.
    Cached after the first call.
    """
    import numpy as np
    global _spectra_cache, _embeddings_3d_cache

    if _embeddings_3d_cache is not None:
        return _embeddings_3d_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    pca    = _get_pca()
    matrix = np.array([_spectrum_to_embedding(sp) for sp in _spectra_cache])
    coords = pca.transform(matrix)

    library = get_library()
    result: List[Dict] = []
    for i, (c, mol) in enumerate(zip(coords, library)):
        result.append({
            "id":        i,
            "name":      mol["name"],
            "formula":   mol["formula"],
            "tox_score": mol["tox_score"],
            "x":         float(c[0]),
            "y":         float(c[1]),
            "z":         float(c[2]),
        })

    _embeddings_3d_cache = result
    return result


def project_query_to_3d(query_peaks: List[Dict], label: str = "Query") -> Dict:
    """
    Project a query MS2 spectrum into the ECRFS PCA 3-D space.
    Uses the same PCA model fitted on the 102 ECRFS embeddings so that
    query peaks land in the same coordinate frame as the library.
    """
    import numpy as np

    vec  = _spectrum_to_embedding({"peaks": query_peaks})
    pca  = _get_pca()
    coords = pca.transform(vec.reshape(1, -1))[0]
    return {
        "label": label,
        "x":     float(coords[0]),
        "y":     float(coords[1]),
        "z":     float(coords[2]),
    }


def get_all_embeddings() -> List[Dict]:
    """Return {id, name, formula, tox_score, embedding} for all 102 molecules."""
    global _spectra_cache
    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    library = get_library()
    result = []
    for i, (sp, mol) in enumerate(zip(_spectra_cache, library)):
        import numpy as np
        vec = _spectrum_to_embedding(sp)
        result.append({
            "id":        i,
            "name":      mol["name"],
            "formula":   mol["formula"],
            "tox_score": mol["tox_score"],
            "embedding": vec.tolist(),
        })
    return result


def list_libraries() -> List[Dict]:
    """List available spectral libraries (MGF + CSV pairs) in the datasets folder."""
    libs = []
    for mgf in sorted(DATASETS_DIR.glob("*.mgf")):
        # Look for a matching CSV (metadata file)
        csv_candidates = list(DATASETS_DIR.glob(f"*metadata*.csv"))
        libs.append({
            "id":           mgf.stem,
            "file":         mgf.name,
            "has_metadata": len(csv_candidates) > 0,
        })
    return libs


def list_chromatograms() -> List[str]:
    """List all .json chromatogram files in the neural_safety dataset folder."""
    return [f.name for f in sorted(DATASETS_DIR.glob("*.json"))]


def get_chromatogram(filename: str) -> Dict:
    """Return the parsed chromatogram JSON for a given filename."""
    path = DATASETS_DIR / filename
    if not path.exists() or path.suffix != ".json":
        raise ValueError(f"Chromatogram '{filename}' not found")
    import json as _json
    with open(path, "r", encoding="utf-8") as fh:
        return _json.load(fh)


# ──────────────────────────────────────────────────────────────
#  Real spectral matching — matchms ModifiedCosine
# ──────────────────────────────────────────────────────────────

def spectral_match(query_peaks: List[Dict], precursor_mz: float,
                   tolerance: float = 0.01, top_n: int = 10) -> List[Dict]:
    """
    Real spectral matching using matchms ModifiedCosine similarity against
    the 102-molecule ECRFS library.
    Returns top_n results sorted by similarity (descending).
    """
    import numpy as np
    from matchms import Spectrum
    from matchms.filtering import normalize_intensities
    from matchms.similarity import ModifiedCosine

    global _spectra_cache
    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    if not query_peaks:
        return []

    # Build matchms query Spectrum
    q_mz  = np.array([p["mz"]       for p in query_peaks], dtype=float)
    q_int = np.array([p["intensity"] for p in query_peaks], dtype=float)
    order = np.argsort(q_mz)
    query = Spectrum(mz=q_mz[order], intensities=q_int[order],
                     metadata={"precursor_mz": float(precursor_mz)})
    query = normalize_intensities(query)

    scorer  = ModifiedCosine(tolerance=tolerance)
    library = get_library()
    results = []

    for i, (spectrum, mol) in enumerate(zip(_spectra_cache, library)):
        lib_peaks = spectrum["peaks"]
        if not lib_peaks:
            continue

        l_mz  = np.array([p["mz"]       for p in lib_peaks], dtype=float)
        l_int = np.array([p["intensity"] for p in lib_peaks], dtype=float)
        order = np.argsort(l_mz)

        # Precursor m/z: PEPMASS field, else EXACTMASS + H
        pepmass_raw = spectrum["metadata"].get("PEPMASS", "")
        try:
            lib_prec = float(pepmass_raw.split()[0]) if pepmass_raw else 0.0
        except (ValueError, IndexError):
            lib_prec = 0.0
        if not lib_prec:
            try:
                lib_prec = float(spectrum["metadata"].get("EXACTMASS", 0)) + 1.007276
            except ValueError:
                lib_prec = 0.0

        lib_spec = Spectrum(mz=l_mz[order], intensities=l_int[order],
                            metadata={"precursor_mz": lib_prec})
        lib_spec = normalize_intensities(lib_spec)

        try:
            result = scorer.pair(query, lib_spec)
            r      = result.item()          # → (score, n_matches) tuple
            score, n_matches = float(r[0]), int(r[1])
        except Exception:
            score, n_matches = 0.0, 0

        results.append({
            "id":         i,
            "name":       mol["name"],
            "formula":    mol["formula"],
            "tox_score":  mol["tox_score"],
            "cas":        mol["cas"],
            "similarity": round(score, 4),
            "n_matches":  n_matches,
        })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_n]


# ──────────────────────────────────────────────────────────────
#  Anomaly detection — Local Outlier Factor on Spec2Vec space
# ──────────────────────────────────────────────────────────────

_lof_model        = None
_lof_calibration  = None   # {"p10": float, "p50": float}


def _get_lof_model():
    """Fit LOF on the 102 ECRFS Spec2Vec embeddings (once per process)."""
    global _lof_model, _lof_calibration, _spectra_cache
    import numpy as np
    from sklearn.neighbors import LocalOutlierFactor

    if _lof_model is not None:
        return _lof_model, _lof_calibration

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    matrix = np.array([_spectrum_to_embedding(sp) for sp in _spectra_cache])

    # novelty=True allows scoring new points without re-fitting
    lof = LocalOutlierFactor(n_neighbors=8, novelty=True, metric="cosine")
    lof.fit(matrix)

    # Calibrate: score_samples on training set gives us the "inlier baseline"
    train_scores    = lof.score_samples(matrix)
    _lof_calibration = {
        "p10": float(np.percentile(train_scores, 10)),
        "p50": float(np.percentile(train_scores, 50)),
    }
    _lof_model = lof
    return _lof_model, _lof_calibration


def anomaly_score(query_peaks: List[Dict]) -> Dict:
    """
    Compute a Novelty Score for a query spectrum using Local Outlier Factor
    fitted on the 102 ECRFS Spec2Vec embeddings.

    Returns:
      novelty_score   – [0, 1] – 0 = known class, 1 = structurally unknown
      lof_raw         – raw LOF score_samples value (diagnostic)
      level           – "low" | "medium" | "high"
      interpretation  – human-readable label
      max_similarity  – best cosine similarity against any ECRFS compound
      nearest         – top-5 nearest ECRFS compounds by cosine similarity
    """
    import numpy as np
    global _spectra_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    if not query_peaks:
        return {}

    query_vec  = _spectrum_to_embedding({"peaks": query_peaks})
    lof, cal   = _get_lof_model()
    lof_raw    = float(lof.score_samples(query_vec.reshape(1, -1))[0])

    # Normalise: p50 = typical inlier; further below p10 → higher novelty
    span         = max(1e-6, cal["p50"] - cal["p10"])
    novelty      = float(max(0.0, min(1.0, (cal["p50"] - lof_raw) / (3.0 * span))))

    # Nearest neighbours in Spec2Vec space
    library = get_library()
    sims    = sorted(
        [(float(np.dot(query_vec, _spectrum_to_embedding(sp))), i)
         for i, sp in enumerate(_spectra_cache)],
        reverse=True,
    )
    nearest = [
        {
            "id":         sims[j][1],
            "name":       library[sims[j][1]]["name"],
            "formula":    library[sims[j][1]]["formula"],
            "tox_score":  library[sims[j][1]]["tox_score"],
            "similarity": round(max(0.0, sims[j][0]), 4),
        }
        for j in range(min(5, len(sims)))
    ]

    if novelty < 0.25:
        level, interpretation = "low",    "Structurally known class"
    elif novelty < 0.60:
        level, interpretation = "medium", "Potentially novel structure"
    else:
        level, interpretation = "high",   "Unknown structure — manual review required"

    return {
        "novelty_score":  round(novelty, 4),
        "lof_raw":        round(lof_raw, 4),
        "max_similarity": round(max(0.0, sims[0][0]), 4) if sims else 0.0,
        "level":          level,
        "interpretation": interpretation,
        "nearest":        nearest,
    }


# ──────────────────────────────────────────────────────────────
#  Spec2Vec embedding similarity (AI-powered k-NN)
# ──────────────────────────────────────────────────────────────

def spec2vec_match(query_peaks: List[Dict], top_n: int = 10) -> List[Dict]:
    """
    Spec2Vec-style similarity search: cosine distance in 300-D embedding space.
    Converts query peaks to a 300-D pseudo-embedding and computes dot-product
    similarity against all 102 ECRFS library embeddings.
    Both vectors are L2-normalised, so dot product equals cosine similarity.
    Returns top_n results sorted by similarity (descending).
    """
    import numpy as np
    global _spectra_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    if not query_peaks:
        return []

    query_vec = _spectrum_to_embedding({"peaks": query_peaks})
    library   = get_library()
    results   = []

    for i, (sp, mol) in enumerate(zip(_spectra_cache, library)):
        lib_vec    = _spectrum_to_embedding(sp)
        similarity = float(np.dot(query_vec, lib_vec))
        results.append({
            "id":         i,
            "name":       mol["name"],
            "formula":    mol["formula"],
            "tox_score":  mol["tox_score"],
            "cas":        mol["cas"],
            "similarity": round(max(0.0, similarity), 4),
        })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_n]


# ──────────────────────────────────────────────────────────────
#  Spec2Vec broad index (MassBank Europe — official GitHub release)
# ──────────────────────────────────────────────────────────────

BROAD_INDEX_DIR    = DATASETS_DIR / "broad_index"
BROAD_VECTORS_PATH = BROAD_INDEX_DIR / "broad_vectors.npy"
BROAD_META_PATH    = BROAD_INDEX_DIR / "broad_metadata.pkl"

# MassBank Europe full release — NIST/MSP format (~125 MB), ~20k spectra.
# Fetched dynamically from the latest GitHub release tag.
MASSBANK_GITHUB_API = "https://api.github.com/repos/MassBank/MassBank-data/releases/latest"
MASSBANK_ASSET_NAME = "MassBank_NISTformat.msp"


def _get_massbank_download_url() -> str:
    """Fetch the download URL for the latest MassBank MSP release via GitHub API."""
    import urllib.request, json as _json
    req = urllib.request.Request(
        MASSBANK_GITHUB_API,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "videodemo"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = _json.loads(resp.read())
    for asset in data.get("assets", []):
        if asset["name"] == MASSBANK_ASSET_NAME:
            return asset["browser_download_url"]
    raise RuntimeError(f"Asset '{MASSBANK_ASSET_NAME}' not found in latest MassBank release.")

# In-process state
_broad_status: Dict = {
    "state":     "not_built",   # not_built | building | ready | error
    "progress":  0,             # 0-100
    "n_spectra": 0,
    "message":   "Index not built yet. POST /neural-safety/build-broad-index to start.",
    "error":     None,
}
_broad_vectors: Optional["np.ndarray"] = None
_broad_metadata: Optional[List[Dict]]  = None
_broad_lock = threading.Lock()


def get_broad_index_status() -> Dict:
    return dict(_broad_status)


def _load_broad_index_from_disk() -> bool:
    """Try to load a pre-built index from disk. Returns True on success."""
    import numpy as np
    import pickle
    global _broad_vectors, _broad_metadata, _broad_status

    if BROAD_VECTORS_PATH.exists() and BROAD_META_PATH.exists():
        try:
            vecs = np.load(str(BROAD_VECTORS_PATH))
            with open(BROAD_META_PATH, "rb") as fh:
                meta = pickle.load(fh)
            with _broad_lock:
                _broad_vectors = vecs
                _broad_metadata = meta
                _broad_status.update({
                    "state":     "ready",
                    "progress":  100,
                    "n_spectra": len(meta),
                    "message":   f"Index ready — {len(meta):,} spectra.",
                    "error":     None,
                })
            return True
        except Exception as exc:
            _broad_status.update({"state": "error", "error": str(exc)})
    return False


def _build_broad_index_worker() -> None:
    """Background thread: download MassBank MSP, embed with Spec2Vec, save index."""
    import numpy as np
    import pickle
    import urllib.request

    global _broad_vectors, _broad_metadata, _broad_status

    def _upd(**kw):
        with _broad_lock:
            _broad_status.update(kw)

    try:
        BROAD_INDEX_DIR.mkdir(parents=True, exist_ok=True)
        msp_path = BROAD_INDEX_DIR / MASSBANK_ASSET_NAME

        # ── Step 1: resolve download URL ───────────────────────────
        if not msp_path.exists():
            _upd(state="building", progress=1,
                 message="Fetching latest MassBank release info from GitHub…")
            url = _get_massbank_download_url()

            _upd(progress=2,
                 message="Downloading MassBank_NISTformat.msp (~125 MB)…")

            # Streaming download with progress
            with urllib.request.urlopen(url, timeout=120) as resp:
                total = int(resp.headers.get("Content-Length", 0))
                downloaded = 0
                chunk = 1 << 17   # 128 KB
                with open(msp_path, "wb") as fh:
                    while True:
                        buf = resp.read(chunk)
                        if not buf:
                            break
                        fh.write(buf)
                        downloaded += len(buf)
                        if total:
                            pct = 2 + int(8 * downloaded / total)
                            mb  = downloaded / 1_048_576
                            _upd(progress=pct,
                                 message=f"Downloading MassBank… {mb:.0f} MB / {total/1_048_576:.0f} MB")

        # ── Step 2: parse with matchms ─────────────────────────────
        _upd(progress=10, message="Parsing MSP with matchms…")
        from matchms.importing import load_from_msp
        spectra = list(load_from_msp(str(msp_path)))

        # Keep only positive mode spectra with at least 3 peaks and a name
        filtered = []
        for sp in spectra:
            if sp.peaks is None or len(sp.peaks.mz) < 3:
                continue
            ion_mode = (sp.metadata.get("ionmode") or "").upper()
            if ion_mode and ion_mode not in ("POSITIVE", "P", "+"):
                continue
            name = (sp.metadata.get("compound_name")
                    or sp.metadata.get("name")
                    or "").strip()
            if not name:
                continue
            filtered.append(sp)

        n = len(filtered)
        if n == 0:
            raise RuntimeError("No usable spectra found in downloaded MGF.")

        _upd(progress=15, message=f"Embedding {n:,} spectra — this takes 1–3 minutes…")

        # ── Step 3: embed ──────────────────────────────────────────
        vectors  = np.zeros((n, 300), dtype=np.float32)
        metadata = []
        batch    = 200

        for i, sp in enumerate(filtered):
            peaks_dicts = [
                {"mz": float(mz), "intensity": float(it)}
                for mz, it in zip(sp.peaks.mz, sp.peaks.intensities)
            ]
            vec = _spectrum_to_embedding({"peaks": peaks_dicts})
            vectors[i] = vec.astype(np.float32)

            name    = (sp.metadata.get("compound_name")
                       or sp.metadata.get("name") or "Unknown")
            formula = (sp.metadata.get("formula")
                       or sp.metadata.get("molecular_formula") or "N/A")
            inchikey = (sp.metadata.get("inchikey")
                        or sp.metadata.get("inchi_key") or "N/A")
            metadata.append({
                "id":       i,
                "name":     name,
                "formula":  formula,
                "inchikey": inchikey,
                "source":   "MassBank",
            })

            if (i + 1) % batch == 0:
                pct = 15 + int(80 * (i + 1) / n)
                _upd(progress=pct,
                     message=f"Embedding {i+1:,}/{n:,} spectra…")

        # ── Step 4: L2-normalise ───────────────────────────────────
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vectors /= norms

        # ── Step 5: save to disk ───────────────────────────────────
        _upd(progress=97, message="Saving index to disk…")
        np.save(str(BROAD_VECTORS_PATH), vectors)
        with open(BROAD_META_PATH, "wb") as fh:
            pickle.dump(metadata, fh)

        with _broad_lock:
            _broad_vectors  = vectors
            _broad_metadata = metadata
            _broad_status.update({
                "state":     "ready",
                "progress":  100,
                "n_spectra": n,
                "message":   f"Index ready — {n:,} spectra from MassBank.",
                "error":     None,
            })

    except Exception as exc:
        with _broad_lock:
            _broad_status.update({
                "state":   "error",
                "progress": 0,
                "message": f"Build failed: {exc}",
                "error":   str(exc),
            })
        # Remove partial download so a retry starts fresh
        partial = BROAD_INDEX_DIR / MASSBANK_ASSET_NAME
        if partial.exists():
            try:
                partial.unlink()
            except Exception:
                pass


def start_build_broad_index() -> Dict:
    """
    Start the background index-build thread if not already running/done.
    Returns current status immediately.
    """
    with _broad_lock:
        state = _broad_status["state"]

    if state == "ready":
        return get_broad_index_status()
    if state == "building":
        return get_broad_index_status()

    # Try loading from disk first (fast path after first build)
    if _load_broad_index_from_disk():
        return get_broad_index_status()

    # Launch background thread
    with _broad_lock:
        _broad_status.update({
            "state":    "building",
            "progress": 0,
            "message":  "Starting build…",
            "error":    None,
        })
    t = threading.Thread(target=_build_broad_index_worker, daemon=True)
    t.start()
    return get_broad_index_status()


def spec2vec_broad_match(query_peaks: List[Dict], top_n: int = 10) -> List[Dict]:
    """
    Spec2Vec similarity search against the broad MassBank index (~8-12k spectra).
    Requires the broad index to be built first (start_build_broad_index).
    Returns top_n results sorted by cosine similarity (descending).
    """
    import numpy as np

    if _broad_vectors is None or _broad_metadata is None:
        raise RuntimeError("Broad index not ready. Call /neural-safety/build-broad-index first.")

    if not query_peaks:
        return []

    query_vec = _spectrum_to_embedding({"peaks": query_peaks}).astype(np.float32)
    norm = float(np.linalg.norm(query_vec))
    if norm > 0:
        query_vec /= norm

    sims = (_broad_vectors @ query_vec).tolist()

    indexed = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)
    results = []
    seen_names: set = set()
    for idx, sim in indexed:
        if sim < 0:
            continue
        meta = _broad_metadata[idx]
        name_key = meta["name"].lower()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        results.append({
            "id":         meta["id"],
            "name":       meta["name"],
            "formula":    meta["formula"],
            "inchikey":   meta["inchikey"],
            "source":     meta["source"],
            "similarity": round(sim, 4),
        })
        if len(results) >= top_n:
            break

    return results


# Try loading a pre-built index at import time (non-blocking)
threading.Thread(target=_load_broad_index_from_disk, daemon=True).start()


# ──────────────────────────────────────────────────────────────
#  MassBank global spectral search
# ──────────────────────────────────────────────────────────────

MASSBANK_API = "https://massbank.eu/MassBank-api"


def massbank_search(
    query_peaks: List[Dict],
    precursor_mz: float,
    ion_mode: str = "POSITIVE",
    threshold: float = 0.5,
    top_n: int = 5,
) -> List[Dict]:
    """
    Search MassBank Europe for the top-N most similar MS2 spectra.
    Uses CosineGreedy (matchms) via the MassBank REST API.

    Returns a list of dicts with: accession, name, formula, mass, score.
    """
    import urllib.request
    import urllib.parse
    import json as _json

    if not query_peaks:
        return []

    # Normalise intensities to 0-999 (MassBank convention)
    max_i = max(p["intensity"] for p in query_peaks) or 1.0
    params = []
    for p in query_peaks:
        rel = round(p["intensity"] / max_i * 999)
        if rel > 10:
            mz_val = round(p["mz"], 4)
            params.append("peak_list=" + urllib.parse.quote(f"{mz_val};{rel}"))

    if not params:
        return []

    # Neutral mass from [M+H]+
    neutral_mass = precursor_mz - 1.007276

    query = (
        "&".join(params)
        + f"&peak_list_threshold={threshold}"
        + f"&ms_type=MS2&ion_mode={ion_mode.upper()}"
        + f"&exact_mass={neutral_mass:.4f}&mass_tolerance=0.05"
    )
    search_url = f"{MASSBANK_API}/records/search?{query}"

    try:
        req    = urllib.request.urlopen(search_url, timeout=15)
        hits   = _json.loads(req.read()).get("data", [])[:top_n]
    except Exception:
        return []

    results = []
    seen_names: set = set()
    for h in hits:
        try:
            req2 = urllib.request.urlopen(
                f"{MASSBANK_API}/records/{h['accession']}", timeout=10
            )
            rec  = _json.loads(req2.read())
            cmp  = rec.get("compound", {})
            names = cmp.get("names", [])
            name  = names[0] if names else "Unknown"
            # Skip duplicate compound names (same compound, different records)
            if name.lower() in seen_names:
                continue
            seen_names.add(name.lower())
            results.append({
                "accession": h["accession"],
                "name":      name,
                "formula":   cmp.get("formula", "N/A"),
                "mass":      cmp.get("mass", 0.0),
                "score":     round(h["score"], 4),
            })
            if len(results) >= top_n:
                break
        except Exception:
            continue

    return results


def get_spectrum(spectrum_id: int) -> Dict:
    """Return full peak list and raw metadata for a single spectrum by index."""
    global _spectra_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    if spectrum_id < 0 or spectrum_id >= len(_spectra_cache):
        raise ValueError(f"Spectrum ID {spectrum_id} is out of range (0–{len(_spectra_cache)-1})")

    spectrum = _spectra_cache[spectrum_id]
    return {
        "peaks":    spectrum["peaks"],
        "metadata": spectrum["metadata"],
    }
