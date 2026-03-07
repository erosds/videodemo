"""Generative NSGA-II for food aromatic compound design.

Objectives (all RF-predicted or RDKit-computed — no domain-shift issues):
  2-obj: maximise logD at pH 7.4 (ChEMBL Lipophilicity RF), minimise MW (RDKit)
  3-obj: same + maximise P(sweet) (FartDB RandomForest classifier)

logD at pH 7.4 is predicted by the ChEMBL Lipophilicity RandomForest model
(trained in the Property Prediction tab). Unlike Crippen logP, logD accounts
for ionisation at the relevant food-matrix pH, making it the correct descriptor
for oil-water partitioning of flavour compounds.

P(sweet) is predicted by the FartDB taste classifier (trained on demand in
the Property Prediction tab). The classifier was trained on sweet/bitter
compounds from a multi-source taste database; P(sweet) > 0.5 indicates a
sweet taste profile, relevant for vanilla-type flavourings.

Each generation:
  1. NSGA-II selection from current population.
  2. Each parent is mutated via SMARTS aromatic substituent reactions.
  3. Offspring are validated, featurised, and scored.
  4. Combined parent + offspring pool undergoes NSGA-II selection.

Generated compounds not present in the original PubChem pool are
identified by a PubChem InChIKey lookup (done asynchronously post-hoc
in the router for the final Pareto front only).
"""
from __future__ import annotations

import numpy as np
from typing import Any, Callable, Iterator


# ── Core NSGA-II primitives ────────────────────────────────────────────────────

def _fast_non_dominated_sort(F: np.ndarray) -> list[list[int]]:
    """Fast non-dominated sort (Deb et al. 2002). All objectives minimised."""
    n = len(F)
    dominated_by_count = np.zeros(n, dtype=int)
    dominates_set: list[list[int]] = [[] for _ in range(n)]

    for p in range(n):
        for q in range(n):
            if p == q:
                continue
            if np.all(F[p] <= F[q]) and np.any(F[p] < F[q]):
                dominates_set[p].append(q)
            elif np.all(F[q] <= F[p]) and np.any(F[q] < F[p]):
                dominated_by_count[p] += 1

    fronts: list[list[int]] = [[]]
    for p in range(n):
        if dominated_by_count[p] == 0:
            fronts[0].append(p)

    i = 0
    while i < len(fronts) and fronts[i]:
        next_front: list[int] = []
        for p in fronts[i]:
            for q in dominates_set[p]:
                dominated_by_count[q] -= 1
                if dominated_by_count[q] == 0:
                    next_front.append(q)
        i += 1
        if next_front:
            fronts.append(next_front)

    return [f for f in fronts if f]


def _crowding_distance(F: np.ndarray) -> np.ndarray:
    """Crowding distance for a set of solutions (one Pareto front)."""
    k, m = F.shape
    dist = np.zeros(k)
    if k <= 2:
        dist[:] = np.inf
        return dist
    for obj in range(m):
        order = np.argsort(F[:, obj])
        dist[order[0]] = np.inf
        dist[order[-1]] = np.inf
        f_min = F[order[0], obj]
        f_max = F[order[-1], obj]
        if f_max == f_min:
            continue
        for i in range(1, k - 1):
            dist[order[i]] += (F[order[i + 1], obj] - F[order[i - 1], obj]) / (f_max - f_min)
    return dist


def _nsga2_select(F: np.ndarray, pop_size: int) -> list[int]:
    """Select pop_size individuals via non-dominated rank + crowding distance."""
    fronts = _fast_non_dominated_sort(F)
    selected: list[int] = []
    for front in fronts:
        if len(selected) + len(front) <= pop_size:
            selected.extend(front)
        else:
            remaining = pop_size - len(selected)
            cd = _crowding_distance(F[front])
            order = np.argsort(-cd)
            selected.extend(front[k] for k in order[:remaining])
        if len(selected) >= pop_size:
            break
    return selected


