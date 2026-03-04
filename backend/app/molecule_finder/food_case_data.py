"""Reference compound for the vanillin-analog NSGA-II optimisation demo."""
from __future__ import annotations

REFERENCE_COMPOUND: dict = {
    "name": "Vanillin",
    "smiles": "COc1cc(C=O)ccc1O",
    "cas": "121-33-5",
    "e_number": "E1001",
    "description": (
        "Primary flavour compound in vanilla bean (Vanilla planifolia). "
        "Global production ~20,000 t/year (>85 % synthetic). "
        "Aqueous solubility ~10 g/L at 25 °C (logS ≈ −1.2 mol/L) — "
        "a limiting factor in clear-beverage and high-moisture food applications."
    ),
}
