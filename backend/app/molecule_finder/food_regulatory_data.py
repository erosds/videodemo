"""Food flavouring regulatory data.

Two independent regulatory frameworks are covered:
  - FEMA GRAS (US Flavor and Extract Manufacturers Association)
  - EU Regulation EC 1334/2008 — Union List of Flavouring Substances (Annex I)

Keyed by PubChem CID (int). Each entry has:
  name        — preferred IUPAC / common name
  cas         — CAS registry number
  fema        — FEMA GRAS number (int) or None if not listed
  eu_fl       — EU FL number string (e.g. "05.025") or None if not listed
  status      — "approved" | "restricted" | "banned" | "not_evaluated"
  max_use_ppm — max use level in ppm/mg/kg if restricted (in food generally), else None
  restriction — plain-language restriction note or None

Status definitions:
  approved       — approved by both FEMA and EU with no general use limits
  restricted     — approved but with specific maximum use levels or conditions
  banned         — not permitted in food (e.g. safrole, β-asarone)
  not_evaluated  — not found in either list (default for unlisted compounds)

Sources:
  FEMA GRAS list: https://www.femaflavor.org/flavor-library
  EU 1334/2008 Annex I: OJ L 354, 31.12.2008, updated through 2024
  Scientific Committee on Food (SCF) and EFSA opinions where cited
"""
from __future__ import annotations

# ── Main regulatory registry (keyed by PubChem CID) ──────────────────────────

