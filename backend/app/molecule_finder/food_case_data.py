"""Reference compounds for the three MoleculeFinder NSGA-II use cases."""
from __future__ import annotations

REFERENCE_COMPOUNDS: dict[str, dict] = {
    "solubility": {
        "name": "Vanillin",
        "smiles": "COc1cc(C=O)ccc1O",
        "cid": 1183,
        "cas": "121-33-5",
        "description": (
            "Food-grade phenolic aldehyde (vanilla bean, Vanilla planifolia). "
            "FEMA GRAS 3107 · EU FL 04.002. logD at pH 7.4 ≈ 1.1 "
            "(moderately lipophilic), SA Score ≈ 1.0 (trivially synthesisable), "
            "MW 152.15 Da. Used as reference for the lipophilicity-guided NSGA-II "
            "run: candidates competing on logD ↑ + SA Score ↓."
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
    "colorant": {
        "name": "Curcumin",
        "smiles": "COc1cc(/C=C/C(=O)CC(=O)/C=C/c2ccc(O)c(OC)c2)ccc1O",
        "cid": 969516,
        "cas": "458-37-7",
        "description": (
            "Polyphenolic yellow pigment from Curcuma longa (turmeric). "
            "EU food colorant E100 (unrestricted use in most categories). "
            "Extensive conjugated system (β-diketone + two cinnamoyl arms) "
            "gives strong yellow-orange absorption (λmax ≈ 430 nm). "
            "Used as reference for the colorant scaffold-hopping run: "
            "candidates compete on conjugation score ↑ + MW ↓ + regulatory score ↑."
        ),
    },
}

# Backwards-compatibility alias
REFERENCE_COMPOUND: dict = REFERENCE_COMPOUNDS["sweetness"]
