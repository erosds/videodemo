"""Candidate pool generator for MoleculeFinder use cases.

Three pools, each auto-generated from PubChem 2D-similarity searches seeded on
domain-specific reference compounds and validated with strict per-pool rules:

  druglike_pool.json  — Drug-like CNS compounds        (logD / SA-Score optimisation)
  sweetness_pool.json — Phenolic / flavonoid compounds  (sweetness enhancer discovery)
  colorant_pool.json  — Conjugated natural pigments     (colorant scaffold hopping)

Called automatically from candidate_pool.py when a pool file is absent.
To regenerate: delete the pool JSON file and restart the backend, or call
  generate_pool("<key>")   directly (key = "aromatic" | "sweetness" | "colorant").

Rule types
----------
  property  — physicochemical filter: mw_max, logp_max, hbd_max, hba_max, ring_min
  require   — SMARTS pattern that must match ≥1 time
  exclude   — SMARTS pattern that must not match
  sp2_min   — minimum sp2-atom fraction (heavy atoms); proxy for conjugation degree
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

_POOL_DIR = Path(__file__).parent
_PUBCHEM  = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

# ── Per-pool configuration ──────────────────────────────────────────────────────
# Each entry defines seeds, PubChem query parameters, and strict validation rules.
# Counts and descriptions propagate automatically from the generated JSON file —
# nothing here needs to be updated after a successful regeneration.

POOL_CONFIGS: dict[str, dict] = {

    # ── CNS lipophilicity-guided lead discovery ─────────────────────────────────
    "aromatic": {
        "file":        "druglike_pool.json",
        "source":      "PubChem 2D-similarity search",
        "description": "Drug-like CNS compounds for logD / SA-Score Pareto optimisation",
        "seeds": [
            {"name": "Diazepam",      "cid": 3016},
            {"name": "Lorazepam",     "cid": 3958},
            {"name": "Carbamazepine", "cid": 2554},
            {"name": "Haloperidol",   "cid": 3559},
            {"name": "Phenytoin",     "cid": 1775},
        ],
        "threshold":         70,    # Tanimoto 2D threshold (%)
        "max_hits_per_seed": 80,    # PubChem MaxRecords per seed query
        "mw_min":  150.0,
        "mw_max":  450.0,
        "target_n": 100,            # trim to this many after validation
        "rules": [
            # physicochemical (Lipinski-inspired)
            {"type": "property", "key": "logp_max",  "value": 5.0,
             "desc": "Lipinski logP ≤ 5"},
            {"type": "property", "key": "hbd_max",   "value": 5,
             "desc": "H-bond donors ≤ 5"},
            {"type": "property", "key": "hba_max",   "value": 10,
             "desc": "H-bond acceptors ≤ 10"},
            {"type": "property", "key": "ring_min",  "value": 2,
             "desc": "≥ 2 rings (CNS drugs typically have polycyclic scaffolds)"},
            # structural requirements
            {"type": "require", "smarts": "[#7]",
             "desc": "must contain nitrogen (virtually all CNS drugs)"},
            {"type": "require", "smarts": "a",
             "desc": "must contain at least one aromatic ring"},
            # structural exclusions — known intruder classes
            {"type": "exclude", "smarts": "[Cl,Br][CH2]C(=O)[NX3]",
             "desc": "chloroacetamide herbicides (acetochlor / alachlor / butachlor)"},
            {"type": "exclude", "smarts": "[Cl,Br][CX4](C(=O)[OX2H0])(c)c",
             "desc": "organochlorine ester acaricides (chlorobenzilate / chloropropylate)"},
            {"type": "exclude", "smarts": "[CX3;!R](~c)(~c)~c",
             "desc": "triarylmethane dye core (Crystal Violet / Malachite Green)"},
            {"type": "exclude", "smarts": "[F,Cl,Br,I][CH2]C(=O)N",
             "desc": "haloalkyl amide pattern (additional herbicide catch-all)"},
        ],
    },

    # ── Sweetness enhancer discovery ────────────────────────────────────────────
    "sweetness": {
        "file":        "sweetness_pool.json",
        "source":      "PubChem 2D-similarity search — dihydrochalcone / isocoumarin / flavanone scaffolds",
        "description": "Phenolic / flavonoid compounds for sweetness / logS / MW Pareto optimisation",
        "seeds": [
            {"name": "Phloretin",       "cid": 4788},
            {"name": "Phyllodulcin",    "cid": 442495},
            {"name": "Dihydrocoumarin", "cid": 660},
            {"name": "Hesperetin",      "cid": 72281},
            {"name": "NHDC",            "cid": 30231},
        ],
        "threshold":         65,
        "max_hits_per_seed": 150,
        "mw_min":  120.0,
        "mw_max":  500.0,
        "target_n": 325,
        "rules": [
            {"type": "property", "key": "logp_max",  "value": 5.5,
             "desc": "logP ≤ 5.5"},
            {"type": "property", "key": "hbd_max",   "value": 6,
             "desc": "H-bond donors ≤ 6"},
            {"type": "property", "key": "hba_max",   "value": 12,
             "desc": "H-bond acceptors ≤ 12"},
            {"type": "require", "smarts": "c[OH1]",
             "desc": "must have phenolic OH"},
            {"type": "require", "smarts": "a",
             "desc": "must contain an aromatic ring"},
            {"type": "exclude", "smarts": "[F,Cl,Br,I]",
             "desc": "no halogens (rare in natural sweet phenolics)"},
            {"type": "exclude", "smarts": "[nX2H0;!$(n1cccc1)]",
             "desc": "no pyridine-like aromatic N (unusual in flavonoids)"},
            {"type": "exclude", "smarts": "[#16]",
             "desc": "no sulfur (atypical in sweet phenolics)"},
            {"type": "exclude", "smarts": "[#14,Se,Te]",
             "desc": "no silicon / selenium / tellurium"},
        ],
    },

    # ── Colorant scaffold hopping ────────────────────────────────────────────────
    "colorant": {
        "file":        "colorant_pool.json",
        "source":      "PubChem 2D-similarity search — natural yellow/orange conjugated pigments",
        "description": "Natural conjugated pigments for colorant scaffold-hopping optimisation",
        "seeds": [
            {"name": "Quercetin",         "cid": 5280343},
            {"name": "Luteolin",          "cid": 5280445},
            {"name": "Isoliquiritigenin", "cid": 638278},
            {"name": "Aureusidin",        "cid": 5281680},
            {"name": "Curcumin",          "cid": 969516},
        ],
        "threshold":         55,
        "max_hits_per_seed": 50,
        "mw_min":  150.0,
        "mw_max":  600.0,
        "target_n": 70,
        "rules": [
            {"type": "property", "key": "logp_max",  "value": 6.0,
             "desc": "logP ≤ 6 (natural pigments can be somewhat hydrophobic)"},
            {"type": "property", "key": "hbd_max",   "value": 8,
             "desc": "H-bond donors ≤ 8"},
            {"type": "require", "smarts": "c[OH1]",
             "desc": "must have phenolic OH (natural polyphenol pigments)"},
            {"type": "require", "smarts": "a",
             "desc": "must contain an aromatic ring"},
            {"type": "require", "smarts": "[#6]=[#6]",
             "desc": "must have C=C double bond (chromophore conjugation)"},
            {"type": "sp2_min", "value": 0.35,
             "desc": "sp2-atom fraction ≥ 35 % (sufficient conjugation for colour)"},
            {"type": "exclude", "smarts": "[F,Cl,Br,I]",
             "desc": "no halogens (rare in natural plant pigments)"},
            {"type": "exclude", "smarts": "[#7]",
             "desc": "no nitrogen (yellow/orange plant pigments are N-free)"},
            {"type": "exclude", "smarts": "[#16]",
             "desc": "no sulfur"},
        ],
    },
}


# ── PubChem API helpers ─────────────────────────────────────────────────────────

def _fetch_similar_cids(cid: int, threshold: int, max_hits: int) -> list[int]:
    """Query PubChem fastsimilarity_2d and return matching CIDs."""
    import httpx
    url = (
        f"{_PUBCHEM}/compound/fastsimilarity_2d/cid/{cid}/cids/JSON"
        f"?Threshold={threshold}&MaxRecords={max_hits}"
    )
    for attempt in range(3):
        try:
            r = httpx.get(url, timeout=30, follow_redirects=True,
                          headers={"User-Agent": "MolFinderDemo/2.0"})
            if r.status_code == 200:
                return r.json().get("IdentifierList", {}).get("CID", [])
            if r.status_code == 404:
                return []          # no hits
        except Exception as e:
            logger.warning("PubChem similarity query attempt %d failed: %s", attempt + 1, e)
        time.sleep(1.0 * (attempt + 1))
    return []


def _fetch_properties(cids: list[int]) -> list[dict]:
    """Fetch SMILES + MW + IUPACName + Title for a batch of CIDs."""
    import httpx
    if not cids:
        return []
    result: list[dict] = []
    # PubChem allows up to ~200 CIDs per request
    for i in range(0, len(cids), 200):
        chunk = cids[i : i + 200]
        url = (
            f"{_PUBCHEM}/compound/cid/{','.join(str(c) for c in chunk)}"
            "/property/IsomericSMILES,CanonicalSMILES,MolecularWeight,IUPACName,Title/JSON"
        )
        for attempt in range(3):
            try:
                r = httpx.get(url, timeout=30, follow_redirects=True,
                              headers={"User-Agent": "MolFinderDemo/2.0"})
                if r.status_code == 200:
                    result.extend(
                        r.json().get("PropertyTable", {}).get("Properties", [])
                    )
                    break
            except Exception as e:
                logger.warning("PubChem property fetch attempt %d failed: %s", attempt + 1, e)
            time.sleep(1.0 * (attempt + 1))
        time.sleep(0.3)
    return result


# ── Per-rule validator ──────────────────────────────────────────────────────────

def _sp2_fraction(mol) -> float:
    from rdkit.Chem.rdchem import HybridizationType
    heavy = mol.GetNumHeavyAtoms()
    if heavy == 0:
        return 0.0
    sp2 = sum(1 for a in mol.GetAtoms()
              if a.GetHybridization() == HybridizationType.SP2)
    return sp2 / heavy


def _validate(mol, mw: float, rules: list[dict]) -> tuple[bool, str]:
    """Return (True, "") if mol passes all rules, else (False, reason)."""
    from rdkit.Chem import Descriptors, rdMolDescriptors

    # Compiled SMARTS cache (module-level, reused across calls)
    for rule in rules:
        rtype = rule["type"]

        if rtype == "property":
            key   = rule["key"]
            value = rule["value"]
            if key == "logp_max":
                if Descriptors.MolLogP(mol) > value:
                    return False, rule["desc"]
            elif key == "hbd_max":
                if Descriptors.NumHDonors(mol) > value:
                    return False, rule["desc"]
            elif key == "hba_max":
                if Descriptors.NumHAcceptors(mol) > value:
                    return False, rule["desc"]
            elif key == "ring_min":
                if rdMolDescriptors.CalcNumRings(mol) < value:
                    return False, rule["desc"]

        elif rtype == "require":
            from rdkit import Chem
            pat = Chem.MolFromSmarts(rule["smarts"])
            if pat is None:
                logger.warning("Invalid SMARTS (require): %s", rule["smarts"])
                continue
            if not mol.HasSubstructMatch(pat):
                return False, rule["desc"]

        elif rtype == "exclude":
            from rdkit import Chem
            pat = Chem.MolFromSmarts(rule["smarts"])
            if pat is None:
                logger.warning("Invalid SMARTS (exclude): %s", rule["smarts"])
                continue
            if mol.HasSubstructMatch(pat):
                return False, rule["desc"]

        elif rtype == "sp2_min":
            if _sp2_fraction(mol) < rule["value"]:
                return False, rule["desc"]

    return True, ""


# ── Core generation logic ───────────────────────────────────────────────────────

def generate_pool(key: str) -> None:
    """Generate pool JSON for the given config key and write it to disk.

    If the output file already exists it is overwritten.
    Raises RuntimeError if RDKit is unavailable or PubChem is unreachable.
    """
    if key not in POOL_CONFIGS:
        raise ValueError(f"Unknown pool key '{key}'. Valid keys: {list(POOL_CONFIGS)}")

    cfg = POOL_CONFIGS[key]
    out_path = _POOL_DIR / cfg["file"]

    logger.info("Generating pool '%s' → %s", key, out_path.name)

    # ── 1. Validate RDKit availability ─────────────────────────────────────
    try:
        from rdkit import Chem
        from rdkit import RDLogger
        RDLogger.DisableLog("rdApp.*")
    except ImportError as e:
        raise RuntimeError("RDKit is required for pool generation.") from e

    seed_cids = {s["cid"] for s in cfg["seeds"]}
    all_cids: set[int] = set(seed_cids)

    # ── 2. PubChem similarity queries ──────────────────────────────────────
    threshold        = cfg["threshold"]
    max_hits         = cfg["max_hits_per_seed"]

    for seed in cfg["seeds"]:
        hits = _fetch_similar_cids(seed["cid"], threshold, max_hits)
        logger.info("  seed %s (CID %d): %d hits", seed["name"], seed["cid"], len(hits))
        all_cids.update(hits)
        time.sleep(0.4)

    logger.info("Unique CIDs before validation: %d", len(all_cids))

    # ── 3. Fetch properties ────────────────────────────────────────────────
    raw_props = _fetch_properties(list(all_cids))
    logger.info("Properties fetched: %d", len(raw_props))

    # ── 4. Validate + deduplicate ──────────────────────────────────────────
    rules       = cfg["rules"]
    mw_min      = cfg["mw_min"]
    mw_max      = cfg["mw_max"]
    seen_smiles: set[str] = set()
    compounds:   list[dict] = []
    rejection_counts: dict[str, int] = {}

    for p in raw_props:
        cid   = int(p.get("CID", 0))
        smi   = (p.get("IsomericSMILES") or p.get("CanonicalSMILES") or
                 p.get("SMILES", ""))
        mw    = float(p.get("MolecularWeight") or 0)
        iupac = p.get("IUPACName", "")
        title = p.get("Title", "")
        name  = title or iupac or f"CID {cid}"

        # Basic guards
        if not smi:
            rejection_counts["no_smiles"] = rejection_counts.get("no_smiles", 0) + 1
            continue
        if not (mw_min <= mw <= mw_max):
            rejection_counts["mw_range"] = rejection_counts.get("mw_range", 0) + 1
            continue

        # Parse + canonicalise
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            rejection_counts["invalid_smiles"] = rejection_counts.get("invalid_smiles", 0) + 1
            continue
        canon = Chem.MolToSmiles(mol, canonical=True)

        if canon in seen_smiles:
            rejection_counts["duplicate"] = rejection_counts.get("duplicate", 0) + 1
            continue

        # Per-pool rule validation
        ok, reason = _validate(mol, mw, rules)
        if not ok:
            rejection_counts[reason] = rejection_counts.get(reason, 0) + 1
            continue

        seen_smiles.add(canon)
        compounds.append({
            "cid":   cid,
            "name":  name,
            "smiles": canon,
            "mw":    round(mw, 2),
            "iupac": iupac,
            "title": title,
        })

    # ── 5. Order: seeds first, then trim to target_n ───────────────────────
    target_n    = cfg.get("target_n", len(compounds))
    seeds_first = [c for c in compounds if c["cid"] in seed_cids]
    rest        = sorted(
        [c for c in compounds if c["cid"] not in seed_cids],
        key=lambda c: c["cid"],
    )
    final = seeds_first + rest[: max(0, target_n - len(seeds_first))]

    logger.info(
        "Pool '%s': %d seeds + %d others = %d final (target %d). "
        "Rejections: %s",
        key, len(seeds_first), len(rest), len(final), target_n, rejection_counts,
    )

    if len(final) < 10:
        raise RuntimeError(
            f"Pool generation for '{key}' produced only {len(final)} compounds "
            "(< 10 minimum). Check PubChem connectivity and seed CIDs."
        )

    # ── 6. Write JSON ──────────────────────────────────────────────────────
    payload = {
        "source":      cfg["source"],
        "description": cfg["description"],
        "seeds":       [s["name"] for s in cfg["seeds"]],
        "seed_cids":   [s["cid"]  for s in cfg["seeds"]],
        "threshold":   threshold,
        "mw_range":    [mw_min, mw_max],
        "n_candidates": len(final),
        "compounds":    final,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    logger.info("Pool '%s' written: %d compounds → %s", key, len(final), out_path)


def regenerate_all() -> None:
    """Regenerate all three pools (overwrites existing files)."""
    for key in POOL_CONFIGS:
        generate_pool(key)
