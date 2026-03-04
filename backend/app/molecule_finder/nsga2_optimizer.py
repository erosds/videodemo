"""Real generative NSGA-II on aromatic molecular structures.

Each generation:
  1. Parent population is selected via NSGA-II (non-dominated sort + crowding).
  2. Each parent is mutated via SMARTS-based aromatic substituent swaps (RDKit).
  3. Offspring are validated, featurised, and predicted with the RF model.
  4. Combined parent + offspring pool undergoes NSGA-II selection for next gen.

This produces genuinely novel molecules not present in the original pool.
"""
from __future__ import annotations

import numpy as np
from typing import Any, Callable


# ── Core NSGA-II primitives ────────────────────────────────────────────────────

def _fast_non_dominated_sort(F: np.ndarray) -> list[list[int]]:
    """Classic fast non-dominated sort from Deb et al. 2002.

    Args:
        F: (n, m) array of objective values — all objectives are MINIMISED.

    Returns:
        List of Pareto fronts (each front is a list of row indices into F).
        Front 0 is the Pareto-optimal set.
    """
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
    """Compute crowding distance for a set of solutions (one Pareto front)."""
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
    """Select pop_size individuals from F using non-dominated rank + crowding distance."""
    fronts = _fast_non_dominated_sort(F)
    selected: list[int] = []
    for front in fronts:
        if len(selected) + len(front) <= pop_size:
            selected.extend(front)
        else:
            remaining = pop_size - len(selected)
            F_front = F[front]
            cd = _crowding_distance(F_front)
            order = np.argsort(-cd)
            selected.extend(front[k] for k in order[:remaining])
        if len(selected) >= pop_size:
            break
    return selected


# ── SMARTS-based aromatic mutation ────────────────────────────────────────────

# Each entry: (SMIRKS string, label)
# Reactions transform one position on an aromatic ring at a time.
_AROMATIC_MUTATIONS: list[tuple[str, str]] = [
    ("[cH:1]>>[c:1][OH]",             "add-OH"),
    ("[cH:1]>>[c:1][O][CH3]",         "add-OMe"),
    ("[cH:1]>>[c:1][CH3]",            "add-Me"),
    ("[cH:1]>>[c:1][CH2][OH]",        "add-CH2OH"),
    ("[c:1][OH]>>[c:1][O][CH3]",      "OH→OMe"),
    ("[c:1][O][CH3]>>[c:1][OH]",      "OMe→OH"),
    ("[c:1][CH3]>>[cH:1]",            "rm-Me"),
    ("[c:1][CH]=O>>[c:1][CH2][OH]",   "CHO→CH2OH"),
    ("[c:1][CH2][OH]>>[c:1][CH]=O",   "CH2OH→CHO"),
]

_compiled_reactions = None  # lazily compiled


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


def _mutate_aromatic(smiles: str, rng: np.random.Generator, n_attempts: int = 6) -> list[str]:
    """Apply random SMARTS aromatic mutations to a SMILES; return valid unique products.

    Args:
        smiles:     Input SMILES string.
        rng:        NumPy random generator.
        n_attempts: Number of random reaction attempts.

    Returns:
        List of valid canonical SMILES for the generated offspring.
    """
    from rdkit import Chem
    from rdkit.Chem import Descriptors

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return []

    reactions = _get_reactions()
    if not reactions:
        return []

    # Shuffle reaction order for diversity
    idxs = rng.choice(len(reactions), size=min(n_attempts, len(reactions)), replace=False)

    products: list[str] = []
    seen: set[str] = set()

    for idx in idxs:
        rxn, _ = reactions[idx]
        try:
            raw_products = rxn.RunReactants((mol,))
        except Exception:
            continue

        # Flatten and validate each product
        for prod_tuple in raw_products:
            for prod_mol in prod_tuple:
                try:
                    Chem.SanitizeMol(prod_mol)
                    canon = Chem.MolToSmiles(prod_mol, canonical=True)
                    if canon in seen or canon == Chem.MolToSmiles(mol, canonical=True):
                        continue
                    # MW filter: food-relevant range
                    mw = Descriptors.ExactMolWt(prod_mol)
                    if not (60 <= mw <= 340):
                        continue
                    # Must still contain aromatic ring
                    if not any(a.GetIsAromatic() for a in prod_mol.GetAtoms()):
                        continue
                    seen.add(canon)
                    products.append(canon)
                except Exception:
                    continue

    return products


# ── Public API ─────────────────────────────────────────────────────────────────