REGULATORY: dict[int, dict] = {

    # ── Approved — no general use limits ──────────────────────────────────────

    1183: {
        "name": "Vanillin",
        "cas": "121-33-5",
        "fema": 3107,
        "eu_fl": "05.025",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    14860: {
        "name": "Ethylvanillin",
        "cas": "121-32-4",
        "fema": 2464,
        "eu_fl": "05.022",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    463: {
        "name": "Guaiacol",
        "cas": "90-05-1",
        "fema": 2532,
        "eu_fl": "04.016",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    3314: {
        "name": "Eugenol",
        "cas": "97-53-0",
        "fema": 2467,
        "eu_fl": "04.053",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    240: {
        "name": "Benzaldehyde",
        "cas": "100-52-7",
        "fema": 2127,
        "eu_fl": "05.007",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    289: {
        "name": "Catechol",
        "cas": "120-80-9",
        "fema": 2345,
        "eu_fl": "04.012",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    999: {
        "name": "Piperonal",
        "cas": "120-57-0",
        "fema": 2911,
        "eu_fl": "05.048",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    126: {
        "name": "4-Hydroxybenzaldehyde",
        "cas": "123-08-0",
        "fema": 3984,
        "eu_fl": "05.059",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    31244: {
        "name": "4-Methoxybenzaldehyde",
        "cas": "123-11-5",
        "fema": 2670,
        "eu_fl": "05.021",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    637511: {
        "name": "Cinnamaldehyde",
        "cas": "104-55-2",
        "fema": 2286,
        "eu_fl": "05.016",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    6054: {
        "name": "2-Phenylethanol",
        "cas": "60-12-8",
        "fema": 2858,
        "eu_fl": "02.041",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    244: {
        "name": "Benzyl Alcohol",
        "cas": "100-51-6",
        "fema": 2137,
        "eu_fl": "02.019",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    998: {
        "name": "Phenylacetaldehyde",
        "cas": "122-78-1",
        "fema": 2874,
        "eu_fl": "05.038",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    10834: {
        "name": "4-Methylguaiacol",
        "cas": "93-51-6",
        "fema": 2671,
        "eu_fl": "04.022",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    31419: {
        "name": "4-Ethylguaiacol",
        "cas": "2785-89-9",
        "fema": 2436,
        "eu_fl": "04.025",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    7410: {
        "name": "Acetophenone",
        "cas": "98-86-2",
        "fema": 2009,
        "eu_fl": "07.004",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    7150: {
        "name": "Methyl Benzoate",
        "cas": "93-58-3",
        "fema": 2683,
        "eu_fl": "09.018",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    4133: {
        "name": "Methyl Salicylate",
        "cas": "119-36-8",
        "fema": 2745,
        "eu_fl": "09.042",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    444539: {
        "name": "trans-Cinnamic Acid",
        "cas": "140-10-3",
        "fema": 2288,
        "eu_fl": "08.016",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    8468: {
        "name": "Vanillic Acid",
        "cas": "121-34-6",
        "fema": 3108,
        "eu_fl": "08.066",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    445858: {
        "name": "Ferulic Acid",
        "cas": "1135-24-6",
        "fema": 2489,
        "eu_fl": "08.056",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    12111: {
        "name": "Syringaldehyde",
        "cas": "134-96-3",
        "fema": 4280,
        "eu_fl": "05.149",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    12113: {
        "name": "3,4-Dimethoxybenzaldehyde",
        "cas": "120-14-9",
        "fema": 3459,
        "eu_fl": "05.080",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    6989: {
        "name": "Thymol",
        "cas": "89-83-8",
        "fema": 3064,
        "eu_fl": "04.042",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    10364: {
        "name": "Carvacrol",
        "cas": "499-75-2",
        "fema": 2245,
        "eu_fl": "04.041",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    6549: {
        "name": "Linalool",
        "cas": "78-70-6",
        "fema": 2635,
        "eu_fl": "02.102",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    5702565: {
        "name": "Benzyl Acetate",
        "cas": "140-11-4",
        "fema": 2135,
        "eu_fl": "09.006",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    1549778: {
        "name": "Phenylacetic Acid",
        "cas": "103-82-2",
        "fema": 2878,
        "eu_fl": "08.034",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    2586: {
        "name": "Protocatechuic Aldehyde",
        "cas": "139-85-5",
        "fema": 2381,
        "eu_fl": "05.069",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    2723633: {
        "name": "Isoeugenol",
        "cas": "97-54-1",
        "fema": 2468,
        "eu_fl": "04.057",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": "FEMA GRAS for food; note: restricted by IFRA for cosmetic use (skin sensitizer). Food use unaffected.",
    },
    3314: {
        "name": "Eugenol",
        "cas": "97-53-0",
        "fema": 2467,
        "eu_fl": "04.053",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    72433: {
        "name": "4-Vinylguaiacol",
        "cas": "7786-61-0",
        "fema": 2675,
        "eu_fl": "04.073",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    10748: {
        "name": "Homoveratrole",
        "cas": "93-03-8",
        "fema": None,
        "eu_fl": None,
        "status": "not_evaluated",
        "max_use_ppm": None,
        "restriction": None,
    },
    3122: {
        "name": "Indole",
        "cas": "120-72-9",
        "fema": 2593,
        "eu_fl": "14.002",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": "FEMA GRAS at typical use levels; characteristic of jasmine and some fermented foods.",
    },
    554917: {
        "name": "Isovanillin",
        "cas": "621-59-0",
        "fema": None,
        "eu_fl": None,
        "status": "not_evaluated",
        "max_use_ppm": None,
        "restriction": None,
    },
    11597: {
        "name": "2-Hydroxybenzaldehyde",
        "cas": "90-02-8",
        "fema": 3127,
        "eu_fl": "05.064",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },
    101: {
        "name": "3-Hydroxybenzaldehyde",
        "cas": "100-83-4",
        "fema": 3128,
        "eu_fl": "05.063",
        "status": "approved",
        "max_use_ppm": None,
        "restriction": None,
    },

    # ── Restricted — approved but with use limits ─────────────────────────────

    323: {
        "name": "Coumarin",
        "cas": "91-64-5",
        "fema": None,
        "eu_fl": None,
        "status": "restricted",
        "max_use_ppm": 2,
        "restriction": (
            "EU: max 2 mg/kg in most foods (Regulation EC 1334/2008, Annex III part A). "
            "Higher limits for seasonal beverages (10 mg/kg) and traditional baked goods. "
            "Not FEMA GRAS. Hepatotoxic at high doses."
        ),
    },
    7144: {
        "name": "Methyl Eugenol",
        "cas": "93-15-2",
        "fema": None,
        "eu_fl": None,
        "status": "restricted",
        "max_use_ppm": 0.002,
        "restriction": (
            "EU: max 0.002 mg/kg in food (Regulation EC 1334/2008, Annex III). "
            "Not FEMA GRAS. Known genotoxic compound (EFSA 2019). Use only as naturally present at trace levels."
        ),
    },
    8815: {
        "name": "Estragole",
        "cas": "140-67-0",
        "fema": None,
        "eu_fl": None,
        "status": "restricted",
        "max_use_ppm": 0.05,
        "restriction": (
            "EU: max 0.05 mg/kg in food. Not FEMA GRAS for direct addition. "
            "Possibly genotoxic/carcinogenic (EFSA 2001). Only acceptable as naturally present in herbs/spices."
        ),
    },
    442495: {
        "name": "Pulegone",
        "cas": "89-82-7",
        "fema": 2963,
        "eu_fl": None,
        "status": "restricted",
        "max_use_ppm": 25,
        "restriction": (
            "EU: max 25 mg/kg in mint-flavoured confectionery, 250 mg/kg in mint tea. "
            "FEMA GRAS. Hepatotoxic at high doses."
        ),
    },

    # ── Banned — not permitted in food ────────────────────────────────────────

    5144: {
        "name": "Safrole",
        "cas": "94-59-7",
        "fema": None,
        "eu_fl": None,
        "status": "banned",
        "max_use_ppm": 0,
        "restriction": (
            "BANNED in food (EU and USA). Not in EU positive list. "
            "Known hepatocarcinogen and IARC Group 2B carcinogen. "
            "Formerly used as root beer flavouring; prohibited since 1960 (US) and banned in EU."
        ),
    },
}

# ── CAS-number reverse index ──────────────────────────────────────────────────

CAS_TO_CID: dict[str, int] = {
    entry["cas"]: cid
    for cid, entry in REGULATORY.items()
    if entry.get("cas")
}

# ── Name-based lookup (lowercase) ────────────────────────────────────────────

NAME_TO_CID: dict[str, int] = {
    entry["name"].lower(): cid
    for cid, entry in REGULATORY.items()
}


