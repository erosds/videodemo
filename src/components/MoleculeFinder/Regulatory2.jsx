import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import MolImageButton from "./MolImageButton";
import { LuChevronDown } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const RUN_OPTIONS = [
  { value: "2obj", label: "Case: Solubility-Guided Design", sub: "607 aromatic compounds · logS + MW" },
  { value: "3obj", label: "Case: Sweetness Enhancer Discovery", sub: "80 flavanones/polyphenols · P(sweet) + MW + P(safe)" },
  { value: "scaffold", label: "Case: Colorant Scaffold Hopping", sub: "63 natural pigments · conj. score + MW + reg. score" },
];

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  approved: { label: "Approved", bg: "bg-emerald-900/30", border: "border-emerald-700/40", text: "text-emerald-400", dot: "#10b981" },
  restricted: { label: "Restricted", bg: "bg-amber-900/30", border: "border-amber-700/40", text: "text-amber-400", dot: "#f59e0b" },
  banned: { label: "Banned", bg: "bg-red-900/30", border: "border-red-700/40", text: "text-red-400", dot: "#ef4444" },
  not_evaluated: { label: "Not Evaluated", bg: "bg-gray-800/40", border: "border-gray-700/40", text: "text-gray-500", dot: "#6b7280" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_evaluated;
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${cfg.bg} border ${cfg.border} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

const AmesBar = ({ p }) => {
  const color = p > 0.5 ? "#ef4444" : p > 0.3 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${Math.round(p * 100)}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px]" style={{ color }}>{p.toFixed(3)}</span>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const Regulatory = () => {
  const [selectedRun, setSelectedRun] = useState("2obj");
  const [savedRuns, setSavedRuns] = useState({ "2obj": false, "3obj": false, "scaffold": false });
  const [modelReady, setModelReady] = useState(false);

  // Pareto candidates for selected run
  const [paretoCands, setParetoCands] = useState([]);
  const [paretoLoading, setParetoLoading] = useState(false);

  // AMES
  const [amesResults, setAmesResults] = useState(null);
  const [amesMeta, setAmesMeta] = useState(null);
  const [amesLoading, setAmesLoading] = useState(false);
  const [amesError, setAmesError] = useState(null);
  const [showAmesResults, setShowAmesResults] = useState(false);
  const [smilesNames, setSmilesNames] = useState({});

  // Regulatory table (from same Pareto candidates)
  const [regResults, setRegResults] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regFilter, setRegFilter] = useState("all");
  const [regSelected, setRegSelected] = useState(null);

  // ── On mount: check model + which runs have saved data ─────────────────────
  useEffect(() => {
    fetch(`${BACKEND}/molecule-finder/available-datasets`)
      .then(r => r.ok ? r.json() : [])
      .then(ds => { if (ds.find(d => d.id === "ames_mutagenicity")?.n_cached) setModelReady(true); })
      .catch(() => { });

    Promise.all(
      ["2obj", "3obj", "scaffold"].map(rt =>
        fetch(`${BACKEND}/molecule-finder/saved-optimization/${rt}`)
          .then(r => r.status === 204 ? null : r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(([r2, r3, rs]) => {
      setSavedRuns({ "2obj": !!(r2?.generations?.length), "3obj": !!(r3?.generations?.length), "scaffold": !!(rs?.generations?.length) });
    });
  }, []);

  // ── Load Pareto candidates + regulatory check whenever run changes ──────────
  const loadRun = useCallback(async (runType) => {
    setParetoCands([]);
    setRegResults([]);
    setAmesResults(null);
    setAmesMeta(null);
    setAmesError(null);
    setRegError(null);
    setRegFilter("all");
    setRegSelected(null);

    if (!savedRuns[runType]) return;

    setParetoLoading(true);
    setRegLoading(true);
    try {
      const res = await fetch(`${BACKEND}/molecule-finder/saved-optimization/${runType}`);
      if (!res.ok || res.status === 204) return;
      const saved = await res.json();
      const lastGen = saved.generations?.[saved.generations.length - 1];
      const pareto = (lastGen?.candidates ?? []).filter(c => !c.dominated);
      setParetoCands(pareto);

      // Regulatory check on these candidates
      const compounds = pareto.map(c => ({ cid: c.cid ?? null, name: c.name ?? null, smiles: c.smiles }));
      const regRes = await fetch(`${BACKEND}/molecule-finder/regulatory-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compounds }),
      });
      if (!regRes.ok) throw new Error(await regRes.text());
      const regData = await regRes.json();
      // Merge back smiles + is_new from pareto
      const merged = (regData.results ?? []).map((r, i) => ({
        ...r,
        smiles: pareto[i]?.smiles,
        is_new: pareto[i]?.cid == null,
      }));
      setRegResults(merged);
    } catch (e) {
      setRegError(e.message);
    } finally {
      setParetoLoading(false);
      setRegLoading(false);
    }
  }, [savedRuns]);

  // Reload when run type changes (after savedRuns is known)
  useEffect(() => {
    if (Object.values(savedRuns).some(v => v !== false)) {
      loadRun(selectedRun);
    }
  }, [selectedRun, savedRuns]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AMES screen ────────────────────────────────────────────────────────────
  const fetchAmes = async () => {
    setAmesLoading(true);
    setAmesError(null);
    try {
      const res = await fetch(`${BACKEND}/molecule-finder/safety-screen-pareto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_type: selectedRun }),
      });
      if (res.status === 409) { setAmesError((await res.json()).detail); return; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAmesResults(data.results ?? []);
      setAmesMeta({ n_total: data.n_total, n_mutagenic: data.n_mutagenic, n_safe: data.n_safe });
      setShowAmesResults(true);
    } catch (e) {
      setAmesError(e.message);
    } finally {
      setAmesLoading(false);
    }
  };

  const lookupSmiles = async (smiles) => {
    setSmilesNames(prev => ({ ...prev, [smiles]: { status: "loading" } }));
    try {
      const r = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/property/IUPACName/JSON`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      const name = data?.PropertyTable?.Properties?.[0]?.IUPACName;
      setSmilesNames(prev => ({ ...prev, [smiles]: name ? { status: "found", name } : { status: "unknown" } }));
    } catch {
      setSmilesNames(prev => ({ ...prev, [smiles]: { status: "unknown" } }));
    }
  };

  const selectedRunSaved = savedRuns[selectedRun];
  const regFiltered = regFilter === "all" ? regResults : regResults.filter(r => r.status === regFilter);
  const regCounts = {
    all: regResults.length,
    approved: regResults.filter(r => r.status === "approved").length,
    restricted: regResults.filter(r => r.status === "restricted").length,
    banned: regResults.filter(r => r.status === "banned").length,
    not_evaluated: regResults.filter(r => r.status === "not_evaluated").length,
  };

  const [runDropOpen, setRunDropOpen] = useState(false)

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: 200, paddingBottom: 100 }}>
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">

        {/* ══ Run selector + AMES ════════════════════════════════════════════ */}
        <div>
          <div className="flex gap-3 items-stretch mb-4">

            {/* Description */}
            <div className="flex-1 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 text-[10px] text-gray-500 leading-relaxed min-w-0">
              <div className="text-gray-400 font-semibold mb-1">AMES Mutagenicity Screen</div>
              Bacterial reverse-mutation assay — primary genotoxicity screen (EFSA EC 2232/96).
              RF trained on <span className="text-gray-400">7,278 compounds</span> (Harvard / TDC).
              Select a use case: its <span className="text-gray-400">Pareto-optimal candidates</span> are
              screened for mutagenicity and cross-referenced against FEMA GRAS + EU 1334/2008 below.
            </div>

            {/* Stats */}
            {[
              { label: "Pareto candidates", value: paretoLoading ? "…" : (paretoCands.length || "—"), color: "text-gray-300" },
              { label: "Non-mutagenic", value: amesMeta?.n_safe ?? "—", color: "text-emerald-400" },
              { label: "Mutagenic", value: amesMeta?.n_mutagenic ?? "—", color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-shrink-0 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 min-w-[100px]">
                <div className={`text-2xl font-bold ${color} mb-0.5`}>{amesLoading ? "—" : value}</div>
                <div className="text-[10px] text-gray-500 whitespace-nowrap">{label}</div>
              </div>
            ))}

            {/* Controls */}
            <div className="flex-shrink-0 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 flex flex-col gap-2 justify-center min-w-[230px]">

              <div className="flex flex-col gap-1 relative">
                <label className="text-[9px] uppercase tracking-widest text-gray-600">Use case</label>

                <button
                  onClick={() => setRunDropOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#0e0e0e] border border-gray-800 rounded-lg text-sm transition-colors hover:border-gray-600"
                >
                  <span className="truncate text-gray-600">
                    {RUN_OPTIONS.find(o => o.value === selectedRun)?.label}
                  </span>

                  <LuChevronDown
                    className={`w-3.5 h-3.5 text-gray-700 transition-transform ${runDropOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {runDropOpen && (
                  <div
                    className="absolute z-50 mt-1 w-full bg-[#0e0e0e] border border-gray-800 rounded-lg shadow-2xl max-h-52 overflow-y-auto"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {RUN_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => {
                          setSelectedRun(o.value)
                          setRunDropOpen(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs border-b border-gray-800/40 last:border-0 transition-colors text-gray-500 hover:bg-white/[0.03]"
                      >
                        <div>{o.label}</div>
                        <div className="text-[9px] text-gray-700 mt-0.5">
                          {o.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="text-[9px] text-gray-600">
                  {RUN_OPTIONS.find(o => o.value === selectedRun)?.sub}
                </div>
              </div>
              <button
                onClick={fetchAmes}
                disabled={!modelReady || !selectedRunSaved || amesLoading || paretoLoading}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                  bg-orange-900/30 border-orange-700/50 text-orange-300 hover:bg-orange-800/40
                  disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {amesLoading ? "Running…" : amesMeta ? "↺ Re-run AMES" : "▶ Run AMES"}
              </button>
              {amesMeta && amesResults?.length > 0 && (
                <button
                  onClick={() => setShowAmesResults(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold
                    bg-orange-900/20 border border-orange-800/40 text-orange-400 hover:bg-orange-900/30 transition-all"
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-orange-600 text-white">↗</span>
                  Show AMES results
                </button>
              )}
            </div>
          </div>

          {!modelReady && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-amber-900/20 border border-amber-700/40 text-[11px] text-amber-300 leading-snug">
              ⚠ Train the <strong>AMES Mutagenicity</strong> model in the <strong>Property Prediction</strong> tab to enable screening.
            </div>
          )}
          {!selectedRunSaved && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-gray-900/60 border border-gray-800 text-[11px] text-gray-500 leading-snug">
              No saved results for <strong>{RUN_OPTIONS.find(o => o.value === selectedRun)?.label}</strong>. Run the optimization first.
            </div>
          )}
          {amesError && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">{amesError}</div>
          )}
        </div>

        {/* ══ Separator ══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-4 my-1">
          <div className="h-px flex-1 bg-gray-800" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800 bg-[#111111]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-60" />
            <span className="text-[10px] uppercase tracking-widest text-gray-600">
              Regulatory status — {paretoCands.length > 0 ? `${paretoCands.length} Pareto candidates` : "select a run above"}
            </span>
          </div>
          <div className="h-px flex-1 bg-gray-800" />
        </div>

        {/* ══ Regulatory table ═══════════════════════════════════════════════ */}
        <div>
          {selectedRunSaved && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                { label: "Candidates", value: regCounts.all, color: "text-gray-300" },
                { label: "EU / FEMA approved", value: regCounts.approved, color: "text-emerald-400" },
                { label: "Restricted", value: regCounts.restricted, color: "text-amber-400" },
                { label: "Not evaluated", value: regCounts.not_evaluated, color: "text-gray-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-gray-800 bg-[#111111] px-4 py-3">
                  <div className={`text-2xl font-bold ${color} mb-0.5`}>{regLoading ? "—" : value}</div>
                  <div className="text-[10px] text-gray-500">{label}</div>
                </div>
              ))}
            </div>
          )}

          {regError && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">{regError}</div>
          )}

          {selectedRunSaved && (
            <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-widest text-gray-500 mr-2">Filter</span>
                {[
                  { key: "all", label: `All (${regCounts.all})` },
                  { key: "approved", label: `Approved (${regCounts.approved})` },
                  { key: "restricted", label: `Restricted (${regCounts.restricted})` },
                  { key: "banned", label: `Banned (${regCounts.banned})` },
                  { key: "not_evaluated", label: `Not evaluated (${regCounts.not_evaluated})` },
                ].map(({ key, label }) => (
                  <button key={key}
                    onClick={() => { setRegFilter(key); setRegSelected(null); }}
                    className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all
                      ${regFilter === key
                        ? "bg-emerald-900/40 border-emerald-700/50 text-emerald-300"
                        : "bg-gray-900/40 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {regLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : regResults.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-gray-600 text-sm">No results</div>
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
                      {regFiltered.map((r, i) => {
                        const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.not_evaluated;
                        const isExpanded = regSelected === i;
                        const lookup = smilesNames[r.smiles];
                        return (
                          <>
                            <tr key={i}
                              className={`border-b border-gray-800/40 cursor-pointer transition-colors
                                ${isExpanded ? "bg-gray-900/50" : "hover:bg-gray-900/25"}
                                ${r.status === "banned" ? "bg-red-900/10" : ""}
                                ${r.status === "restricted" ? "bg-amber-900/5" : ""}`}
                              onClick={() => setRegSelected(isExpanded ? null : i)}>
                              <td className="px-3 py-2 font-medium text-gray-200">
                                {r.is_new ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-indigo-500 opacity-70" />
                                    <div>
                                      <span className="font-mono text-[9px] text-gray-400 truncate max-w-[160px] block">{r.smiles}</span>
                                      {lookup?.status === "found" && <span className="text-[9px] text-emerald-400">{lookup.name}</span>}
                                      {lookup?.status === "unknown" && <span className="text-[9px] text-gray-600">not in PubChem</span>}
                                    </div>
                                    {!lookup && (
                                      <button onClick={e => { e.stopPropagation(); lookupSmiles(r.smiles); }}
                                        className="flex-shrink-0 text-gray-600 hover:text-emerald-400 transition-colors"
                                        title="Search in PubChem">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                      </button>
                                    )}
                                    <MolImageButton smiles={r.smiles} hoverColor="hover:text-emerald-400" />
                                    {lookup?.status === "loading" && <span className="text-[9px] text-gray-600">…</span>}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                                    {r.name}
                                    <MolImageButton cid={r.cid} smiles={r.smiles} hoverColor="hover:text-emerald-400" />
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-gray-500">
                                {r.cid ? (
                                  <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="hover:text-gray-300 transition-colors"
                                    onClick={e => e.stopPropagation()}>{r.cid}</a>
                                ) : <span className="text-indigo-500/60 text-[9px]">new</span>}
                              </td>
                              <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                              <td className="px-3 py-2 font-mono text-gray-400">{r.fema ?? <span className="text-gray-600">—</span>}</td>
                              <td className="px-3 py-2 font-mono text-gray-400">{r.eu_fl ?? <span className="text-gray-600">—</span>}</td>
                              <td className="px-3 py-2 max-w-xs">
                                {r.max_use_ppm != null && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400 border border-amber-800/30">max {r.max_use_ppm} ppm</span>
                                )}
                                {r.status === "approved" && !r.restriction && <span className="text-[9px] text-gray-600">No general use limits</span>}
                                {r.restriction && !r.max_use_ppm && (
                                  <span className="text-[9px] text-gray-500 truncate" title={r.restriction}>
                                    {r.restriction.slice(0, 40)}{r.restriction.length > 40 ? "…" : ""}
                                  </span>
                                )}
                                {r.is_new && r.status === "not_evaluated" && <span className="text-[9px] text-indigo-400/60">novel structure — no regulatory record</span>}
                              </td>
                            </tr>
                            {isExpanded && r.restriction && (
                              <tr key={`${i}-exp`} className="border-b border-gray-800/40 bg-gray-900/50">
                                <td colSpan={6} className="px-5 py-3">
                                  <div className={`text-[10px] leading-relaxed ${r.status === "banned" ? "text-red-300" : r.status === "restricted" ? "text-amber-300" : "text-gray-400"}`}>
                                    <span className="font-semibold text-gray-300 mr-2">Regulatory note:</span>{r.restriction}
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
                FEMA GRAS · EU EC 1334/2008 Annex I · Click row to expand notes ·
                <span className="text-indigo-400/60 ml-1">in silico</span> candidates have no regulatory record — novel structures require full toxicological evaluation.
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── AMES modal ── */}
      {showAmesResults && amesResults?.length > 0 && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-6"
          onClick={() => setShowAmesResults(false)}>
          <div className="bg-[#111111] border border-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] uppercase tracking-widest text-gray-500">
                AMES mutagenicity — {RUN_OPTIONS.find(o => o.value === selectedRun)?.label}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600">sorted by P(mutagenic) ↓</span>
                <button onClick={() => setShowAmesResults(false)}
                  className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#0e0e0e]">
                  <tr className="border-b border-gray-800">
                    {["#", "Compound", "CID", "P(mutagenic)", "Classification", "AD Score"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {amesResults.map((r, i) => {
                    const lookup = smilesNames[r.smiles];
                    return (
                      <tr key={i} className={`border-b border-gray-800/40 ${r.mutagenic ? "bg-red-900/8" : ""}`}>
                        <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                        <td className="px-3 py-2 max-w-[220px]">
                          {r.is_new ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-gray-400 truncate max-w-[150px] block">{r.smiles}</span>
                                {!lookup && (
                                  <button onClick={() => lookupSmiles(r.smiles)}
                                    className="flex-shrink-0 text-gray-500 hover:text-orange-400 transition-colors" title="Search in PubChem">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                  </button>
                                )}
                                <MolImageButton smiles={r.smiles} hoverColor="hover:text-orange-400" />
                                {lookup?.status === "loading" && <span className="text-[9px] text-gray-600">…</span>}
                              </div>
                              {lookup?.status === "found" && <div className="text-[9px] text-emerald-400 mt-0.5">{lookup.name}</div>}
                              {lookup?.status === "unknown" && <div className="text-[9px] text-gray-600 mt-0.5">not in PubChem</div>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-200">{r.name}</span>
                              <MolImageButton cid={r.cid} smiles={r.smiles} hoverColor="hover:text-orange-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">
                          {r.cid ? (
                            <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`} target="_blank" rel="noopener noreferrer"
                              className="hover:text-gray-300 transition-colors">{r.cid}</a>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2"><AmesBar p={r.p_mutagenic} /></td>
                        <td className="px-3 py-2">
                          {r.mutagenic
                            ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/40 text-red-400 font-semibold">mutagenic ✗</span>
                            : <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 font-semibold">non-mutagenic ✓</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {r.ad_score != null ? (
                            <span style={{ color: r.ad_score >= 0.4 ? "#22c55e" : r.ad_score >= 0.2 ? "#f59e0b" : "#ef4444" }}
                              title="Max Tanimoto to AMES training set">{r.ad_score.toFixed(3)}</span>
                          ) : <span className="text-gray-700">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600 flex-shrink-0">
              RandomForest · ECFP4 (2048 bit) + 5 RDKit descriptors · P &gt; 0.5 → mutagenic ·
              AD Score = max Tanimoto to training set (green ≥ 0.4 · amber ≥ 0.2 · red = outside domain)
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Regulatory;

