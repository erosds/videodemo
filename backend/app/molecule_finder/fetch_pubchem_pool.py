"""One-time script to fetch ~400-500 food-grade aromatic compounds from PubChem.

Usage:
    cd backend
    python -m app.molecule_finder.fetch_pubchem_pool

Saves aromatic_pool.json next to this file.
"""
from __future__ import annotations

import json
import time
import sys
from pathlib import Path

import httpx

OUT_FILE = Path(__file__).parent / "aromatic_pool.json"

# Seed CIDs: Vanillin, Guaiacol, Eugenol, Benzaldehyde, Catechol
SEED_CIDS = [1183, 460, 3314, 240, 289]
SEED_NAMES = ["Vanillin", "Guaiacol", "Eugenol", "Benzaldehyde", "Catechol"]
SIMILARITY_THRESHOLD = 70
MW_MIN = 60.0
MW_MAX = 320.0

PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


def similarity_search(cid: int, threshold: int = 70) -> list[int]:
    """Return CIDs structurally similar to the seed (2D Tanimoto >= threshold)."""
    url = f"{PUBCHEM_BASE}/compound/fastsimilarity_2d/cid/{cid}/cids/JSON"
    params = {"Threshold": threshold, "MaxRecords": 200}
    try:
        r = httpx.get(url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        return data.get("IdentifierList", {}).get("CID", [])
    except Exception as e:
        print(f"  [warn] similarity search for CID {cid} failed: {e}")
        return []


def fetch_properties(cids: list[int]) -> list[dict]:
    """Batch fetch MolecularWeight, IUPACName, IsomericSMILES for a list of CIDs."""
    results = []
    batch_size = 100
    for i in range(0, len(cids), batch_size):
        batch = cids[i : i + batch_size]
        cid_str = ",".join(str(c) for c in batch)
        url = f"{PUBCHEM_BASE}/compound/cid/{cid_str}/property/MolecularWeight,IsomericSMILES,IUPACName,Title/JSON"
        try:
            r = httpx.get(url, timeout=30)
            r.raise_for_status()
            props = r.json().get("PropertyTable", {}).get("Properties", [])
            results.extend(props)
            print(f"    batch {i//batch_size+1}: {len(props)} props")
        except Exception as e:
            print(f"  [warn] property fetch for batch {i}–{i+batch_size} failed: {e}")
        time.sleep(0.25)
    return results


def has_aromatic_ring_heuristic(smiles: str) -> bool:
    """Heuristic: lowercase 'c' OR benzene-like Kekulé ring pattern."""
    if "c" in smiles:
        return True
    # Kekulé benzene pattern: ring with alternating single/double bonds
    # Simple proxy: SMILES contains a ring digit AND a double bond
    import re
    return bool(re.search(r"C1=C", smiles) or re.search(r"[cC]1", smiles))


def has_heavy_halogens(smiles: str) -> bool:
    """Exclude Cl, Br, I, F in uppercase context (not in ring notation)."""
    heavy = ["Cl", "Br", " I", "[I", "[Br", "[Cl", "[F"]
    return any(h in smiles for h in heavy)


def has_metals(smiles: str) -> bool:
    """Rough check for metal atoms by known metal element symbols."""
    metals = ["Fe", "Cu", "Zn", "Ni", "Co", "Mn", "Ca", "Na", "K", "Mg",
              "Al", "Si", "Pb", "Hg", "Cr", "Se", "As"]
    return any(m in smiles for m in metals)


def main():
    print("Collecting CIDs via similarity search …")
    all_cids: set[int] = set(SEED_CIDS)

    for cid, name in zip(SEED_CIDS, SEED_NAMES):
        print(f"  Seed: {name} (CID {cid})")
        similar = similarity_search(cid, SIMILARITY_THRESHOLD)
        print(f"    → {len(similar)} similar CIDs found")
        all_cids.update(similar)
        time.sleep(0.5)

    print(f"\nTotal unique CIDs before filtering: {len(all_cids)}")

    print("Fetching properties …")
    cid_list = sorted(all_cids)
    raw_props = fetch_properties(cid_list)
    print(f"  Got properties for {len(raw_props)} compounds")

    print("Applying filters …")
    try:
        from rdkit import Chem
        from rdkit.Chem import Descriptors
        RDKIT = True
        print("  RDKit available — using exact MW and aromaticity check")
    except ImportError:
        RDKIT = False
        print("  RDKit NOT available — using heuristic filters only")

    pool = []
    for p in raw_props:
        # PubChem returns key "SMILES" regardless of whether we requested IsomericSMILES
        smiles = p.get("IsomericSMILES", "") or p.get("SMILES", "") or p.get("CanonicalSMILES", "")
        if not smiles:
            continue
        mw = float(p.get("MolecularWeight", 0) or 0)

        # MW range filter
        if not (MW_MIN <= mw <= MW_MAX):
            continue

        # Heuristic aromatic ring check (pre-filter before RDKit)
        if not has_aromatic_ring_heuristic(smiles):
            continue

        # Heavy halogen exclusion
        if has_heavy_halogens(smiles):
            continue

        # Metal exclusion
        if has_metals(smiles):
            continue

        if RDKIT:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                continue
            # Check for aromatic ring using RDKit
            has_ring = any(atom.GetIsAromatic() for atom in mol.GetAtoms())
            if not has_ring:
                continue
            mw = round(Descriptors.MolWt(mol), 2)
            # Use canonical SMILES
            smiles = Chem.MolToSmiles(mol)

        iupac = p.get("IUPACName", "") or ""
        title = p.get("Title", "") or ""
        # Prefer common name (Title), fallback to IUPAC, then CID
        name = title if title else (iupac if iupac else f"CID-{p['CID']}")

        pool.append({
            "cid": p["CID"],
            "name": name,
            "smiles": smiles,
            "mw": round(mw, 2),
            "iupac": iupac,
            "title": title,
        })

    print(f"\nPool size after filtering: {len(pool)}")

    # Sort by CID for reproducibility
    pool.sort(key=lambda x: x["cid"])

    meta = {
        "source": "PubChem similarity search",
        "seeds": SEED_NAMES,
        "seed_cids": SEED_CIDS,
        "threshold": SIMILARITY_THRESHOLD,
        "mw_range": [MW_MIN, MW_MAX],
        "n_candidates": len(pool),
        "compounds": pool,
    }

    OUT_FILE.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"\nSaved {len(pool)} compounds to {OUT_FILE}")


if __name__ == "__main__":
    main()