def run_nsga2_generative(
    initial_pool: list[dict[str, Any]],
    rf_model: Any,
    featurize_fn: Callable[[str], "np.ndarray | None"],
    mw_fn: Callable[[str], "float | None"],
    name_lookup: dict[str, str],
    tanimoto_ref_smiles: "str | None" = None,
    compute_tanimoto_fn: "Callable | None" = None,
    n_generations: int = 8,
    pop_size: int = 30,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Generative NSGA-II: each generation mutates parents to create novel molecules.

    Args:
        initial_pool:        Seed compounds from the PubChem pool (dicts with 'name', 'smiles').
        rf_model:            Trained sklearn RF regressor (predicts logS).
        featurize_fn:        Maps SMILES → feature vector (or None on failure).
        mw_fn:               Maps SMILES → exact MW in Da (or None on failure).
        name_lookup:         {canonical_smiles: name} for pool compounds.
        tanimoto_ref_smiles: If given, adds 3rd objective (Tanimoto↑ to this reference).
        compute_tanimoto_fn: (list[smiles], ref_smiles) → np.ndarray of Tanimoto values.
        n_generations:       Number of NSGA-II generations.
        pop_size:            Working population size.
        seed:                Random seed for reproducibility.

    Returns:
        List of generation snapshots::

            [
              {
                "gen": 0,
                "n_new": 0,
                "n_evaluated": 30,
                "candidates": [{"name":…, "smiles":…, "logS":…, "mw":…,
                                "dominated": bool, "is_new": bool}, …]
              },
              …
            ]
    """
    from rdkit import Chem

    rng = np.random.default_rng(seed)
    analog_counter = [0]  # mutable counter for generated analogs

    def _canon(smiles: str) -> str | None:
        mol = Chem.MolFromSmiles(smiles)
        return Chem.MolToSmiles(mol, canonical=True) if mol else None

    def _get_name(canon: str) -> str:
        if canon in name_lookup:
            return name_lookup[canon]
        analog_counter[0] += 1
        return f"Analog-{analog_counter[0]:03d}"

    # Build initial pop from a random subset of the pool
    pool_size = min(pop_size, len(initial_pool))
    chosen_idxs = rng.choice(len(initial_pool), size=pool_size, replace=False)
    pop_smiles: list[str] = []
    for idx in chosen_idxs:
        c = initial_pool[int(idx)]
        canon = _canon(c["smiles"])
        if canon:
            pop_smiles.append(canon)

    # All smiles evaluated so far (deduplicated)
    all_evaluated: dict[str, dict] = {}  # canon_smiles → {name, logS, mw, tanimoto?}

    def _evaluate_batch(smiles_list: list[str], is_new_flags: list[bool]) -> list[dict]:
        """Featurise + RF-predict a batch; returns list of compound records."""
        records = []
        for smi, is_new in zip(smiles_list, is_new_flags):
            if smi in all_evaluated:
                rec = dict(all_evaluated[smi])
                rec["is_new"] = is_new
                records.append(rec)
                continue
            vec = featurize_fn(smi)
            mw  = mw_fn(smi)
            if vec is None or mw is None:
                continue
            logS = float(rf_model.predict(vec.reshape(1, -1))[0])
            rec = {
                "name":   _get_name(smi),
                "smiles": smi,
                "logS":   round(logS, 3),
                "mw":     round(mw, 1),
                "is_new": is_new,
            }
            all_evaluated[smi] = {k: v for k, v in rec.items() if k != "is_new"}
            records.append(rec)
        return records

    def _add_tanimoto(records: list[dict]) -> list[dict]:
        if tanimoto_ref_smiles is None or compute_tanimoto_fn is None:
            return records
        smi_list = [r["smiles"] for r in records]
        tani = compute_tanimoto_fn(smi_list, tanimoto_ref_smiles)
        for r, t in zip(records, tani):
            r["tanimoto"] = round(float(t), 3)
            # Back-fill into all_evaluated
            if r["smiles"] in all_evaluated:
                all_evaluated[r["smiles"]]["tanimoto"] = r["tanimoto"]
        return records

    def _build_objectives(records: list[dict]) -> np.ndarray:
        if tanimoto_ref_smiles is not None:
            return np.array([[-r["logS"], r["mw"], -(r.get("tanimoto") or 0.0)] for r in records])
        return np.array([[-r["logS"], r["mw"]] for r in records])

    def _normalise(F_raw: np.ndarray) -> np.ndarray:
        f_min = F_raw.min(axis=0)
        f_max = F_raw.max(axis=0)
        return (F_raw - f_min) / (f_max - f_min + 1e-9)

    # ── Gen 0: evaluate initial pop ───────────────────────────────────────────
    init_flags = [False] * len(pop_smiles)
    pop_records = _evaluate_batch(pop_smiles, init_flags)
    pop_records = _add_tanimoto(pop_records)

    generations: list[dict[str, Any]] = []

    for gen_idx in range(n_generations):
        gen_label = gen_idx * 10

        # ── Record ────────────────────────────────────────────────────────────
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
        generations.append({
            "gen":         gen_label,
            "n_new":       n_new_this_gen,
            "n_evaluated": len(all_evaluated),
            "candidates":  snap_candidates,
        })

        if gen_idx == n_generations - 1:
            break

        # ── NSGA-II selection: keep best pop_size from current pop ────────────
        selected_idxs = _nsga2_select(F_norm, pop_size)
        parents = [pop_records[i] for i in selected_idxs]

        # ── Mutation: generate offspring ───────────────────────────────────────
        offspring_smiles: list[str] = []
        for parent in parents:
            new_smi_list = _mutate_aromatic(parent["smiles"], rng, n_attempts=4)
            for smi in new_smi_list:
                if smi not in all_evaluated:
                    offspring_smiles.append(smi)
            # Cap total offspring to keep response size manageable
            if len(offspring_smiles) >= pop_size * 2:
                break

        # Remove duplicates while preserving order
        seen_off: set[str] = set()
        unique_offspring: list[str] = []
        for s in offspring_smiles:
            if s not in seen_off:
                seen_off.add(s)
                unique_offspring.append(s)

        # Evaluate offspring
        off_flags = [True] * len(unique_offspring)
        offspring_records = _evaluate_batch(unique_offspring, off_flags)
        offspring_records = _add_tanimoto(offspring_records)

        # ── Combine parents + offspring and NSGA-II select ────────────────────
        combined = parents + offspring_records
        if len(combined) < 2:
            pop_records = parents
            continue

        F_combined = _build_objectives(combined)
        F_combined_norm = _normalise(F_combined)
        next_idxs = _nsga2_select(F_combined_norm, pop_size)
        pop_records = [combined[i] for i in next_idxs]

        # Mark is_new based on whether compound was already in parents
        parent_smiles_set = {p["smiles"] for p in parents}
        for rec in pop_records:
            rec["is_new"] = rec["smiles"] not in parent_smiles_set

    return generations


# ── Legacy API (kept for backward-compat, wraps generative version) ────────────

def run_nsga2(
    library_compounds: list[dict[str, Any]],
    logS_predicted: np.ndarray,
    mw_values: np.ndarray,
    tanimoto_values: "np.ndarray | None" = None,
    n_generations: int = 8,
    pop_size: int = 22,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """Legacy selection-only NSGA-II (non-generative). Kept for reference."""
    rng = np.random.default_rng(seed)
    n = len(library_compounds)

    if tanimoto_values is not None:
        F_raw = np.column_stack([-logS_predicted, mw_values, -tanimoto_values])
    else:
        F_raw = np.column_stack([-logS_predicted, mw_values])

    f_min = F_raw.min(axis=0)
    f_max = F_raw.max(axis=0)
    F = (F_raw - f_min) / (f_max - f_min + 1e-9)

    initial_size = min(pop_size, n)
    pop: list[int] = rng.choice(n, size=initial_size, replace=False).tolist()
    all_seen: set[int] = set(pop)

    gen_labels = [i * 10 for i in range(n_generations)]
    generations: list[dict[str, Any]] = []

    for gen_idx, gen_label in enumerate(gen_labels):
        F_pop = F[pop]
        local_fronts = _fast_non_dominated_sort(F_pop)
        pareto_local: set[int] = set(local_fronts[0]) if local_fronts else set()

        candidates = []
        for local_i, global_i in enumerate(pop):
            c = library_compounds[global_i]
            entry: dict = {
                "name":      c["name"],
                "smiles":    c["smiles"],
                "logS":      round(float(logS_predicted[global_i]), 3),
                "mw":        round(float(mw_values[global_i]), 1),
                "dominated": local_i not in pareto_local,
                "is_new":    False,
            }
            if tanimoto_values is not None:
                entry["tanimoto"] = round(float(tanimoto_values[global_i]), 3)
            candidates.append(entry)
        generations.append({"gen": gen_label, "n_new": 0, "n_evaluated": n, "candidates": candidates})

        if gen_idx == n_generations - 1:
            break

        new_pop_global: list[int] = []
        for front in local_fronts:
            remaining = pop_size - len(new_pop_global)
            if remaining <= 0:
                break
            global_front = [pop[i] for i in front]
            if len(front) <= remaining:
                new_pop_global.extend(global_front)
            else:
                F_front = F[global_front]
                cd = _crowding_distance(F_front)
                order = np.argsort(-cd)
                new_pop_global.extend(global_front[k] for k in order[:remaining])

        n_explore = min(4 + gen_idx, n - len(all_seen))
        if n_explore > 0:
            unexplored = [i for i in range(n) if i not in all_seen]
            explore_idx = rng.choice(unexplored, size=n_explore, replace=False)
            new_pop_global.extend(int(i) for i in explore_idx)
            all_seen.update(int(i) for i in explore_idx)

        seen_in_pop: set[int] = set()
        pop = []
        for idx in new_pop_global:
            if idx not in seen_in_pop:
                seen_in_pop.add(idx)
                pop.append(idx)
        all_seen.update(pop)

    return generations
