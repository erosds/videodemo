import React, { useState, useEffect, useRef, useCallback } from "react";

const BACKEND = "http://localhost:8000";

const PRODUCT_TYPES = [
  { value: "leave_on", label: "Leave-on (cream, serum, lotion)" },
  { value: "rinse_off", label: "Rinse-off (shampoo, cleanser)" },
  { value: "eye", label: "Eye area" },
  { value: "oral", label: "Oral / lip" },
  { value: "spray", label: "Spray / aerosol" },
  { value: "sunscreen", label: "Sunscreen" },
];

const STATUS_CONFIG = {
  compliant: {
    label: "COMPLIANT",
    bg: "bg-emerald-900/40",
    border: "border-emerald-700",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  restricted: {
    label: "RESTRICTED",
    bg: "bg-amber-900/40",
    border: "border-amber-700",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  prohibited: {
    label: "PROHIBITED",
    bg: "bg-red-900/40",
    border: "border-red-700",
    text: "text-red-400",
    dot: "bg-red-500",
  },
  unknown: {
    label: "UNKNOWN",
    bg: "bg-gray-800/60",
    border: "border-gray-700",
    text: "text-gray-400",
    dot: "bg-gray-500",
  },
};

const OVERALL_CONFIG = {
  compliant: { label: "Formula Compliant", bg: "bg-emerald-900/40", border: "border-emerald-700", text: "text-emerald-400" },
  warnings: { label: "Warnings — Review Required", bg: "bg-amber-900/40", border: "border-amber-700", text: "text-amber-400" },
  non_compliant: { label: "Non-Compliant — Action Required", bg: "bg-red-900/40", border: "border-red-700", text: "text-red-400" },
};

// Info tooltip component
const InfoTooltip = ({ content }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-gray-600 hover:text-gray-400 text-[11px] leading-none cursor-pointer"
        aria-label="More info"
      >
        ℹ
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-5 w-64 bg-[#1a1a1a] border border-gray-700 rounded p-3 text-[11px] text-gray-400 leading-relaxed shadow-xl">
          {content}
          <button
            onClick={() => setOpen(false)}
            className="mt-2 text-gray-600 hover:text-gray-400 text-[10px] block"
          >
            Close
          </button>
        </div>
      )}
    </span>
  );
};

// Status badge
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// Single result card
const ResultCard = ({ result }) => {
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.unknown;
  return (
    <div className={`border rounded p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-medium text-gray-200">{result.inci_name}</div>
          {result.cas && <div className="text-[11px] text-gray-500 font-mono mt-0.5">CAS: {result.cas}</div>}
        </div>
        <StatusBadge status={result.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {result.max_allowed_pct !== null && result.max_allowed_pct !== undefined && (
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-widest">Max Allowed</div>
            <div className="text-sm text-gray-300 font-mono">{result.max_allowed_pct}%</div>
          </div>
        )}
        {result.annex_ref && (
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-widest">Regulatory Ref</div>
            <div className="text-sm text-gray-300 font-mono">{result.annex_ref}</div>
          </div>
        )}
      </div>

      {result.plain_explanation && (
        <div className="mb-2">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Plain Explanation</div>
          <div className="text-xs text-gray-400 leading-relaxed">{result.plain_explanation}</div>
        </div>
      )}

      {result.conditions && (
        <div className="mb-2">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Regulatory Conditions</div>
          <div className="text-xs text-gray-500 leading-relaxed font-mono">{result.conditions}</div>
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Warnings</div>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-[11px] text-amber-400 leading-relaxed flex gap-1.5">
                <span>⚠</span><span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Single Check Tab ─────────────────────────────────────────────────────────

const SingleCheck = () => {
  const [inci, setInci] = useState("");
  const [conc, setConc] = useState("");
  const [productType, setProductType] = useState("leave_on");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${BACKEND}/compliance/ingredients/search?q=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      setSuggestions(data.results || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInciChange = (val) => {
    setInci(val);
    setShowSuggestions(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const selectSuggestion = (s) => {
    setInci(s.inci);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleCheck = async () => {
    if (!inci.trim() || !conc) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${BACKEND}/compliance/ingredient-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inci_name: inci.trim(), concentration_pct: parseFloat(conc), product_type: productType }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* INCI input with live search */}
      <div className="relative">
        <label className="flex items-center text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">
          INCI Name or CAS Number
          <InfoTooltip content="INCI (International Nomenclature of Cosmetic Ingredients) is the standardised naming system used worldwide to identify cosmetic ingredients. Example: Phenoxyethanol, Niacinamide, Retinol." />
        </label>
        <input
          ref={inputRef}
          type="text"
          value={inci}
          onChange={(e) => handleInciChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => inci.length >= 2 && setShowSuggestions(true)}
          placeholder="e.g. Phenoxyethanol, 122-99-6..."
          className="w-full bg-[#111] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-gray-500 focus:outline-none"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-gray-700 rounded shadow-xl max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.key}
                onMouseDown={() => selectSuggestion(s)}
                className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center justify-between group"
              >
                <span className="text-sm text-gray-300">{s.inci}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  (STATUS_CONFIG[s.status] || STATUS_CONFIG.unknown).text
                } ${(STATUS_CONFIG[s.status] || STATUS_CONFIG.unknown).border} opacity-70`}>
                  {s.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">
            Concentration (%)
          </label>
          <input
            type="number"
            value={conc}
            onChange={(e) => setConc(e.target.value)}
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g. 0.5"
            className="w-full bg-[#111] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-gray-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="flex items-center text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">
            Product Type
            <InfoTooltip content="Leave-on: not rinsed off (creams, serums, deodorants). Rinse-off: washed away (shampoo, cleanser). Different EU limits apply to each type." />
          </label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full bg-[#111] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-gray-500 focus:outline-none"
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading || !inci.trim() || !conc}
        className="px-4 py-2 text-sm border border-gray-700 rounded text-gray-300 hover:border-gray-500 hover:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Checking…" : "Check Ingredient"}
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-800 rounded p-3">{error}</div>
      )}

      {result && <ResultCard result={result} />}
    </div>
  );
};

