import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import MolImageButton from "./MolImageButton";
import { LuChevronDown } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const RUN_OPTIONS = [
  { value: "2obj", label: "Case: Lipophilicity-Guided Design", sub: "CNS drug-like compounds · logD + SA Score" },
  { value: "3obj", label: "Case: Sweetness Enhancer Discovery", sub: "DHC/flavanone compounds · P(sweet) + MW + logS" },
  { value: "scaffold", label: "Case: Colorant Scaffold Hopping", sub: "natural pigments · conj. score + MW + reg. score" },
];

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
      <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${Math.round(p * 100)}%`, background: color }} />
      </div>
      <span className="font-mono text-[9px]" style={{ color }}>{p.toFixed(3)}</span>
    </div>
  );
};

const Regulatory = () => {
  const [selectedRun, setSelectedRun] = useState("2obj");
  const [savedRuns, setSavedRuns] = useState({ "2obj": false, "3obj": false, "scaffold": false });
  const [modelReady, setModelReady] = useState(false);
  const [paretoCands, setParetoCands] = useState([]);
  const [paretoLoading, setParetoLoading] = useState(false);
  const [amesResults, setAmesResults] = useState(null);
  const [amesMeta, setAmesMeta] = useState(null);
  const [amesLoading, setAmesLoading] = useState(false);
  const [amesError, setAmesError] = useState(null);
  const [smilesNames, setSmilesNames] = useState({});
  const [regResults, setRegResults] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regFilter, setRegFilter] = useState("all");
  const [regSelected, setRegSelected] = useState(null);
  const [runDropOpen, setRunDropOpen] = useState(false);

  // --- Logic (Unchanged) ---
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
      const compounds = pareto.map(c => ({ cid: c.cid ?? null, name: c.name ?? null, smiles: c.smiles }));
      const regRes = await fetch(`${BACKEND}/molecule-finder/regulatory-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compounds }),
      });
      if (!regRes.ok) throw new Error(await regRes.text());
      const regData = await regRes.json();
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

  useEffect(() => {
    if (Object.values(savedRuns).some(v => v !== false)) {
      loadRun(selectedRun);
    }
  }, [selectedRun, savedRuns, loadRun]);

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

  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-20"
      style={{ paddingTop: 200, paddingBottom: 100 }}
    >
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-4">

        {/* ══ 1. TOP LEFT DROPDOWN ════════════════════════════════════════════ */}
        <div className="flex justify-start">
          <div className="relative w-[320px]">
            <label className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 block">Selected Use Case</label>
            <button
              onClick={() => setRunDropOpen(o => !o)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-[#111111] border border-gray-800 rounded-xl text-sm transition-colors hover:border-gray-600"
            >
              <div className="text-left truncate">
                <div className="text-gray-300 font-medium text-xs">{RUN_OPTIONS.find(o => o.value === selectedRun)?.label}</div>
                <div className="text-[9px] text-gray-600 truncate">{RUN_OPTIONS.find(o => o.value === selectedRun)?.sub}</div>
              </div>
              <LuChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${runDropOpen ? "rotate-180" : ""}`} />
            </button>

            {runDropOpen && (
              <div className="absolute z-[100] mt-2 w-full bg-[#111111] border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
                {RUN_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => { setSelectedRun(o.value); setRunDropOpen(false); }}
                    className="w-full text-left px-4 py-3 border-b border-gray-800/40 last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="text-xs text-gray-400">{o.label}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">{o.sub}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alerts for state */}
        {!modelReady && (
          <div className="px-4 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40 text-[11px] text-amber-300">
            ⚠ Train the <strong>AMES Mutagenicity</strong> model in <strong>Property Prediction</strong> to enable screening.
          </div>
        )}
        {!selectedRunSaved && (
          <div className="px-4 py-2 rounded-lg bg-gray-900/60 border border-gray-800 text-[11px] text-gray-500">
            No saved results for this run. Please complete optimization first.
          </div>
        )}

        {/* ══ 2. TWO COLUMN CONTENT ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── COLUMN LEFT: AMES SCREEN ── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Ames Mutagenicity Screen</h3>

            </div>

            <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-450px)]">
              <div className="h-20 p-4 border-b border-gray-800 bg-[#0e0e0e] grid grid-cols-4 gap-2 text-center items-center">
                <div>
                  <div className="text-xl font-bold text-gray-300">{amesLoading ? "..." : (paretoCands.length || "—")}</div>
                  <div className="text-[9px] text-gray-600 uppercase">Pareto</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-400">{amesLoading ? "..." : (amesMeta?.n_safe ?? "—")}</div>
                  <div className="text-[9px] text-gray-600 uppercase">Safe</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-400">{amesLoading ? "..." : (amesMeta?.n_mutagenic ?? "—")}</div>
                  <div className="text-[9px] text-gray-600 uppercase">Mutagenic</div>
                </div>
                <div>
                  <button
                    onClick={fetchAmes}
                    disabled={!modelReady || !selectedRunSaved || amesLoading || paretoLoading}
                    className="px-4 py-1.5 rounded-lg text-[10px] font-bold bg-orange-900/30 border border-orange-700/50 text-orange-300 hover:bg-orange-800/40 disabled:opacity-30 transition-all"
                  >
                    {amesLoading ? "Running..." : "Run Pareto Screen"}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto relative">
                {!amesResults ? (
                  <div className="h-full flex items-center justify-center text-gray-700 text-xs italic p-10 text-center">
                    Results will appear here after running the screen.
                  </div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[#0e0e0e] z-10 border-b border-gray-800 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Compound</th>
                        <th className="px-3 py-2 text-left">P(mut)</th>
                        <th className="px-3 py-2 text-left">AD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {amesResults.map((r, i) => (
                        <tr key={i} className={r.mutagenic ? "bg-red-900/5" : ""}>
                          <td className="px-3 py-2">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-start gap-2">
                                {/* Rimosso truncate e max-w, aggiunto break-all */}
                                <span className="font-mono text-[9px] text-indigo-400 break-all whitespace-normal leading-tight">
                                  {r.smiles}
                                </span>

                                <div className="flex-shrink-0 mt-0.5">
                                  <MolImageButton cid={r.cid} smiles={r.smiles} hoverColor="hover:text-orange-400" />
                                </div>

                                {!smilesNames[r.smiles] && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); lookupSmiles(r.smiles); }}
                                    className="mt-1 flex-shrink-0 text-gray-600 hover:text-orange-400 transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                  </button>
                                )}
                              </div>

                              {smilesNames[r.smiles]?.status === "found" && (
                                <span className="text-[8px] text-emerald-500 mt-1 leading-none italic">
                                  {smilesNames[r.smiles].name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2"><AmesBar p={r.p_mutagenic} /></td>
                          <td className="px-3 py-2 font-mono text-gray-600">{r.ad_score?.toFixed(2) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="p-3 bg-[#0e0e0e] border-t border-gray-800 text-[9px] text-gray-600 italic">
                RF Model: ECFP4 + 5 RDKit descriptors. P &gt; 0.5 flagged as mutagenic.
              </div>
            </div>
          </div>

          {/* ── COLUMN RIGHT: REGULATORY ── */}
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Regulatory Compliance</h3>

            <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-450px)]">
              <div className="h-20 p-4 border-b border-gray-800 bg-[#0e0e0e] flex items-center gap-2 flex-wrap">
                {["all", "approved", "restricted", "not_evaluated"].map(k => (
                  <button key={k} onClick={() => setRegFilter(k)}
                    className={`px-2 py-1 rounded border text-[9px] font-bold uppercase transition-all ${regFilter === k ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-400" : "bg-gray-900/50 border-gray-800 text-gray-600"}`}>
                    {k.replace('_', ' ')} ({regCounts[k]})
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto">
                {regLoading ? (
                  <div className="h-full flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-[#0e0e0e] z-10 border-b border-gray-800 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Structure</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">FEMA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {regFiltered.map((r, i) => (
                        <tr key={i} className={`hover:bg-white/[0.02] cursor-pointer ${regSelected === i ? "bg-emerald-900/5" : ""}`} onClick={() => setRegSelected(regSelected === i ? null : i)}>
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              <div className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5" style={{ background: (STATUS_CONFIG[r.status] || STATUS_CONFIG.not_evaluated).dot }} />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-start gap-2">
                                  {/* Mostra sempre lo SMILES e permette il wrap del testo */}
                                  <span className="font-mono text-[9px] text-indigo-400/80 break-all whitespace-normal leading-tight">
                                    {r.smiles}
                                  </span>

                                  <div className="flex-shrink-0">
                                    <MolImageButton cid={r.cid} smiles={r.smiles} hoverColor="hover:text-emerald-400" />
                                  </div>
                                </div>

                                {smilesNames[r.smiles]?.status === "found" && (
                                  <span className="text-[8px] text-emerald-500 mt-1 leading-none italic">
                                    {smilesNames[r.smiles].name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-2 font-mono text-gray-600">{r.fema || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {regSelected !== null && regResults[regSelected] && (
                <div className="p-4 bg-emerald-900/10 border-t border-emerald-900/30 animate-in slide-in-from-bottom-2">
                  <div className="text-[10px] text-emerald-300 font-bold mb-1 uppercase tracking-tighter">
                    Compound Details:
                  </div>
                  <div className="text-[9px] font-mono text-indigo-300/60 break-all mb-2">
                    {regResults[regSelected].smiles}
                  </div>
                  <div className="text-[10px] text-gray-400 leading-relaxed italic">
                    {regResults[regSelected].restriction || "No specific restrictions found in FEMA/EU annexes."}
                  </div>
                </div>
              )}

              <div className="p-3 bg-[#0e0e0e] border-t border-gray-800 text-[9px] text-gray-600">
                Cross-referenced: FEMA GRAS & EU 1334/2008 Annex I.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Regulatory;