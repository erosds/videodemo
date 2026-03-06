import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BACKEND = "http://localhost:8000";

// ── Regulatory compounds list ──────────────────────────────────────────────────
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

// ── Regulatory status config ───────────────────────────────────────────────────
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

// ── AMES probability bar ───────────────────────────────────────────────────────
const AmesBar = ({ p }) => {
  const pct = Math.round(p * 100);
  const color = p > 0.5 ? "#ef4444" : p > 0.3 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px]" style={{ color }}>{p.toFixed(3)}</span>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const SafetyAndCompliance = () => {
  // AMES state
  const [amesResults, setAmesResults]       = useState([]);
  const [amesLoading, setAmesLoading]       = useState(false);
  const [amesError, setAmesError]           = useState(null);
  const [amesMeta, setAmesMeta]             = useState(null);
  const [modelReady, setModelReady]         = useState(false);
  const [savedRunsExist, setSavedRunsExist] = useState(false);
  const [showAmesResults, setShowAmesResults] = useState(false);
  const [smilesNames, setSmilesNames]       = useState({});

  // Regulatory state
  const [regResults, setRegResults]         = useState([]);
  const [regLoading, setRegLoading]         = useState(false);
  const [regError, setRegError]             = useState(null);
  const [filter, setFilter]                 = useState("all");
  const [selected, setSelected]             = useState(null);
  const [showFullList, setShowFullList]     = useState(false);

  // Match state (Pareto candidates vs regulatory list)
  const [paretoCandidates, setParetoCandidates] = useState([]);
  const [matchResults, setMatchResults]     = useState([]);
  const [matchLoading, setMatchLoading]     = useState(false);
  const [matchError, setMatchError]         = useState(null);
  const [matchMeta, setMatchMeta]           = useState(null);
  const [showMatchResults, setShowMatchResults] = useState(false);

  // Check model status + saved runs + fetch regulatory on mount
  useEffect(() => {
    let amesIsReady = false;
    let savedExist  = false;
    const tryAutoFetch = () => { if (amesIsReady && savedExist) fetchAmes(); };

    fetch(`${BACKEND}/molecule-finder/available-datasets`)
      .then(r => r.ok ? r.json() : [])
      .then(datasets => {
        const ames = datasets.find(d => d.id === "ames_mutagenicity");
        if (ames?.n_cached) { setModelReady(true); amesIsReady = true; tryAutoFetch(); }
      })
      .catch(() => {});

    Promise.all([
      fetch(`${BACKEND}/molecule-finder/saved-optimization/2obj`).then(r => r.status === 204 ? null : r.ok ? r.json() : null),
      fetch(`${BACKEND}/molecule-finder/saved-optimization/3obj`).then(r => r.status === 204 ? null : r.ok ? r.json() : null),
    ]).then(([r2, r3]) => {
      const seen = new Set();
      const candidates = [];
      for (const [saved, runLabel] of [[r2, "Aroma 2-obj"], [r3, "Taste 3-obj"]]) {
        if (!saved?.generations?.length) continue;
        const lastGen = saved.generations[saved.generations.length - 1];
        for (const c of (lastGen.candidates ?? [])) {
          if (c.dominated || !c.smiles || seen.has(c.smiles)) continue;
          seen.add(c.smiles);
          candidates.push({ ...c, _run: runLabel });
        }
      }
      if (candidates.length > 0) {
        setSavedRunsExist(true);
        savedExist = true;
        setParetoCandidates(candidates);
        tryAutoFetch();
      }
    }).catch(() => {});

    fetchRegulatory();
  }, []);

  const fetchAmes = async () => {
    setAmesLoading(true);
    setAmesError(null);
    try {
      const res = await fetch(`${BACKEND}/molecule-finder/safety-screen-pareto`);
      if (res.status === 409) { setModelReady(false); return; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAmesResults(data.results ?? []);
      setAmesMeta({ n_total: data.n_total, n_mutagenic: data.n_mutagenic, n_safe: data.n_safe });
      setModelReady(true);
    } catch (e) {
      setAmesError(e.message);
    } finally {
      setAmesLoading(false);
    }
  };

  const fetchRegulatory = async () => {
    setRegLoading(true);
    setRegError(null);
    try {
      const res = await fetch(`${BACKEND}/molecule-finder/regulatory-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compounds: REGULATORY_COMPOUNDS }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRegResults(data.results ?? []);
    } catch (e) {
      setRegError(e.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleMatch = async () => {
    if (paretoCandidates.length === 0) return;
    setMatchLoading(true);
    setMatchError(null);
    try {
      const compounds = paretoCandidates.map(c => ({ cid: c.cid ?? null, name: c.name ?? null, smiles: c.smiles }));
      const res = await fetch(`${BACKEND}/molecule-finder/regulatory-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compounds }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const results = (data.results ?? []).map((r, i) => ({
        ...r,
        _run:   paretoCandidates[i]?._run,
        is_new: paretoCandidates[i]?.is_new ?? false,
        smiles: paretoCandidates[i]?.smiles,
      }));
      setMatchResults(results);
      setMatchMeta({
        n_total:         results.length,
        n_approved:      data.n_approved      ?? 0,
        n_restricted:    data.n_restricted    ?? 0,
        n_not_evaluated: data.n_not_evaluated ?? 0,
      });
    } catch (e) {
      setMatchError(e.message);
    } finally {
      setMatchLoading(false);
    }
  };

  const lookupSmiles = async (smiles) => {
    setSmilesNames(prev => ({ ...prev, [smiles]: { status: "loading" } }));
    try {
      const r = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/property/IUPACName/JSON`
      );
      if (!r.ok) throw new Error();
      const data = await r.json();
      const name = data?.PropertyTable?.Properties?.[0]?.IUPACName;
      setSmilesNames(prev => ({ ...prev, [smiles]: name ? { status: "found", name } : { status: "unknown" } }));
    } catch {
      setSmilesNames(prev => ({ ...prev, [smiles]: { status: "unknown" } }));
    }
  };

  const filtered = filter === "all" ? regResults : regResults.filter(r => r.status === filter);
  const counts = {
    all:           regResults.length,
    approved:      regResults.filter(r => r.status === "approved").length,
    restricted:    regResults.filter(r => r.status === "restricted").length,
    banned:        regResults.filter(r => r.status === "banned").length,
    not_evaluated: regResults.filter(r => r.status === "not_evaluated").length,
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

        {/* ══ Section 1: AMES Mutagenicity Safety Gate ══════════════════════ */}
        <div>
          {/* Single-row header: description + stats + actions */}
          <div className="flex gap-3 items-stretch mb-4">

            {/* Description */}
            <div className="flex-1 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 text-[10px] text-gray-500 leading-relaxed min-w-0">
              <div className="text-gray-400 font-semibold mb-1">AMES Mutagenicity</div>
              Bacterial reverse-mutation assay — primary genotoxicity screen required by{" "}
              <span className="text-gray-400">EFSA (EC 2232/96)</span>.
              RF trained on <span className="text-gray-400">7,278 compounds</span> (Harvard / TDC).
              Screens <span className="text-gray-400">Pareto-optimal candidates</span> from saved runs.
              Threshold P &gt; 0.5 → mutagenic.
            </div>

            {/* Stats */}
            {[
              { label: "Candidates screened", value: amesMeta?.n_total     ?? "—", color: "text-gray-300" },
              { label: "Non-mutagenic",        value: amesMeta?.n_safe      ?? "—", color: "text-emerald-400" },
              { label: "Mutagenic",            value: amesMeta?.n_mutagenic ?? "—", color: "text-red-400" },
              { label: "Safety gate",          value: "P < 0.5",                   color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-shrink-0 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 min-w-[100px]">
                <div className={`text-2xl font-bold ${color} mb-0.5`}>{amesLoading ? "—" : value}</div>
                <div className="text-[10px] text-gray-500 whitespace-nowrap">{label}</div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex-shrink-0 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 flex flex-col gap-2 justify-center">
              <button
                onClick={fetchAmes}
                disabled={!modelReady || !savedRunsExist || amesLoading}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                  bg-orange-900/30 border-orange-700/50 text-orange-300 hover:bg-orange-800/40
                  disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {amesLoading ? "Running…" : amesMeta ? "↺ Re-run" : "▶ Run AMES"}
              </button>
              {amesMeta && amesResults.length > 0 && (
                <button
                  onClick={() => setShowAmesResults(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold
                    bg-orange-900/20 border border-orange-800/40 text-orange-400 hover:bg-orange-900/30 transition-all whitespace-nowrap"
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-orange-600 text-white">↗</span>
                  Show results
                </button>
              )}
            </div>

          </div>

          {/* Warnings */}
          {!modelReady && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-amber-900/20 border border-amber-700/40 text-[11px] text-amber-300 leading-snug">
              ⚠ Train the <strong>AMES Mutagenicity</strong> model in the <strong>Property Prediction</strong> tab first.
            </div>
          )}
          {modelReady && !savedRunsExist && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-gray-900/60 border border-gray-800 text-[11px] text-gray-500 leading-snug">
              No saved optimization results. Run <strong>Case: Aroma Compound Design</strong> or <strong>Case: Taste-Guided Design</strong> first.
            </div>
          )}
          {amesError && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">
              {amesError}
            </div>
          )}
        </div>

        {/* AMES results modal */}
        {showAmesResults && amesResults.length > 0 && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-6"
            onClick={() => setShowAmesResults(false)}>
            <div className="bg-[#111111] border border-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  AMES mutagenicity — Pareto candidates
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
                      {["#", "Compound", "Run", "CID", "P(mutagenic)", "Classification", "AD Score"].map(h => (
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
                                      className="flex-shrink-0 text-gray-500 hover:text-orange-400 transition-colors"
                                      title="Search in PubChem">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                      </svg>
                                    </button>
                                  )}
                                  {lookup?.status === "loading" && <span className="text-[9px] text-gray-600">…</span>}
                                </div>
                                {lookup?.status === "found" && <div className="text-[9px] text-emerald-400 mt-0.5">{lookup.name}</div>}
                                {lookup?.status === "unknown" && <div className="text-[9px] text-gray-600 mt-0.5">not in PubChem</div>}
                              </div>
                            ) : (
                              <span className="font-medium text-gray-200">{r.name}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-[10px]">{r.run ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">
                            {r.cid ? (
                              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`}
                                target="_blank" rel="noopener noreferrer"
                                className="hover:text-gray-300 transition-colors">
                                {r.cid}
                              </a>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2"><AmesBar p={r.p_mutagenic} /></td>
                          <td className="px-3 py-2">
                            {r.mutagenic ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/40 text-red-400 font-semibold">mutagenic ✗</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 font-semibold">non-mutagenic ✓</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {r.ad_score != null ? (
                              <span style={{ color: r.ad_score >= 0.4 ? "#22c55e" : r.ad_score >= 0.2 ? "#f59e0b" : "#ef4444" }}
                                title="Max Tanimoto similarity to AMES training set">
                                {r.ad_score.toFixed(3)}
                              </span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600 flex-shrink-0">
                RandomForest · ECFP4 (2048 bit) + 5 RDKit descriptors · Threshold P &gt; 0.5 → mutagenic ·
                AD Score = max Tanimoto to AMES training set (green ≥ 0.4 · amber ≥ 0.2 · red = outside domain) ·
                <span className="ml-1 text-gray-700">In silico prediction only — not a substitute for wet-lab AMES assay.</span>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ══ Separator ══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-4 my-1">
          <div className="h-px flex-1 bg-gray-800" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800 bg-[#111111]">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 opacity-60" />
            <span className="text-[10px] uppercase tracking-widest text-gray-600">Next step — Regulatory Compliance</span>
          </div>
          <div className="h-px flex-1 bg-gray-800" />
        </div>

        {/* ══ Section 2: Regulatory Check ═══════════════════════════════════ */}
        <div>
          {/* Single-row header */}
          <div className="flex gap-3 items-stretch mb-4">

            {/* Description */}
            <div className="flex-1 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 text-[10px] text-gray-500 leading-relaxed min-w-0">
              <div className="text-gray-400 font-semibold mb-1">Regulatory Status</div>
              Cross-reference Pareto candidates against{" "}
              <span className="text-gray-400">FEMA GRAS</span> (US) and{" "}
              <span className="text-gray-400">EU EC 1334/2008</span> Union List of approved flavouring substances.
              Known compounds are matched by CID — in silico candidates have no regulatory record yet.
            </div>

            {/* Stats (from match if run, else from full reference list) */}
            {[
              { label: "Candidates matched", value: matchMeta?.n_total         ?? regResults.length,    color: "text-gray-300" },
              { label: "Approved",           value: matchMeta?.n_approved      ?? regResults.filter(r => r.status === "approved").length,   color: "text-emerald-400" },
              { label: "Restricted",         value: matchMeta?.n_restricted    ?? regResults.filter(r => r.status === "restricted").length,  color: "text-amber-400" },
              { label: "Not evaluated",      value: matchMeta?.n_not_evaluated ?? regResults.filter(r => r.status === "not_evaluated").length, color: "text-gray-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-shrink-0 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 min-w-[100px]">
                <div className={`text-2xl font-bold ${color} mb-0.5`}>{matchLoading || regLoading ? "—" : value}</div>
                <div className="text-[10px] text-gray-500 whitespace-nowrap">{label}</div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex-shrink-0 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 flex flex-col gap-2 justify-center">
              <button
                onClick={handleMatch}
                disabled={paretoCandidates.length === 0 || matchLoading}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                  bg-rose-900/30 border-rose-700/50 text-rose-300 hover:bg-rose-800/40
                  disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {matchLoading ? "Matching…" : matchMeta ? "↺ Re-match" : "▶ Match candidates"}
              </button>
              {matchMeta && matchResults.length > 0 && (
                <button
                  onClick={() => setShowMatchResults(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold
                    bg-rose-900/20 border border-rose-800/40 text-rose-400 hover:bg-rose-900/30 transition-all whitespace-nowrap"
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-rose-600 text-white">↗</span>
                  Show match
                </button>
              )}
              <button
                onClick={() => setShowFullList(true)}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-700
                  text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all whitespace-nowrap"
              >
                ≡ Full reference list
              </button>
            </div>

          </div>

          {matchError && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">
              {matchError}
            </div>
          )}
          {paretoCandidates.length === 0 && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-gray-900/60 border border-gray-800 text-[11px] text-gray-500 leading-snug">
              No saved optimization results. Run <strong>Case: Aroma Compound Design</strong> or <strong>Case: Taste-Guided Design</strong> first.
            </div>
          )}
        </div>

        {/* Match results modal */}
        {showMatchResults && matchResults.length > 0 && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-6"
            onClick={() => setShowMatchResults(false)}>
            <div className="bg-[#111111] border border-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  Regulatory match — Pareto candidates
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600">FEMA GRAS · EU EC 1334/2008</span>
                  <button onClick={() => setShowMatchResults(false)}
                    className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#0e0e0e]">
                    <tr className="border-b border-gray-800">
                      {["#", "Compound", "Run", "CID", "Status", "FEMA #", "EU FL #", "Notes"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matchResults.map((r, i) => {
                      const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.not_evaluated;
                      const lookup = smilesNames[r.smiles];
                      return (
                        <tr key={i} className={`border-b border-gray-800/40
                          ${r.status === "banned" ? "bg-red-900/10" : ""}
                          ${r.status === "restricted" ? "bg-amber-900/5" : ""}`}>
                          <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                          <td className="px-3 py-2 max-w-[200px]">
                            {r.is_new ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[9px] text-gray-400 truncate max-w-[140px] block">{r.smiles}</span>
                                  {!lookup && (
                                    <button onClick={() => lookupSmiles(r.smiles)}
                                      className="flex-shrink-0 text-gray-500 hover:text-rose-400 transition-colors"
                                      title="Search in PubChem">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                      </svg>
                                    </button>
                                  )}
                                  {lookup?.status === "loading" && <span className="text-[9px] text-gray-600">…</span>}
                                </div>
                                {lookup?.status === "found" && <div className="text-[9px] text-emerald-400 mt-0.5">{lookup.name}</div>}
                                {lookup?.status === "unknown" && <div className="text-[9px] text-gray-600 mt-0.5">not in PubChem</div>}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                                <span className="font-medium text-gray-200">{r.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-[10px]">{r._run ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">
                            {r.cid ? (
                              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${r.cid}`}
                                target="_blank" rel="noopener noreferrer"
                                className="hover:text-gray-300 transition-colors">{r.cid}</a>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-2 font-mono text-gray-400">{r.fema ?? <span className="text-gray-600">—</span>}</td>
                          <td className="px-3 py-2 font-mono text-gray-400">{r.eu_fl ?? <span className="text-gray-600">—</span>}</td>
                          <td className="px-3 py-2 max-w-[160px]">
                            {r.max_use_ppm != null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400 border border-amber-800/30">max {r.max_use_ppm} ppm</span>
                            )}
                            {r.status === "approved" && !r.restriction && (
                              <span className="text-[9px] text-gray-600">No use limits</span>
                            )}
                            {r.status === "not_evaluated" && (
                              <span className="text-[9px] text-gray-600">Not in FEMA / EU list</span>
                            )}
                            {r.restriction && !r.max_use_ppm && (
                              <span className="text-[9px] text-gray-500 truncate block" title={r.restriction}>
                                {r.restriction.slice(0, 35)}{r.restriction.length > 35 ? "…" : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600 flex-shrink-0">
                In silico candidates have no regulatory record — novel structures require full toxicological evaluation before approval.
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Full reference list modal */}
        {showFullList && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-6"
            onClick={() => setShowFullList(false)}>
            <div className="bg-[#111111] border border-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  Reference list — 41 food aromatics
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[
                      { key: "all", label: `All (${regResults.length})` },
                      { key: "approved", label: `Approved` },
                      { key: "restricted", label: `Restricted` },
                      { key: "banned", label: `Banned` },
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => { setFilter(key); setSelected(null); }}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-semibold border transition-all
                          ${filter === key ? "bg-rose-900/40 border-rose-700/50 text-rose-300" : "bg-gray-900/40 border-gray-800 text-gray-500 hover:text-gray-300"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowFullList(false)}
                    className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
                </div>
              </div>
              {regLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[#0e0e0e]">
                      <tr className="border-b border-gray-800">
                        {["Compound", "CID", "Status", "FEMA #", "EU FL #", "Notes"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(filter === "all" ? regResults : regResults.filter(r => r.status === filter)).map((r, i) => {
                        const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.not_evaluated;
                        const isExpanded = selected === i;
                        return (
                          <>
                            <tr key={i}
                              className={`border-b border-gray-800/40 cursor-pointer transition-colors
                                ${isExpanded ? "bg-gray-900/50" : "hover:bg-gray-900/25"}
                                ${r.status === "banned" ? "bg-red-900/10" : ""}
                                ${r.status === "restricted" ? "bg-amber-900/5" : ""}`}
                              onClick={() => setSelected(isExpanded ? null : i)}>
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
                                    onClick={e => e.stopPropagation()}>{r.cid}</a>
                                ) : "—"}
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
                                {!r.restriction && r.status === "not_evaluated" && <span className="text-[9px] text-gray-600">Not in FEMA or EU list</span>}
                              </td>
                            </tr>
                            {isExpanded && r.restriction && (
                              <tr key={`${i}-detail`} className="border-b border-gray-800/40 bg-gray-900/50">
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
              <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600 flex-shrink-0">
                FEMA GRAS · EU EC 1334/2008 Annex I · Click row to expand notes ·
                <span className="text-emerald-500 ml-1">approved</span> = no limits ·
                <span className="text-amber-500 ml-1">restricted</span> = max ppm applies ·
                <span className="text-red-500 ml-1">banned</span> = not permitted.
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </div>
  );
};

export default SafetyAndCompliance;
