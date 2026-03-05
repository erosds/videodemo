import { useState, useEffect } from "react";

const BACKEND = "http://localhost:8000";

// Curated list of food-relevant aromatic compounds from the regulatory database
const REGULATORY_COMPOUNDS = [
  // Approved
  { cid: 1183,    name: "Vanillin" },
  { cid: 14860,   name: "Ethylvanillin" },
  { cid: 463,     name: "Guaiacol" },
  { cid: 3314,    name: "Eugenol" },
  { cid: 240,     name: "Benzaldehyde" },
  { cid: 289,     name: "Catechol" },
  { cid: 999,     name: "Piperonal" },
  { cid: 126,     name: "4-Hydroxybenzaldehyde" },
  { cid: 31244,   name: "4-Methoxybenzaldehyde" },
  { cid: 637511,  name: "Cinnamaldehyde" },
  { cid: 6054,    name: "2-Phenylethanol" },
  { cid: 244,     name: "Benzyl Alcohol" },
  { cid: 998,     name: "Phenylacetaldehyde" },
  { cid: 10834,   name: "4-Methylguaiacol" },
  { cid: 31419,   name: "4-Ethylguaiacol" },
  { cid: 7410,    name: "Acetophenone" },
  { cid: 7150,    name: "Methyl Benzoate" },
  { cid: 4133,    name: "Methyl Salicylate" },
  { cid: 444539,  name: "trans-Cinnamic Acid" },
  { cid: 8468,    name: "Vanillic Acid" },
  { cid: 445858,  name: "Ferulic Acid" },
  { cid: 12111,   name: "Syringaldehyde" },
  { cid: 12113,   name: "3,4-Dimethoxybenzaldehyde" },
  { cid: 6989,    name: "Thymol" },
  { cid: 10364,   name: "Carvacrol" },
  { cid: 6549,    name: "Linalool" },
  { cid: 5702565, name: "Benzyl Acetate" },
  { cid: 1549778, name: "Phenylacetic Acid" },
  { cid: 2586,    name: "Protocatechuic Aldehyde" },
  { cid: 2723633, name: "Isoeugenol" },
  { cid: 72433,   name: "4-Vinylguaiacol" },
  { cid: 3122,    name: "Indole" },
  { cid: 554917,  name: "Isovanillin" },
  { cid: 11597,   name: "2-Hydroxybenzaldehyde" },
  { cid: 101,     name: "3-Hydroxybenzaldehyde" },
  // Restricted
  { cid: 323,    name: "Coumarin" },
  { cid: 7144,   name: "Methyl Eugenol" },
  { cid: 8815,   name: "Estragole" },
  { cid: 442495, name: "Pulegone" },
  // Banned
  { cid: 5144,   name: "Safrole" },
];

