"""Reference compounds for the three MoleculeFinder NSGA-II use cases."""
from __future__ import annotations

REFERENCE_COMPOUNDS: dict[str, dict] = {
    "solubility": {
        "name": "Diazepam",
        "smiles": "CN1C(=O)CN=C(c2ccccc2)c2cc(Cl)ccc21",
        "cid": 3016,
        "cas": "439-14-5",
        "description": (
            "Benzodiazepine anxiolytic (Valium, Roche 1963). "
            "MW 284.74 Da. Neutral compound: logD at pH 7.4 ≈ logP ≈ 2.82 "
            "(within the CNS-optimal window 1-3 for blood-brain barrier penetration), "
            "SA Score ≈ 2.1 (moderate synthetic complexity). "
            "Used as reference for the CNS lipophilicity-guided NSGA-II run: "
            "candidates compete on logD ↑ + SA Score ↓."
        ),
    },
    "sweetness": {
        "name": "Sucrose",
        "smiles": "OC[C@H]1O[C@@](CO)(O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@@H](O)[C@@H]1O",
        "cid": 5988,
        "cas": "57-50-1",
        "description": (
            "The canonical reference sweetener. Benchmark against which all sweetness "
            "intensity is measured (1× by definition). MW 342.30 Da, logS ≈ 0.0 mol/L "
            "(highly water-soluble). Used as reference for the sweetness-enhancer NSGA-II "
            "run: candidates compete on P(sweet) ↑ + MW ↓ + logS ↑."
        ),
    },
    "citrus": {
        "name": "p-Cymene",
        "smiles": "Cc1ccc(C(C)C)cc1",
        "cid": 7463,
        "cas": "99-87-6",
        "description": (
            "p-Cymene (4-isopropyltoluene) — the core aromatic monoterpene of citrus essential oils, "
            "present in lemon, orange, thyme and coriander. "
            "FEMA GRAS 2356, EU FL 01.016. "
            "Fully aromatic ring with no non-aromatic C=C bonds; high oxidation stability "
            "relative to aliphatic monoterpenes such as limonene. "
            "Reference for the citrus aroma NSGA-II run: "
            "candidates compete on P(citrus) ↑ + MW ↓ + oxidation stability ↑."
        ),
    },
}

# Backwards-compatibility alias
REFERENCE_COMPOUND: dict = REFERENCE_COMPOUNDS["sweetness"]
