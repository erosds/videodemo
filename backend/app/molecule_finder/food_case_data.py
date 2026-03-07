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
            "FEMA GRAS 3107 · EU FL 04.002. Aqueous solubility log S ≈ −1.3 mol/L "
            "(moderately water-soluble), MW 152.15 Da. Used as reference for the "
            "solubility-guided NSGA-II run: candidates competing on logS ↑ + MW ↓."
        ),
    },
    "sweetness": {
        "name": "Homoeriodictyol",
        "smiles": "COc1cc(C2CC(=O)c3c(O)cc(O)cc3O2)ccc1O",
        "cid": 119258,
        "cas": "520-33-2",
        "description": (
            "Natural citrus flavanone (Eriodictyon californicum, Citrus sinensis). "
            "Sodium salt (HED-Na) approved by EFSA as Novel Food (2021) for use as a "
            "sweetness enhancer at 30–150 mg/kg. Amplifies sweetness of sucrose and "
            "stevia without contributing its own taste — enabling 20–50% sugar reduction "
            "in beverages, dairy, and confectionery."
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