# ── SMARTS aromatic mutation library ──────────────────────────────────────────
# Food-relevant aromatic substituent reactions.
# All reactions operate on a single aromatic ring.
# (SMIRKS string, label)
_AROMATIC_MUTATIONS: list[tuple[str, str]] = [
    # ── Single-atom/group additions ──
    ("[cH:1]>>[c:1][OH]",               "add-OH"),
    ("[cH:1]>>[c:1][O][CH3]",           "add-OMe"),
    ("[cH:1]>>[c:1][CH3]",              "add-Me"),
    ("[cH:1]>>[c:1][CH2][OH]",          "add-CH2OH"),
    ("[cH:1]>>[c:1]C(C)=O",             "add-acetyl"),        # methylketone, common food aroma
    ("[cH:1]>>[c:1]C(=O)OC",           "add-methylester"),   # methyl ester, food-relevant
    # ── Group interconversions ──
    ("[c:1][OH]>>[c:1][O][CH3]",        "OH→OMe"),
    ("[c:1][O][CH3]>>[c:1][OH]",        "OMe→OH"),
    ("[c:1][O][CH3]>>[c:1]OCC",         "OMe→OEt"),           # e.g. guaiacol→4-ethylguaiacol
    ("[c:1][CH3]>>[cH:1]",              "rm-Me"),
    ("[c:1][CH3]>>[c:1]CC",             "Me→Et"),             # methyl→ethyl homologation
    ("[c:1][CH]=O>>[c:1][CH2][OH]",     "CHO→CH2OH"),
    ("[c:1][CH2][OH]>>[c:1][CH]=O",     "CH2OH→CHO"),
    # ── Extended food / pigment relevance ──
    ("[cH:1]>>[c:1]CC=C(C)C",           "add-prenyl"),     # 3,3-dimethylallyl (prenyl) — NHDC-type
    ("[cH:1]>>[c:1]C(=O)O",             "add-COOH"),       # carboxylic acid substituent
    ("[c:1][OH]>>[c:1]OC(=O)C",         "OH→OAc"),         # O-acetylation of phenol
    ("[cH:1]>>[c:1]CC",                 "add-Et"),         # direct ethyl attachment
]

_compiled_reactions = None


def _get_reactions():
    """Lazily compile SMARTS reactions (requires RDKit)."""
    global _compiled_reactions
    if _compiled_reactions is not None:
        return _compiled_reactions
    from rdkit.Chem import AllChem
    compiled = []
    for smirks, label in _AROMATIC_MUTATIONS:
        try:
            rxn = AllChem.ReactionFromSmarts(smirks)
            if rxn is not None:
                compiled.append((rxn, label))
        except Exception:
            pass
    _compiled_reactions = compiled
    return _compiled_reactions


def _mutate_aromatic(smiles: str, rng: np.random.Generator, n_attempts: int = 8) -> list[str]:
    """Apply random SMARTS aromatic mutations; return valid unique products.

    MW filter: 60–350 Da (food-relevant aromatic range).
    Structural filter: must retain at least one aromatic ring.
    """
    from rdkit import Chem
    from rdkit.Chem import Descriptors

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return []

    reactions = _get_reactions()
    if not reactions:
        return []

    idxs = rng.choice(len(reactions), size=min(n_attempts, len(reactions)), replace=False)
    products: list[str] = []
    seen: set[str] = set()
    parent_canon = Chem.MolToSmiles(mol, canonical=True)

    for idx in idxs:
        rxn, _ = reactions[idx]
        try:
            raw_products = rxn.RunReactants((mol,))
        except Exception:
            continue
        for prod_tuple in raw_products:
            for prod_mol in prod_tuple:
                try:
                    Chem.SanitizeMol(prod_mol)
                    canon = Chem.MolToSmiles(prod_mol, canonical=True)
                    if canon in seen or canon == parent_canon:
                        continue
                    mw = Descriptors.ExactMolWt(prod_mol)
                    if not (60 <= mw <= 350):
                        continue
                    if not any(a.GetIsAromatic() for a in prod_mol.GetAtoms()):
                        continue
                    seen.add(canon)
                    products.append(canon)
                except Exception:
                    continue

    return products


# ── Public API ─────────────────────────────────────────────────────────────────


