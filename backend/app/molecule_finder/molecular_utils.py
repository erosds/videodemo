"""RDKit molecular utilities for MoleculeFinder.

All functions return None / empty dict on invalid SMILES rather than raising.
"""
from __future__ import annotations

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False


def smiles_to_mol(smiles: str):
    """Parse a SMILES string and return an RDKit Mol, or None if invalid."""
    if not RDKIT_AVAILABLE or not smiles:
        return None
    try:
        mol = Chem.MolFromSmiles(smiles.strip())
        return mol  # None if invalid
    except Exception:
        return None


def compute_properties(smiles: str) -> dict:
    """Compute basic molecular properties from SMILES.

    Returns a dict with mw, logp, hbd, hba, tpsa, rotatable_bonds.
    Returns empty dict on failure.
    """
    mol = smiles_to_mol(smiles)
    if mol is None:
        return {}
    try:
        return {
            "mw":               round(Descriptors.ExactMolWt(mol), 2),
            "logp":             round(Descriptors.MolLogP(mol), 2),
            "hbd":              rdMolDescriptors.CalcNumHBD(mol),
            "hba":              rdMolDescriptors.CalcNumHBA(mol),
            "tpsa":             round(Descriptors.TPSA(mol), 1),
            "rotatable_bonds":  rdMolDescriptors.CalcNumRotatableBonds(mol),
            "rings":            rdMolDescriptors.CalcNumRings(mol),
        }
    except Exception:
        return {}


def estimate_sa_score_proxy(smiles: str) -> float | None:
    """Proxy synthetic accessibility score (lower = easier to make).

    Uses ring count and chiral centres as simple heuristics.
    Returns None on failure.
    """
    mol = smiles_to_mol(smiles)
    if mol is None:
        return None
    try:
        n_rings   = rdMolDescriptors.CalcNumRings(mol)
        n_chiral  = len(Chem.FindMolChiralCenters(mol, includeUnassigned=True))
        mw        = Descriptors.ExactMolWt(mol)
        # Simple heuristic: base 1.5 + ring penalty + chiral penalty + size penalty
        score = 1.5 + n_rings * 0.25 + n_chiral * 0.35 + max(0, (mw - 200) / 200)
        return round(min(score, 5.0), 2)
    except Exception:
        return None


def validate_smiles(smiles: str) -> bool:
    """Return True if the SMILES is valid."""
    return smiles_to_mol(smiles) is not None


def ecfp4_bits(smiles: str, n_bits: int = 2048) -> list[int] | None:
    """Compute ECFP4 (radius=2) fingerprint as a list of 0/1 integers."""
    mol = smiles_to_mol(smiles)
    if mol is None:
        return None
    try:
        from rdkit.Chem import AllChem
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=n_bits)
        return list(fp)
    except Exception:
        return None