// ── Formula Screen Tab ────────────────────────────────────────────────────────

const FormulaScreen = () => {
  const [rows, setRows] = useState([{ inci_name: "", concentration_pct: "" }]);
  const [productType, setProductType] = useState("leave_on");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const addRow = () => setRows((r) => [...r, { inci_name: "", concentration_pct: "" }]);

  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const updateRow = (i, field, val) =>
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleScreen = async () => {
    const valid = rows.filter((r) => r.inci_name.trim() && r.concentration_pct !== "");
    if (!valid.length) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${BACKEND}/compliance/formula-screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: valid.map((r) => ({ inci_name: r.inci_name.trim(), concentration_pct: parseFloat(r.concentration_pct) })),
          product_type: productType,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const overallCfg = result ? (OVERALL_CONFIG[result.overall_status] || OVERALL_CONFIG.warnings) : null;

  return (
    <div className="space-y-4">
      {/* Product type */}
      <div>
        <label className="flex items-center text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">
          Product Type
          <InfoTooltip content="Select the product category. EU concentration limits differ between rinse-off (washed off) and leave-on (stay on skin) products." />
        </label>
        <select
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          className="w-full bg-[#111] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-gray-500 focus:outline-none"
        >
          {PRODUCT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Ingredient rows */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] text-gray-500 uppercase tracking-widest">
            Ingredients
            <InfoTooltip content="Enter each ingredient using its INCI name (e.g. Phenoxyethanol, not 'preservative'). Concentration is % by weight of finished product." />
          </label>
          <button
            onClick={addRow}
            className="text-[11px] text-gray-500 hover:text-gray-300 border border-gray-800 rounded px-2 py-0.5 transition-colors"
          >
            + Add
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_100px_28px] gap-2 text-[10px] text-gray-600 uppercase tracking-widest px-1">
            <span>INCI Name</span><span>Conc. %</span><span />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_28px] gap-2">
              <input
                type="text"
                value={row.inci_name}
                onChange={(e) => updateRow(i, "inci_name", e.target.value)}
                placeholder="INCI name or CAS"
                className="bg-[#111] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-gray-500 focus:outline-none"
              />
              <input
                type="number"
                value={row.concentration_pct}
                onChange={(e) => updateRow(i, "concentration_pct", e.target.value)}
                placeholder="0.0"
                min="0"
                max="100"
                step="0.01"
                className="bg-[#111] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-gray-500 focus:outline-none"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="text-gray-700 hover:text-red-500 disabled:opacity-0 transition-colors text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleScreen}
        disabled={loading || !rows.some((r) => r.inci_name.trim() && r.concentration_pct !== "")}
        className="px-4 py-2 text-sm border border-gray-700 rounded text-gray-300 hover:border-gray-500 hover:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Screening…" : "Screen Formula"}
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-800 rounded p-3">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Overall status banner */}
          <div className={`border rounded p-3 ${overallCfg.bg} ${overallCfg.border}`}>
            <div className={`text-sm font-semibold ${overallCfg.text}`}>{overallCfg.label}</div>
            <div className="text-xs text-gray-400 mt-1">{result.summary}</div>
          </div>

          {/* Per-ingredient table */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Per-Ingredient Results</div>
            <div className="space-y-2">
              {result.per_ingredient.map((item, i) => (
                <div key={i} className="border border-gray-800 rounded p-3 bg-[#0e0e0e]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm text-gray-300 font-mono">{item.inci_name}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.max_allowed_pct !== null && item.max_allowed_pct !== undefined && (
                    <div className="text-[11px] text-gray-600">Max: {item.max_allowed_pct}% · {item.annex_ref || "No Annex"}</div>
                  )}
                  {item.warnings && item.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-500 mt-1">⚠ {item.warnings.join("; ")}</div>
                  )}
                  {item.plain_explanation && (
                    <div className="text-[11px] text-gray-600 mt-1 leading-relaxed">{item.plain_explanation}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Allergen warnings */}
          {result.allergen_warnings && result.allergen_warnings.length > 0 && (
            <div className="border border-amber-900 rounded p-3 bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 uppercase tracking-widest mb-2">
                <span>⚠</span>
                <span>Declared Fragrance Allergens (EU Reg. 1223/2009)</span>
                <InfoTooltip content="EU Cosmetics Regulation requires that 26 fragrance allergens (+ expanded list from 2026) are individually declared on the ingredient label when present above: 0.001% in leave-on products, 0.01% in rinse-off products." />
              </div>
              <div className="space-y-1.5">
                {result.allergen_warnings.map((a, i) => (
                  <div key={i} className="text-xs text-amber-300">
                    <span className="font-mono">{a.inci_name}</span>
                    <span className="text-amber-600 ml-2">at {a.concentration_pct}%</span>
                    <div className="text-amber-700 mt-0.5">{a.warning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Label requirements */}
          {result.label_requirements && result.label_requirements.length > 0 && (
            <div className="border border-gray-700 rounded p-3">
              <div className="text-[11px] text-gray-500 uppercase tracking-widest mb-2">
                Mandatory Label Requirements
                <InfoTooltip content="These statements or declarations are required on the product label or packaging under EU Cosmetics Regulation 1223/2009." />
              </div>
              <ul className="space-y-1.5">
                {result.label_requirements.map((req, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2">
                    <span className="text-gray-600 shrink-0">→</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const IngredientCheck = () => {
  const [mode, setMode] = useState("single");

  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: 140, paddingBottom: 100 }}
    >
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-200 mb-1">Ingredient Compliance Check</h2>
          <p className="text-xs text-gray-600">
            EU Cosmetics Regulation 1223/2009 · Annexes II, III, V, VI · 26 Fragrance Allergens
            <InfoTooltip content="Regulation (EC) No 1223/2009 is the main EU law governing cosmetic products. It defines which substances are prohibited (Annex II), restricted with conditions (Annex III), permitted as preservatives (Annex V), and permitted as UV filters (Annex VI). This tool checks your ingredients against these rules." />
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-[#111] border border-gray-800 rounded p-0.5 mb-5 w-fit">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-1.5 text-xs rounded transition-colors ${
              mode === "single"
                ? "bg-gray-700 text-gray-200"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            Single Ingredient
          </button>
          <button
            onClick={() => setMode("formula")}
            className={`px-4 py-1.5 text-xs rounded transition-colors ${
              mode === "formula"
                ? "bg-gray-700 text-gray-200"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            Formula Screen
          </button>
        </div>

        {/* Reference info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {[
            { label: "Annex II", desc: "Prohibited substances", icon: "🚫" },
            { label: "Annex III", desc: "Restricted with conditions", icon: "⚠️" },
            { label: "Annex V", desc: "Permitted preservatives", icon: "🧴" },
            { label: "Annex VI", desc: "UV filters", icon: "☀️" },
          ].map((a) => (
            <div key={a.label} className="bg-[#0e0e0e] border border-gray-800 rounded p-2.5">
              <div className="text-base mb-1">{a.icon}</div>
              <div className="text-[11px] font-mono text-gray-400">{a.label}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{a.desc}</div>
            </div>
          ))}
        </div>

        {/* Tab content */}
        {mode === "single" ? <SingleCheck /> : <FormulaScreen />}

        {/* Disclaimer */}
        <div className="mt-6 text-[10px] text-gray-700 text-center leading-relaxed">
          For demonstration purposes only. Always verify against official EU CosIng database and SCCS opinions.
          Not a substitute for formal Cosmetic Product Safety Report (CPSR).
        </div>
      </div>
    </div>
  );
};

export default IngredientCheck;
