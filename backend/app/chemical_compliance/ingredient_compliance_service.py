"""
Ingredient compliance service — EU Cosmetics Regulation 1223/2009.
Provides single-ingredient check, formula screening, fuzzy search, allergen reporting.
"""

import difflib
from typing import Any, Dict, List, Optional

from app.chemical_compliance.ingredient_data import (
    INGREDIENT_DB,
    CAS_INDEX,
    FRAGRANCE_ALLERGENS_EU26,
)

_PRODUCT_TYPE_RINSE = {"rinse_off"}
_PRODUCT_TYPE_LEAVE = {"leave_on", "oral", "eye", "sunscreen", "spray"}


def _normalise(name: str) -> str:
    """Lowercase, strip spaces, replace special chars for fuzzy lookup."""
    return name.strip().lower().replace("-", " ").replace("_", " ")


def _lookup_ingredient(inci_name: str) -> Optional[str]:
    """
    Look up an ingredient in the DB.
    Tries exact key match → CAS match → INCI field match → fuzzy key match.
    Returns the DB key or None.
    """
    norm = _normalise(inci_name)

    # 1. Direct key match
    if norm.replace(" ", "_") in INGREDIENT_DB:
        return norm.replace(" ", "_")

    # 2. Exact normalised key match
    for key in INGREDIENT_DB:
        if _normalise(key.replace("_", " ")) == norm:
            return key

    # 3. CAS number match
    for key, data in INGREDIENT_DB.items():
        cas = data.get("cas", "")
        if cas and inci_name.strip() == cas:
            return key

    # 4. INCI field exact match (case-insensitive)
    for key, data in INGREDIENT_DB.items():
        if _normalise(data.get("inci", "")) == norm:
            return key

    # 5. Fuzzy key match
    keys = list(INGREDIENT_DB.keys())
    close = difflib.get_close_matches(norm.replace(" ", "_"), keys, n=1, cutoff=0.72)
    if close:
        return close[0]

    # 6. Fuzzy INCI match
    inci_map = {_normalise(v.get("inci", "")): k for k, v in INGREDIENT_DB.items()}
    close_inci = difflib.get_close_matches(norm, list(inci_map.keys()), n=1, cutoff=0.72)
    if close_inci:
        return inci_map[close_inci[0]]

    return None