const STATUS_CONFIG = {
  approved:      { label: "Approved",       bg: "bg-emerald-900/30", border: "border-emerald-700/40", text: "text-emerald-400", dot: "#10b981" },
  restricted:    { label: "Restricted",     bg: "bg-amber-900/30",   border: "border-amber-700/40",   text: "text-amber-400",   dot: "#f59e0b" },
  banned:        { label: "Banned",         bg: "bg-red-900/30",     border: "border-red-700/40",     text: "text-red-400",     dot: "#ef4444" },
  not_evaluated: { label: "Not Evaluated",  bg: "bg-gray-800/40",    border: "border-gray-700/40",    text: "text-gray-500",    dot: "#6b7280" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_evaluated;
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${cfg.bg} border ${cfg.border} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

const RegulatoryCheck = () => {
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState("all");
  const [selected, setSelected]   = useState(null); // expanded row

  const fetchRegulatory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/molecule-finder/regulatory-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compounds: REGULATORY_COMPOUNDS }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRegulatory(); }, []);

  const filtered = filter === "all"
    ? results
    : results.filter(r => r.status === filter);

  const counts = {
    all:           results.length,
    approved:      results.filter(r => r.status === "approved").length,
    restricted:    results.filter(r => r.status === "restricted").length,
    banned:        results.filter(r => r.status === "banned").length,
    not_evaluated: results.filter(r => r.status === "not_evaluated").length,
  };

  const FILTER_TABS = [
    { key: "all",           label: `All (${counts.all})` },
    { key: "approved",      label: `Approved (${counts.approved})` },
    { key: "restricted",    label: `Restricted (${counts.restricted})` },
    { key: "banned",        label: `Banned (${counts.banned})` },
    { key: "not_evaluated", label: `Not Evaluated (${counts.not_evaluated})` },
  ];

  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: 200, paddingBottom: 100 }}
    >
      <div className="max-w-6xl mx-auto w-full">

        {/* Header cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total compounds", value: counts.all, color: "text-gray-300" },
            { label: "FEMA GRAS / EU approved", value: counts.approved, color: "text-emerald-400" },
            { label: "Restricted (use limits)", value: counts.restricted, color: "text-amber-400" },
            { label: "Banned", value: counts.banned, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-gray-800 bg-[#111111] px-4 py-3">
              <div className={`text-2xl font-bold ${color} mb-0.5`}>{loading ? "—" : value}</div>
              <div className="text-[10px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Source note */}
        <div className="mb-4 px-4 py-2.5 rounded-lg border border-gray-800 bg-[#0e0e0e] text-[10px] text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-semibold">Data sources:</span>{" "}
          FEMA GRAS list (US Flavor and Extract Manufacturers Association) ·
          EU Regulation EC 1334/2008 — Union List of Flavouring Substances, Annex I (updated through 2024) ·
          EFSA opinions and SCF evaluations where applicable.
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">
            {error}
          </div>
        )}

        {/* Main table card */}
        <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">

          {/* Filter tab bar */}
          <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest text-gray-500 mr-2">Filter</span>
            {FILTER_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setSelected(null); }}
                className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all duration-200
                  ${filter === key
                    ? "bg-rose-900/40 border-rose-700/50 text-rose-300"
                    : "bg-gray-900/40 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 text-xs">Loading regulatory data…</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["Compound", "CID", "Status", "FEMA #", "EU FL #", "Notes"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.not_evaluated;
                    const isExpanded = selected === i;
                    return (
                      <>
                        <tr
                          key={i}
                          className={`border-b border-gray-800/40 cursor-pointer transition-colors
                            ${isExpanded ? "bg-gray-900/50" : "hover:bg-gray-900/25"}
                            ${r.status === "banned" ? "bg-red-900/10" : ""}
                            ${r.status === "restricted" ? "bg-amber-900/5" : ""}`}
                          onClick={() => setSelected(isExpanded ? null : i)}
                        >
                          <td className="px-3 py-2 font-medium text-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                              {r.name}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-500">
                            {r.cid ? (
                              <a
                                href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-300 transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                {r.cid}
                              </a>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-2 font-mono text-gray-400">
                            {r.fema ? r.fema : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-400">
                            {r.eu_fl ? r.eu_fl : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-2 max-w-xs">
                            {r.max_use_ppm != null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400 border border-amber-800/30">
                                max {r.max_use_ppm} ppm
                              </span>
                            )}
                            {r.status === "approved" && !r.restriction && (
                              <span className="text-[9px] text-gray-600">No general use limits</span>
                            )}
                            {r.restriction && !r.max_use_ppm && (
                              <span className="text-[9px] text-gray-500 truncate" title={r.restriction}>
                                {r.restriction.slice(0, 40)}{r.restriction.length > 40 ? "…" : ""}
                              </span>
                            )}
                            {!r.restriction && r.status === "not_evaluated" && (
                              <span className="text-[9px] text-gray-600">Not in FEMA or EU list</span>
                            )}
                          </td>
                        </tr>
                        {/* Expanded row */}
                        {isExpanded && r.restriction && (
                          <tr key={`${i}-detail`} className="border-b border-gray-800/40 bg-gray-900/50">
                            <td colSpan={6} className="px-5 py-3">
                              <div className={`text-[10px] leading-relaxed ${
                                r.status === "banned" ? "text-red-300" :
                                r.status === "restricted" ? "text-amber-300" : "text-gray-400"}`}>
                                <span className="font-semibold text-gray-300 mr-2">Regulatory note:</span>
                                {r.restriction}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600">
            Click any row to expand restriction notes. CID links open PubChem.
            Status definitions: <span className="text-emerald-500">approved</span> = no general use limits ·
            <span className="text-amber-500 ml-1">restricted</span> = maximum use level applies ·
            <span className="text-red-500 ml-1">banned</span> = not permitted in food ·
            <span className="text-gray-500 ml-1">not_evaluated</span> = not found in either list.
          </div>
        </div>

      </div>
    </div>
  );
};

export default RegulatoryCheck;
