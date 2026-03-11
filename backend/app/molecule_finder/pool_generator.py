"""Candidate pool generator for MoleculeFinder use cases.

Three pools, each auto-generated from PubChem 2D-similarity searches seeded on
domain-specific reference compounds and validated with strict per-pool rules:

  druglike_pool.json  — Drug-like CNS compounds        (logD / SA-Score optimisation)
  sweetness_pool.json — Sweet compounds (sugars, synthetic, semi-natural sweeteners)
  citrus_terpene_pool.json — Aromatic citrus flavour compounds (citrus aroma optimisation)

Called automatically from candidate_pool.py when a pool file is absent.
To regenerate: delete the pool JSON file and restart the backend, or call
  generate_pool("<key>")   directly (key = "cnsdrug" | "sweetness" | "citrus_terpene").

Rule types
----------
  property   — physicochemical filter: mw_max, logp_max, hbd_max, hba_max, ring_min
  require    — SMARTS pattern that must match ≥1 time
  exclude    — SMARTS pattern that must not match
  sp2_min    — minimum sp2-atom fraction (heavy atoms)
  rotb_max   — maximum rotatable bonds
  tpsa_max   — maximum topological polar surface area
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import os as _os

logger = logging.getLogger(__name__)

# Write generated pools to the same persistent volume path used by candidate_pool.py.
_VOLUME_BASE = Path(_os.environ.get("ML_DATASETS_DIR", "/app/datasets/molecule_finder"))
_POOL_DIR = _VOLUME_BASE / "pools"
_POOL_DIR.mkdir(parents=True, exist_ok=True)
_PUBCHEM  = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"

# ── Per-pool configuration ──────────────────────────────────────────────────────
# Each entry defines seeds, PubChem query parameters, and strict validation rules.
# Counts and descriptions propagate automatically from the generated JSON file —
# nothing here needs to be updated after a successful regeneration.

POOL_CONFIGS: dict[str, dict] = {

    # ── CNS lipophilicity-guided lead discovery ─────────────────────────────────
    "cnsdrug": {
        "file":        "druglike_pool.json",
        "source":      "PubChem 2D-similarity search",
        "description": "Drug-like CNS compounds for logD / SA-Score Pareto optimisation",
        "seeds": [
            {"name": "Diazepam",      "cid": 3016},
            {"name": "Lorazepam",     "cid": 3958},
            {"name": "Carbamazepine", "cid": 2554},
            {"name": "Alprazolam",    "cid": 2118},
        ],
        "threshold":         70,    # Tanimoto 2D threshold (%)
        "max_hits_per_seed": 80,    # PubChem MaxRecords per seed query
        "mw_min":  150.0,
        "mw_max":  450.0,
        "target_n": 100,            # trim to this many after validation
        "rules": [
            # ── physicochemical (CNS drug-like) ──

            {"type": "property", "key": "logp_max", "value": 5.0,
            "desc": "Lipinski logP ≤ 5"},

            {"type": "property", "key": "hbd_max", "value": 3,
            "desc": "H-bond donors ≤ 3 (CNS permeability)"},

            {"type": "property", "key": "hba_max", "value": 8,
            "desc": "H-bond acceptors ≤ 8"},

            {"type": "property", "key": "ring_min", "value": 2,
            "desc": "≥ 2 rings (CNS drugs typically polycyclic)"},

            {"type": "property", "key": "rotb_max", "value": 7,
            "desc": "rotatable bonds ≤ 7 (avoid floppy molecules)"},

            {"type": "property", "key": "tpsa_max", "value": 90,
            "desc": "TPSA ≤ 90 Å² (CNS penetration)"},

            # ── structural requirements ──

            # Ring nitrogen is the key discriminator: all CNS drugs (benzodiazepines,
            # hydantoins, barbiturates, succinimides, piperidines…) have at least one
            # N as part of a ring.  Urea, guanidine, diarylamine and azo dye backbones
            # have only exocyclic / acyclic N and are correctly excluded by this rule.
            {"type": "require", "smarts": "[#7;R]",
            "desc": "nitrogen must be in a ring (excludes ureas, guanidines, dyes)"},

            {"type": "require", "smarts": "a",
            "desc": "must contain aromatic ring"},

            # ── toxicophore removal ──

            {"type": "exclude", "smarts": "c[NH2]",
            "desc": "primary aniline (toxicity risk)"},

            # ── acyclic N-C(=O)-N backbone (urea / carbamate intruders) ──
            {"type": "exclude", "smarts": "[NX3;!R]C(=O)[NX3;!R]",
            "desc": "acyclic urea/carbamate backbone (herbicides, not CNS drugs)"},

            # ── unusual heavy elements ──
            {"type": "exclude", "smarts": "[#34,#14,#33,#51,#52]",
            "desc": "no Se / Si / As / Sb / Te"},

            # ── known intruder classes ──

            {"type": "exclude", "smarts": "[Cl,Br][CH2]C(=O)[NX3]",
            "desc": "chloroacetamide herbicides"},

            {"type": "exclude", "smarts": "[CX3;!R](~c)(~c)~c",
            "desc": "triarylmethane / cyanine dye core"},
        ],
    },

    # ── Sweetness discovery ──────────────────────────────────────────────────────
    "sweetness": {
        "file":        "sweetness_pool.json",
        "source":      "PubChem 2D-similarity search — known sweeteners (sugars, synthetic, semi-natural)",
        "description": "Sweet compounds for P(sweet) / logS / MW Pareto optimisation",
        "seeds": [
            {"name": "Glucose",    "cid": 5793},
            {"name": "Sucrose",    "cid": 5988},
            {"name": "Aspartame",  "cid": 134601},
            {"name": "Saccharin",  "cid": 5143},
            {"name": "Stevioside", "cid": 442089},
        ],
        "threshold":         60,   # lower threshold for diverse chemical classes
        "max_hits_per_seed": 150,
        "mw_min":  100.0,
        "mw_max":  600.0,
        "target_n": 300,
        "rules": [
            # Sweet molecules are chemically diverse — rules are kept permissive.
            # MW range is the primary filter; standard Lipinski limits clean out outliers.
            {"type": "property", "key": "logp_max",  "value": 6.0,
             "desc": "logP ≤ 6 (sweeteners tend to be water-soluble)"},
            {"type": "property", "key": "hbd_max",   "value": 12,
             "desc": "H-bond donors ≤ 12 (sugars have many OH)"},
            {"type": "property", "key": "hba_max",   "value": 15,
             "desc": "H-bond acceptors ≤ 15"},
            {"type": "exclude", "smarts": "[#14,Se,Te,#33,#51]",
             "desc": "no Si / Se / Te / As / Sb"},
        ],
    },

    # ── Citrus aroma discovery ───────────────────────────────────────────────────
    "citrus_terpene": {
        "file":        "citrus_terpene_pool.json",
        "source":      "PubChem 2D-similarity search — terpene citrus flavour compounds",
        "description": (
            "Terpene-based food-grade citrus flavour compounds for "
            "P(citrus) / MW / oxidation-stability Pareto optimisation. "
            "Seeds: Limonene, Linalool, Geraniol, Citral, gamma-Terpinene — "
            "dominant aroma compounds of citrus essential oils."
        ),
        "seeds": [
            {"name": "Limonene",        "cid": 440917},  # lemon/orange — #1 citrus terpene
            {"name": "Linalool",        "cid": 6549},    # floral-citrus, bergamot/coriander
            {"name": "Geraniol",        "cid": 637566},  # rose-citrus, neroli/lemongrass
            {"name": "Citral",          "cid": 638011},  # lemon aldehyde (geranial+neral)
            {"name": "gamma-Terpinene", "cid": 7461},    # citrus peel, key in lemon/lime
        ],
        "threshold":         62,   # leggermente più basso per catturare terpeni simili
        "max_hits_per_seed": 150,
        "mw_min":  100.0,
        "mw_max":  280.0,          # allargato per includere sesquiterpeni e esteri terpenici
        "target_n": 100,
        "rules": [
            # ── fisico-chimica (volatilità food-grade) ──
            {"type": "property", "key": "logp_max", "value": 5.0,
            "desc": "logP ≤ 5.0 (volatilità e solubilità in matrici cibo)"},
            {"type": "property", "key": "logp_min", "value": 1.5,
            "desc": "logP ≥ 1.5 (esclude zuccheri e amminoacidi)"},
            {"type": "property", "key": "hbd_max",  "value": 2,
            "desc": "H-bond donors ≤ 2"},
            {"type": "property", "key": "hba_max",  "value": 4,
            "desc": "H-bond acceptors ≤ 4"},
            {"type": "property", "key": "rotb_max", "value": 8,
            "desc": "rotatable bonds ≤ 8 (terpeni e loro esteri)"},

            # ── sicurezza alimentare ──
            {"type": "exclude", "smarts": "[F,Cl,Br,I]",
            "desc": "no alogeni"},
            {"type": "exclude", "smarts": "[#16]",
            "desc": "no zolfo"},
            {"type": "exclude", "smarts": "OO",
            "desc": "no perossidi"},
            {"type": "exclude", "smarts": "[#34,#14,#33,#51,#52]",
            "desc": "no metalloidi"},

            # ── esclusione farmaci e tossici ──
            # PAH: pattern per naftalene fuso (esclude naftaleni, antraceni, fluoreni)
            {"type": "exclude", "smarts": "c1ccc2ccccc2c1",
            "desc": "no naftaleni e PAH"},
            # Chinoni reattivi
            {"type": "exclude", "smarts": "O=C1C=CC(=O)c2ccccc12",
            "desc": "no naftochinoni"},
            {"type": "exclude", "smarts": "O=C1c2ccccc2C(=O)C1",
            "desc": "no o-chinoni reattivi"},
            # Steroidi
            {"type": "exclude", "smarts": "[C@H]1CC[C@@H]2[C@@H]1CC[C@H]3[C@H]2CCC4CCCC[C@H]34",
            "desc": "no steroidi"},
            # Farmaci NSAID (acido arilpropinoico)
            {"type": "exclude", "smarts": "c1ccc(cc1)[C@@H](C)C(=O)O",
            "desc": "no NSAID (ibuprofene/naprossene-like)"},
            # Indenoni anticoagulanti
            {"type": "exclude", "smarts": "O=C1c2ccccc2CC1",
            "desc": "no indenoni (fenindione/pindone)"},
            # Safrolo (proibito)
            {"type": "exclude", "smarts": "C=CCc1ccc2c(c1)OCO2",
            "desc": "safrole — vietato come aroma alimentare"},
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
            elif key == "logp_min":
                if Descriptors.MolLogP(mol) < value:
                    return False, rule["desc"]
            elif key == "ring_min":
                if rdMolDescriptors.CalcNumRings(mol) < value:
                    return False, rule["desc"]
            elif key == "rotb_max":
                if rdMolDescriptors.CalcNumRotatableBonds(mol) > value:
                    return False, rule["desc"]
            elif key == "tpsa_max":
                if rdMolDescriptors.CalcTPSA(mol) > value:
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
        from rdkit.Chem.Scaffolds import MurckoScaffold
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
    scaffold_counts: dict[str, int] = {}
    MAX_PER_SCAFFOLD = 3

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

        # ── scaffold detection ──
        try:
            scaffold = MurckoScaffold.MurckoScaffoldSmiles(mol=mol)
        except Exception:
            scaffold = ""

        if canon in seen_smiles:
            rejection_counts["duplicate"] = rejection_counts.get("duplicate", 0) + 1
            continue

        # ── scaffold diversity filter ──
        if scaffold:
            if scaffold_counts.get(scaffold, 0) >= MAX_PER_SCAFFOLD:
                rejection_counts["scaffold_limit"] = rejection_counts.get("scaffold_limit", 0) + 1
                continue

        # Per-pool rule validation
        ok, reason = _validate(mol, mw, rules)
        if not ok:
            rejection_counts[reason] = rejection_counts.get(reason, 0) + 1
            continue

        if scaffold:
            scaffold_counts[scaffold] = scaffold_counts.get(scaffold, 0) + 1

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