def check_ingredient(
    inci_name: str,
    concentration_pct: float,
    product_type: str,
) -> Dict[str, Any]:
    """
    Check a single ingredient against EU Cosmetics Regulation.

    Args:
        inci_name: INCI name or CAS number.
        concentration_pct: Concentration in % (w/w).
        product_type: One of rinse_off | leave_on | oral | eye | spray | sunscreen.

    Returns dict with keys:
        inci_name, cas, status, max_allowed_pct, conditions, annex_ref,
        plain_explanation, warnings
    """
    key = _lookup_ingredient(inci_name)

    if key is None:
        return {
            "inci_name": inci_name,
            "cas": None,
            "status": "unknown",
            "max_allowed_pct": None,
            "conditions": None,
            "annex_ref": None,
            "plain_explanation": (
                f"'{inci_name}' non trovato nel database EU. "
                "Potrebbe essere non classificato, usato a concentrazioni tracciali, "
                "o richiedere verifica manuale nella banca dati CosIng ufficiale."
            ),
            "warnings": ["Ingredient not found in EU database — manual CosIng check recommended."],
        }

    data = INGREDIENT_DB[key]
    eu_status = data.get("eu_status", "permitted")
    annex = data.get("annex")
    entry = data.get("entry")
    annex_ref = f"Annex {annex}, Entry {entry}" if annex and entry else (f"Annex {annex}" if annex else None)
    warnings: List[str] = []

    # Fragrance allergen check (threshold-based)
    if key in FRAGRANCE_ALLERGENS_EU26:
        allergen = FRAGRANCE_ALLERGENS_EU26[key]
        if allergen.get("eu_status") == "prohibited":
            return {
                "inci_name": data.get("inci", inci_name),
                "cas": data.get("cas"),
                "status": "prohibited",
                "max_allowed_pct": 0.0,
                "conditions": data.get("conditions", "Prohibited in all cosmetic products."),
                "annex_ref": annex_ref,
                "plain_explanation": data.get("plain_explanation", "Prohibited ingredient."),
                "warnings": [f"{data.get('inci', inci_name)} is PROHIBITED in all cosmetic products (EU Reg 1223/2009)."],
            }
        # Check label declaration threshold
        is_rinse = product_type in _PRODUCT_TYPE_RINSE
        threshold = allergen.get("threshold_rinse_off", 0.01) if is_rinse else allergen.get("threshold_leave_on", 0.001)
        if concentration_pct > threshold:
            warnings.append(
                f"Declared fragrance allergen: must appear on ingredient label "
                f"(threshold: {threshold*100:.3f}% for {'rinse-off' if is_rinse else 'leave-on'} products)."
            )

    # Prohibited check
    if eu_status == "prohibited":
        return {
            "inci_name": data.get("inci", inci_name),
            "cas": data.get("cas"),
            "status": "prohibited",
            "max_allowed_pct": 0.0,
            "conditions": data.get("conditions", "Prohibited in all cosmetic products."),
            "annex_ref": annex_ref,
            "plain_explanation": data.get("plain_explanation", "This ingredient is prohibited."),
            "warnings": [f"{data.get('inci', inci_name)} is PROHIBITED (Annex II, EU Reg 1223/2009)."],
        }

    # Concentration limit check
    max_conc_map = data.get("max_conc", {})
    max_allowed: Optional[float] = None

    if max_conc_map:
        # Try specific product type first, then "general"
        if product_type in max_conc_map:
            max_allowed = max_conc_map[product_type]
        elif "general" in max_conc_map:
            max_allowed = max_conc_map["general"]

    # Permitted in this product type?
    if max_allowed is None and eu_status == "restricted":
        # Not permitted in this product type
        return {
            "inci_name": data.get("inci", inci_name),
            "cas": data.get("cas"),
            "status": "prohibited",
            "max_allowed_pct": 0.0,
            "conditions": data.get("conditions", ""),
            "annex_ref": annex_ref,
            "plain_explanation": (
                f"{data.get('inci', inci_name)} is NOT permitted in {product_type.replace('_', '-')} "
                f"products per EU Cosmetics Regulation. {data.get('plain_explanation', '')}"
            ),
            "warnings": [f"Not permitted in {product_type.replace('_', '-')} products."],
        }

    # Concentration check
    if max_allowed is not None and concentration_pct > max_allowed:
        warnings.append(
            f"Concentration {concentration_pct}% exceeds maximum allowed {max_allowed}% "
            f"for {product_type.replace('_', '-')} products ({annex_ref or 'EU Reg 1223/2009'})."
        )
        status = "restricted"
    elif eu_status == "restricted":
        status = "compliant"
        if concentration_pct <= (max_allowed or float("inf")):
            pass  # OK
    else:
        status = "compliant"

    # Final status determination
    if warnings and any("exceeds" in w for w in warnings):
        status = "restricted"
    elif eu_status == "permitted" and not warnings:
        status = "compliant"
    elif eu_status == "restricted" and not any("exceeds" in w for w in warnings):
        status = "compliant"

    return {
        "inci_name": data.get("inci", inci_name),
        "cas": data.get("cas"),
        "status": status,
        "max_allowed_pct": max_allowed,
        "conditions": data.get("conditions"),
        "annex_ref": annex_ref,
        "plain_explanation": data.get("plain_explanation", ""),
        "warnings": warnings,
    }


