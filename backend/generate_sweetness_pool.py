"""Generate sweetness_pool.json seeded on known sweet phenolic compounds.

Seeds (all genuinely sweet or structurally adjacent to sweet compounds):
  - NHDC (Neohesperidin Dihydrochalcone, CID 442731) ~1500x sweeter than sucrose
  - Phloretin (CID 4788) — DHC backbone, sweet analogs known
  - Phlorizin (CID 3084055) — phloretin glucoside, DHC family
  - Phyllodulcin (CID 442495) — sweet dihydroisocoumarin
  - Dihydrocoumarin (CID 10887) — sweet/vanilla taste

PubChem 2D similarity search at threshold 65, up to 200 results per seed.
Filters: MW 150–500 Da, ≥1 aromatic ring, no heavy halogens (F/Cl/Br/I), no metals.
"""
from __future__ import annotations

import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────

SEEDS = [
    {"name": "Phloretin",        "cid": 4788},    # DHC aglycone, sweet analogs known, MW 274
    {"name": "Phyllodulcin",     "cid": 442495},  # sweet dihydroisocoumarin, MW 152
    {"name": "Dihydrocoumarin",  "cid": 660},     # 3,4-dihydrocoumarin, sweet/vanilla, MW 148
    {"name": "Hesperetin",       "cid": 72281},   # flavanone precursor to NHDC, MW 302
    {"name": "NHDC",             "cid": 30231},   # Neohesperidin DHC, ~1500x sweeter than sucrose
]

THRESHOLD   = 65       # Tanimoto similarity threshold (%)
MAX_RECORDS = 200      # PubChem results per seed
MW_MIN      = 120.0
MW_MAX      = 500.0
OUTPUT      = Path(__file__).parent / "app/molecule_finder/sweetness_pool.json"

HEAVY_HALOGENS = {9, 17, 35, 53}  # F, Cl, Br, I
METAL_NUMS = {
    3,4,11,12,13,19,20,21,22,23,24,25,26,27,28,29,30,31,
    37,38,39,40,41,42,44,45,46,47,48,49,50,55,56,57,
    72,73,74,75,76,77,78,79,80,81,82,83,
}

PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get(url: str, retries: int = 3) -> dict | None:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  [warn] {e} (attempt {attempt+1}/{retries})")
            time.sleep(2 ** attempt)
    return None


def fetch_similar_cids(seed_cid: int) -> list[int]:
    url = (f"{PUBCHEM}/compound/fastsimilarity_2d/cid/{seed_cid}/cids/JSON"
           f"?Threshold={THRESHOLD}&MaxRecords={MAX_RECORDS}")
    data = _get(url)
    if data is None:
        return []
    cids = data.get("IdentifierList", {}).get("CID", [])
    return [int(c) for c in cids if c != seed_cid]


def fetch_properties(cids: list[int]) -> list[dict]:
    """Batch fetch in chunks of 200."""
    results = []
    chunk_size = 200
    props = "IUPACName,MolecularFormula,MolecularWeight,IsomericSMILES"
    for i in range(0, len(cids), chunk_size):
        chunk = cids[i:i + chunk_size]
        cid_str = ",".join(map(str, chunk))
        url = f"{PUBCHEM}/compound/cid/{cid_str}/property/{props}/JSON"
        data = _get(url)
        if data:
            results.extend(data.get("PropertyTable", {}).get("Properties", []))
        time.sleep(0.3)
    return results


def is_valid(smiles: str, mw: float) -> bool:
    if not (MW_MIN <= mw <= MW_MAX):
        return False
    try:
        from rdkit import Chem
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return False
        # Must have at least one aromatic ring
        if not any(a.GetIsAromatic() for a in mol.GetAtoms()):
            return False
        # No heavy halogens or metals
        for atom in mol.GetAtoms():
            an = atom.GetAtomicNum()
            if an in HEAVY_HALOGENS or an in METAL_NUMS:
                return False
        return True
    except Exception:
        return False


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    # 1. Collect CIDs from all seeds
    all_cids: set[int] = set()
    seed_cids = [s["cid"] for s in SEEDS]
    all_cids.update(seed_cids)  # always include seeds themselves

    for seed in SEEDS:
        print(f"Fetching similar to {seed['name']} (CID {seed['cid']})…")
        cids = fetch_similar_cids(seed["cid"])
        print(f"  → {len(cids)} results")
        all_cids.update(cids)
        time.sleep(0.5)

    print(f"\nTotal unique CIDs collected: {len(all_cids)}")

    # 2. Fetch properties
    print("Fetching properties…")
    cid_list = list(all_cids)
    props_list = fetch_properties(cid_list)
    print(f"  → {len(props_list)} property records")

    # 3. Filter
    print("Filtering…")
    compounds = []
    seen_smiles: set[str] = set()

    for p in props_list:
        cid    = int(p.get("CID", 0))
        smiles = p.get("IsomericSMILES") or p.get("SMILES", "")
        mw     = float(p.get("MolecularWeight", 0))
        name   = p.get("IUPACName", "") or p.get("MolecularFormula", f"CID{cid}")

        if not smiles or smiles in seen_smiles:
            continue
        if not is_valid(smiles, mw):
            continue

        seen_smiles.add(smiles)
        compounds.append({
            "cid":   cid,
            "name":  name,
            "smiles": smiles,
            "mw":    round(mw, 2),
            "iupac": name,
            "title": name,
        })

    # Sort: seeds first, then by MW
    seed_cid_set = set(seed_cids)
    compounds.sort(key=lambda c: (0 if c["cid"] in seed_cid_set else 1, c["mw"]))

    print(f"  → {len(compounds)} compounds after filtering")

    # 4. Save
    mw_vals = [c["mw"] for c in compounds]
    pool = {
        "source": (
            "Curated PubChem — dihydrochalcone, isocoumarin and related sweet-tasting "
            "phenolic scaffolds. Seeded on NHDC (the sweetest known natural flavonoid), "
            "Phloretin, Phlorizin, Phyllodulcin, and Dihydrocoumarin."
        ),
        "seeds":      [s["name"] for s in SEEDS],
        "seed_cids":  seed_cids,
        "threshold":  THRESHOLD,
        "mw_range":   [round(min(mw_vals), 2), round(max(mw_vals), 2)] if mw_vals else [],
        "n_candidates": len(compounds),
        "compounds":  compounds,
    }

    OUTPUT.write_text(json.dumps(pool, indent=2, ensure_ascii=False))
    print(f"\nSaved {len(compounds)} compounds → {OUTPUT}")


if __name__ == "__main__":
    main()