def iter_nsga2_generative(
    initial_pool: list[dict[str, Any]],
    logD_fn: Callable[[str], "float | None"],
    mw_fn:   Callable[[str], "float | None"],
    name_lookup: dict[str, dict],
    taste_fn: "Callable[[str], float | None] | None" = None,
    n_generations: int = 30,
    pop_size: int = 100,
    seed: int = 42,
) -> "Iterator[dict[str, Any]]":
    """Generator version of NSGA-II: yields one generation snapshot at a time.

    Yields dicts of the form::

        {'gen': 0, 'n_new': 0, 'n_evaluated': N,
         'candidates': [{'name', 'smiles', 'cid', 'logD', 'mw',
                         'psweet'(optional), 'dominated', 'is_new'}, ...]}
    """
    from rdkit import Chem

    rng = np.random.default_rng(seed)
    three_obj = taste_fn is not None

    def _canon(smiles: str) -> "str | None":
        mol = Chem.MolFromSmiles(smiles)
        return Chem.MolToSmiles(mol, canonical=True) if mol else None

    def _get_name_cid(canon: str) -> tuple[str, int | None]:
        info = name_lookup.get(canon)
        if info:
            return info["name"], info.get("cid")
        return "In silico candidate", None

    pool_size = min(pop_size, len(initial_pool))
    chosen_idxs = rng.choice(len(initial_pool), size=pool_size, replace=False)
    pop_smiles: list[str] = []
    for idx in chosen_idxs:
        c = initial_pool[int(idx)]
        canon = _canon(c["smiles"])
        if canon:
            pop_smiles.append(canon)

    all_evaluated: dict[str, dict] = {}

    def _evaluate_batch(smiles_list: list[str], is_new_flags: list[bool]) -> list[dict]:
        records = []
        for smi, is_new in zip(smiles_list, is_new_flags):
            if smi in all_evaluated:
                rec = dict(all_evaluated[smi])
                rec["is_new"] = is_new
                records.append(rec)
                continue
            logD = logD_fn(smi)
            mw   = mw_fn(smi)
            if logD is None or mw is None:
                continue
            name, cid = _get_name_cid(smi)
            rec: dict = {
                "name":   name,
                "smiles": smi,
                "cid":    cid,
                "logD":   round(logD, 3),
                "mw":     round(mw, 1),
                "is_new": is_new,
            }
            if three_obj:
                psweet = taste_fn(smi)
                rec["psweet"] = round(psweet, 3) if psweet is not None else 0.5
            all_evaluated[smi] = {k: v for k, v in rec.items() if k != "is_new"}
            records.append(rec)
        return records

    def _build_objectives(records: list[dict]) -> np.ndarray:
        if three_obj:
            return np.array([[-r["logD"], r["mw"], -(r.get("psweet") or 0.5)] for r in records])
        return np.array([[-r["logD"], r["mw"]] for r in records])

    def _normalise(F_raw: np.ndarray) -> np.ndarray:
        f_min = F_raw.min(axis=0)
        f_max = F_raw.max(axis=0)
        return (F_raw - f_min) / (f_max - f_min + 1e-9)

    init_flags = [False] * len(pop_smiles)
    pop_records = _evaluate_batch(pop_smiles, init_flags)

    for gen_idx in range(n_generations):

        F_raw = _build_objectives(pop_records)
        F_norm = _normalise(F_raw)
        fronts = _fast_non_dominated_sort(F_norm)
        pareto_set = set(fronts[0]) if fronts else set()

        snap_candidates = []
        for i, rec in enumerate(pop_records):
            entry = dict(rec)
            entry["dominated"] = (i not in pareto_set)
            snap_candidates.append(entry)

        n_new_this_gen = sum(1 for r in pop_records if r.get("is_new", False))
        yield {
            "gen":         gen_idx,
            "n_new":       n_new_this_gen,
            "n_evaluated": len(all_evaluated),
            "candidates":  snap_candidates,
        }

        if gen_idx == n_generations - 1:
            break

        selected_idxs = _nsga2_select(F_norm, pop_size)
        parents = [pop_records[i] for i in selected_idxs]

        offspring_smiles: list[str] = []
        for parent in parents:
            new_smi_list = _mutate_aromatic(parent["smiles"], rng, n_attempts=6)
            for smi in new_smi_list:
                if smi not in all_evaluated:
                    offspring_smiles.append(smi)
            if len(offspring_smiles) >= pop_size * 3:
                break

        seen_off: set[str] = set()
        unique_offspring: list[str] = []
        for s in offspring_smiles:
            if s not in seen_off:
                seen_off.add(s)
                unique_offspring.append(s)

        off_flags = [True] * len(unique_offspring)
        offspring_records = _evaluate_batch(unique_offspring, off_flags)

        combined = parents + offspring_records
        if len(combined) < 2:
            pop_records = parents
            continue

        F_combined = _build_objectives(combined)
        F_combined_norm = _normalise(F_combined)
        next_idxs = _nsga2_select(F_combined_norm, pop_size)
        pop_records = [combined[i] for i in next_idxs]

        parent_smiles_set = {p["smiles"] for p in parents}
        for rec in pop_records:
            rec["is_new"] = rec["smiles"] not in parent_smiles_set


def run_nsga2_generative(
    initial_pool: list[dict[str, Any]],
    logD_fn: Callable[[str], "float | None"],
    mw_fn:   Callable[[str], "float | None"],
    name_lookup: dict[str, dict],
    taste_fn: "Callable[[str], float | None] | None" = None,
    n_generations: int = 30,
    pop_size: int = 100,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Blocking wrapper: returns all generation snapshots as a list."""
    return list(iter_nsga2_generative(
        initial_pool=initial_pool,
        logD_fn=logD_fn,
        mw_fn=mw_fn,
        name_lookup=name_lookup,
        taste_fn=taste_fn,
        n_generations=n_generations,
        pop_size=pop_size,
        seed=seed,
    ))
