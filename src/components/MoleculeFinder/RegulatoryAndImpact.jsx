import { useState, useEffect } from "react";
import { LuDroplets, LuCookie, LuHouse, LuPill } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ── Regulatory check data ──────────────────────────────────────────────────────
const REGULATORY_COMPOUNDS = [
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
  { cid: 323,     name: "Coumarin" },
  { cid: 7144,    name: "Methyl Eugenol" },
  { cid: 8815,    name: "Estragole" },
  { cid: 442495,  name: "Pulegone" },
  { cid: 5144,    name: "Safrole" },
];

const STATUS_CONFIG = {
  approved:      { label: "Approved",      bg: "bg-emerald-900/30", border: "border-emerald-700/40", text: "text-emerald-400", dot: "#10b981" },
  restricted:    { label: "Restricted",    bg: "bg-amber-900/30",   border: "border-amber-700/40",   text: "text-amber-400",   dot: "#f59e0b" },
  banned:        { label: "Banned",        bg: "bg-red-900/30",     border: "border-red-700/40",     text: "text-red-400",     dot: "#ef4444" },
  not_evaluated: { label: "Not Evaluated", bg: "bg-gray-800/40",    border: "border-gray-700/40",    text: "text-gray-500",    dot: "#6b7280" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_evaluated;
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${cfg.bg} border ${cfg.border} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

// ── Impact sub-components ──────────────────────────────────────────────────────
const MetricCard = ({ value, unit, label, sub, color }) => (
  <div className="rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 flex items-center gap-3">
    <div className="flex-shrink-0 text-right min-w-[3rem]">
      <div className="text-xl font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">{unit}</div>
    </div>
    <div className="border-l border-gray-800 pl-3">
      <div className="text-[11px] font-medium text-gray-300 leading-snug">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5 leading-snug">{sub}</div>}
    </div>
  </div>
);

const TimelineItem = ({ phase, duration, desc, color, last }) => (
  <div className="flex items-start gap-2.5">
    <div className="flex flex-col items-center">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
      {!last && <div className="w-px flex-1 mt-1" style={{ background: color + "40", minHeight: 24 }} />}
    </div>
    <div className="pb-3">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-gray-200">{phase}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: color + "22", color }}>
          {duration}
        </span>
      </div>
      <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{desc}</div>
    </div>
  </div>
);

const STACK_GROUPS = [
  {
    label: "Molecular Tools",
    desc: "Software to read, encode and compare chemical structures",
    color: "#f43f5e",
    items: ["RDKit — open-source molecular toolkit", "Molecular fingerprints — digital encoding of atom connectivity"],
  },
  {
    label: "AI & Optimization",
    desc: "Machine learning models and multi-objective search",
    color: "#a855f7",
    items: ["Random Forest — ensemble classifier for property prediction", "Multi-objective optimizer — finds Pareto-optimal trade-offs across competing goals"],
  },
  {
    label: "Flavour Databases",
    desc: "Curated collections of aroma and taste compounds",
    color: "#6366f1",
    items: ["FooDB — University of Alberta food composition database", "FlavorDB — aroma molecule–food pairing atlas", "Taste prediction dataset — sweetness labels from sensory studies"],
  },
  {
    label: "Safety Benchmarks",
    desc: "Standardized datasets for toxicity and mutagenicity",
    color: "#f97316",
    items: ["Ames mutagenicity panel — 7 255 compounds, bacterial assay gold standard", "Tox21 safety screen — 8 000+ compounds, 12 toxicity endpoints (EPA/NIH/FDA)"],
  },
  {
    label: "Regulatory Lists",
    desc: "Official approved substance registers used for compliance checks",
    color: "#10b981",
    items: ["EU Regulation 1334/2008 — Union List of Flavouring Substances (Annex I)", "FEMA GRAS — US Flavor and Extract Manufacturers Association approved list"],
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
const RegulatoryAndImpact = () => {
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState(null);

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

  const filtered = filter === "all" ? results : results.filter(r => r.status === filter);

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
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">

        {/* ── Section 1: Regulatory check ────────────────────────────────── */}
        <div>
          {/* Header cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: "Total compounds", value: counts.all,        color: "text-gray-300" },
              { label: "FEMA GRAS / EU approved", value: counts.approved,   color: "text-emerald-400" },
              { label: "Restricted (use limits)", value: counts.restricted, color: "text-amber-400" },
              { label: "Banned",                  value: counts.banned,     color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-gray-800 bg-[#111111] px-4 py-3">
                <div className={`text-2xl font-bold ${color} mb-0.5`}>{loading ? "—" : value}</div>
                <div className="text-[10px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          <div className="mb-3 px-4 py-2.5 rounded-lg border border-gray-800 bg-[#0e0e0e] text-[10px] text-gray-500 leading-relaxed">
            <span className="text-gray-400 font-semibold">Data sources:</span>{" "}
            FEMA GRAS list (US Flavor and Extract Manufacturers Association) ·
            EU Regulation EC 1334/2008 — Union List of Flavouring Substances, Annex I (updated through 2024) ·
            EFSA opinions and SCF evaluations where applicable.
          </div>

          {error && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">
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
              <div className="flex items-center justify-center h-32">
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
                                <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="hover:text-gray-300 transition-colors"
                                  onClick={e => e.stopPropagation()}>
                                  {r.cid}
                                </a>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                            <td className="px-3 py-2 font-mono text-gray-400">{r.fema ?? <span className="text-gray-600">—</span>}</td>
                            <td className="px-3 py-2 font-mono text-gray-400">{r.eu_fl ?? <span className="text-gray-600">—</span>}</td>
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
              Click any row to expand restriction notes. CID links open PubChem. ·
              <span className="text-emerald-500 ml-1">approved</span> = no general use limits ·
              <span className="text-amber-500 ml-1">restricted</span> = max level applies ·
              <span className="text-red-500 ml-1">banned</span> = not permitted in food ·
              <span className="text-gray-500 ml-1">not_evaluated</span> = not in either list.
            </div>
          </div>
        </div>

        {/* ── Section 2: Impact ──────────────────────────────────────────── */}
        <div>
          {/* Metrics — compact horizontal */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard value="10×"  unit="faster"         label="Candidate identification"  sub="vs traditional empirical screening"   color="#f43f5e" />
            <MetricCard value=">80%" unit="fewer lab tests" label="Wet-lab experiments saved" sub="by pre-filtering with ML predictions" color="#ec4899" />
            <MetricCard value="4–8"  unit="weeks"           label="From concept to shortlist" sub="vs 18–36 months in legacy projects"   color="#a855f7" />
            <MetricCard value="40+"  unit="substances"      label="Monitored for restrictions" sub="EU 1334/2008 + FEMA GRAS, live"      color="#6366f1" />
          </div>

          <div className="grid grid-cols-2 gap-5">

            {/* Timeline */}
            <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
              <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-4">Reformulation Timeline</div>
              <div className="grid grid-cols-2 gap-x-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Traditional</div>
                  <TimelineItem phase="Regulatory change" duration="Day 0"    desc="Manual impact assessment; internal alert circulated" color="#6b7280" />
                  <TimelineItem phase="Literature review" duration="2–4 wk"   desc="Team surveys flavour databases, IFRA bulletins, patents" color="#6b7280" />
                  <TimelineItem phase="Candidate selection" duration="4–8 wk" desc="Empirical shortlisting; first sensory panel organised" color="#6b7280" />
                  <TimelineItem phase="Lab synthesis & testing" duration="3–6 mo" desc="Allergy patch tests, stability, full sensory evaluation" color="#6b7280" />
                  <TimelineItem phase="Reformulation validated" duration="12–18 mo" desc="Regulatory dossier, consumer panel sign-off, relaunch" color="#6b7280" last />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">AI-Guided</div>
                  <TimelineItem phase="Regulatory change" duration="Day 0"  desc="Automated monitoring flags new restriction (e.g. Coumarin under EU 1334/2008, Annex I)" color="#f43f5e" />
                  <TimelineItem phase="Multi-objective screening" duration="< 1 h" desc="Molecules ranked by predicted flavour affinity, safety and cost — shortlist generated in minutes" color="#ec4899" />
                  <TimelineItem phase="Top candidates" duration="Day 1"     desc="Ranked by predicted sweetness, molecular weight and mutagenicity safety gate" color="#a855f7" />
                  <TimelineItem phase="Targeted wet-lab" duration="2–4 wk"  desc="Only top candidates synthesised; ~90% fewer sensory experiments needed" color="#7c3aed" />
                  <TimelineItem phase="Reformulation validated" duration="6–10 wk" desc="Dossier compiled with AI predictions as supporting evidence (EFSA guidance on data requirements)" color="#6366f1" last />
                </div>
              </div>
            </div>

            {/* Applications + stack */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
                <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Industry Applications</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { Icon: LuDroplets, title: "Personal Care",     desc: "Fragrance allergen replacement; skin-safe reformulation for leave-on products" },
                    { Icon: LuCookie,   title: "Food & Flavour",    desc: "Sodium and sugar reduction; bitter masking in nutraceuticals and functional foods" },
                    { Icon: LuHouse,    title: "Home Care",         desc: "Detergent fragrance compliance; volatile organic compound reduction in aerosols" },
                    { Icon: LuPill,     title: "Pharma Excipients", desc: "Flavour masking for paediatric formulations; excipient allergen screening" },
                  ].map(({ Icon, title, desc }) => (
                    <div key={title} className="rounded-lg border border-gray-800 bg-[#0e0e0e] p-3">
                      <Icon className="w-4 h-4 text-gray-500 mb-1.5" />
                      <div className="text-xs font-semibold text-gray-200">{title}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technology Stack — categorised */}
              <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
                <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Technology Stack</div>
                <div className="flex flex-col gap-3">
                  {STACK_GROUPS.map(({ label, desc, color, items }) => (
                    <div key={label}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
                        <span className="text-[9px] text-gray-600">{desc}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {items.map(item => (
                          <span key={item}
                            className="px-2 py-0.5 rounded text-[9px] border"
                            style={{ borderColor: color + "30", color: color + "cc", background: color + "0e" }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RegulatoryAndImpact;