def screen_formula(
    ingredients: List[Dict[str, Any]],
    product_type: str,
) -> Dict[str, Any]:
    """
    Screen a complete formula against EU Cosmetics Regulation.

    Args:
        ingredients: List of {inci_name, concentration_pct}.
        product_type: Product type string.

    Returns dict with overall_status, per_ingredient, allergen_warnings, label_requirements, summary.
    """
    per_ingredient = []
    allergen_warnings = []
    label_requirements: List[str] = []

    prohibited_count = 0
    restricted_count = 0
    unknown_count = 0

    for item in ingredients:
        inci = item.get("inci_name", "")
        conc = float(item.get("concentration_pct", 0))
        result = check_ingredient(inci, conc, product_type)
        per_ingredient.append(result)

        s = result["status"]
        if s == "prohibited":
            prohibited_count += 1
        elif s == "restricted":
            restricted_count += 1
        elif s == "unknown":
            unknown_count += 1

        # Allergen warnings
        for w in result.get("warnings", []):
            if "allergen" in w.lower() or "declared" in w.lower():
                allergen_warnings.append({
                    "inci_name": result["inci_name"],
                    "warning": w,
                    "concentration_pct": conc,
                })

        # Formaldehyde releaser check
        if result.get("conditions") and "formaldehyde" in result["conditions"].lower():
            label_requirements.append(
                f"'{result['inci_name']}' is a formaldehyde releaser — "
                "add 'Contains formaldehyde' warning if free formaldehyde >0.05% in finished product."
            )

        # Children restriction
        if result.get("conditions") and "children under 3" in result["conditions"].lower():
            label_requirements.append(
                f"'{result['inci_name']}' — verify suitability if product targets children under 3 years."
            )

    # Overall status
    if prohibited_count > 0:
        overall_status = "non_compliant"
    elif restricted_count > 0 or unknown_count > 0:
        overall_status = "warnings"
    else:
        overall_status = "compliant"

    # Summary message
    n = len(ingredients)
    if overall_status == "non_compliant":
        summary = (
            f"Formula non conforme: {prohibited_count}/{n} ingredienti vietati. "
            "Revisione urgente richiesta."
        )
    elif overall_status == "warnings":
        parts = []
        if restricted_count:
            parts.append(f"{restricted_count} sopra i limiti")
        if unknown_count:
            parts.append(f"{unknown_count} non trovati in DB")
        summary = f"Formula con avvisi ({', '.join(parts)} su {n} ingredienti totali). Verifica consigliata."
    else:
        summary = f"Formula conforme al Regolamento EU 1223/2009 ({n} ingredienti verificati)."

    # Deduplicate label requirements
    label_requirements = list(dict.fromkeys(label_requirements))

    return {
        "overall_status": overall_status,
        "per_ingredient": per_ingredient,
        "allergen_warnings": allergen_warnings,
        "label_requirements": label_requirements,
        "summary": summary,
    }


def search_ingredient(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fuzzy search ingredients by INCI name, key, or CAS number.
    Returns list of {key, inci, cas, status, function}.
    """
    if not query or not query.strip():
        # Return first 'limit' entries as default
        results = []
        for key, data in list(INGREDIENT_DB.items())[:limit]:
            results.append({
                "key": key,
                "inci": data.get("inci", key),
                "cas": data.get("cas"),
                "status": data.get("eu_status", data.get("status", "unknown")),
                "function": data.get("function", []),
            })
        return results

    norm_query = _normalise(query)

    # Score each ingredient
    scored: List[tuple] = []
    for key, data in INGREDIENT_DB.items():
        inci = data.get("inci", key)
        cas = data.get("cas", "")

        # CAS exact match
        if query.strip() == cas:
            scored.append((1.0, key, data))
            continue

        # Key score
        key_score = difflib.SequenceMatcher(None, norm_query, _normalise(key.replace("_", " "))).ratio()
        # INCI score
        inci_score = difflib.SequenceMatcher(None, norm_query, _normalise(inci)).ratio()

        # Substring bonus
        substring_bonus = 0.2 if norm_query in _normalise(inci) or norm_query in _normalise(key) else 0.0

        best = max(key_score, inci_score) + substring_bonus
        if best > 0.3:
            scored.append((best, key, data))

    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for score, key, data in scored[:limit]:
        results.append({
            "key": key,
            "inci": data.get("inci", key),
            "cas": data.get("cas"),
            "status": data.get("eu_status", data.get("status", "unknown")),
            "function": data.get("function", []),
            "score": round(score, 3),
        })
    return results


def get_allergen_report(
    inci_names: List[str],
    product_type: str,
) -> Dict[str, Any]:
    """
    Check which ingredients are EU declared fragrance allergens.
    Returns report with declaration obligations.
    """
    is_rinse = product_type in _PRODUCT_TYPE_RINSE
    threshold = "0.01%" if is_rinse else "0.001%"
    product_label = "rinse-off" if is_rinse else "leave-on"

    found_allergens = []
    for name in inci_names:
        key = _lookup_ingredient(name)
        if key and key in FRAGRANCE_ALLERGENS_EU26:
            allergen = FRAGRANCE_ALLERGENS_EU26[key]
            found_allergens.append({
                "inci_name": INGREDIENT_DB[key].get("inci", name),
                "cas": INGREDIENT_DB[key].get("cas"),
                "eu_status": allergen.get("eu_status"),
                "declaration_threshold": allergen.get(f"threshold_{product_type.split('_')[0]}", 0.001),
                "note": INGREDIENT_DB[key].get("plain_explanation", ""),
            })

    return {
        "product_type": product_type,
        "declaration_threshold": threshold,
        "note": (
            f"For {product_label} products, declared fragrance allergens (EU Reg 1223/2009 Annex III) "
            f"must appear on the ingredient list when present above {threshold}."
        ),
        "allergens_found": found_allergens,
    }
