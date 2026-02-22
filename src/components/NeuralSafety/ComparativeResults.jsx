import { useState, useEffect } from "react";
import { LuActivity, LuDatabase, LuGitCompare, LuZap } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ─── Category helpers ─────────────────────────────────────────────────────────
const mbCat = (s) => s >= 0.65 ? "high" : s >= 0.40 ? "mid" : "none";
const cosCat = (s, n) => s >= 0.65 && n >= 10 ? "high" : s >= 0.40 && n >= 3 ? "mid" : "none";
const sv2Cat = (s) => s >= 0.65 ? "high" : s >= 0.40 ? "mid" : "none";

const CAT_COLOR = { high: "#2dd4bf", mid: "#fbbf24", none: "#4b5563" };

const P1 = "#f97316"; // Phase 1 · Classical
const P2 = "#a855f7"; // Phase 2 · AI

// ─── Column definitions ───────────────────────────────────────────────────────
const COLS = [
  { key: "mb", label: "Classical · Global", sub: "MassBank · CosineGreedy", color: P1 },
  { key: "cos", label: "Classical · Local", sub: "ECRFS · ModifiedCosine", color: P1 },
  { key: "sv2b", label: "AI · Global", sub: "MassBank · Spec2Vec 300-D", color: P2 },
  { key: "sv2", label: "AI · Local", sub: "ECRFS · Spec2Vec 300-D", color: P2 },
];

// ─── Verdict ─────────────────────────────────────────────────────────────────
function catOf(r, key) {
  if (!r) return "none";
  if (key === "mb") return mbCat(r.score);
  if (key === "cos") return cosCat(r.similarity, r.n_matches ?? 0);
  return sv2Cat(r.similarity);
}

function verdict(mb, cos, sv2, sv2b) {
  const cats = [catOf(mb, "mb"), catOf(cos, "cos"), catOf(sv2, "sv2"), catOf(sv2b, "sv2b")];
  const highs = cats.filter((c) => c === "high").length;
  if (highs >= 2) return "confirmed";
  if (highs === 1) return "tentative";
  if (cats.some((c) => c === "mid")) return "uncertain";
  return "none";
}

const VERDICT_COLOR = {
  confirmed: "#2dd4bf", tentative: "#818cf8",
  uncertain: "#fbbf24", none: "#4b5563",
};
const VERDICT_LABEL = {
  confirmed: "Confirmed", tentative: "Tentative",
  uncertain: "Uncertain", none: "No Match",
};

// ─── TIC Chromatogram ─────────────────────────────────────────────────────────
const Chromatogram = ({ tic, peaks, selectedPeakId, onSelectPeak }) => {
  const [hovered, setHovered] = useState(null);
  if (!tic?.rt?.length) return <div className="w-full bg-[#0a0a0a] rounded" style={{ height: 130 }} />;
  const W = 700, H = 170, PL = 32, PR = 12, PT = 16, PB = 32;
  const iW = W - PL - PR, iH = H - PT - PB;
  const rtMin = tic.rt[0], rtMax = tic.rt[tic.rt.length - 1];
  const intMax = Math.max(...tic.intensity);
  const tx = (rt) => PL + ((rt - rtMin) / (rtMax - rtMin)) * iW;
  const ty = (v) => PT + iH - (v / intMax) * iH;
  const pts = tic.rt.map((rt, i) => `${tx(rt).toFixed(1)},${ty(tic.intensity[i]).toFixed(1)}`).join(" ");
  const xTicks = Array.from({ length: 7 }, (_, i) => Math.round(rtMax / 6 * i * 10) / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="w-full" style={{ height: H, display: "block", cursor: "crosshair" }}>
      <defs>
        <linearGradient id="crTicGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />
      {[0, 0.25, 0.5, 0.75, 1.0].map((t) => (
        <line key={t} x1={PL} y1={ty(t * intMax)} x2={W - PR} y2={ty(t * intMax)} stroke="#1f1f1f" strokeWidth={1} />
      ))}
      <polygon points={`${PL},${ty(0)} ${pts} ${W - PR},${ty(0)}`} fill="url(#crTicGrad)" opacity={0.25} />
      <polyline points={pts} fill="none" stroke="#2dd4bf" strokeWidth={1.5} opacity={0.7} />
      {peaks.map((pk) => {
        const x = tx(pk.rt), y = ty(pk.intensity);
        const isSel = pk.id === selectedPeakId, isHov = pk.id === hovered;
        return (
          <g key={pk.id} onClick={() => onSelectPeak(pk.id)}
            onMouseEnter={() => setHovered(pk.id)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}>
            <line x1={x} y1={y} x2={x} y2={ty(0)} stroke={isSel ? "#5eead4" : "#2dd4bf"}
              strokeWidth={isSel ? 1.5 : 1} strokeDasharray={isSel ? "none" : "3 3"}
              opacity={isSel || isHov ? 0.9 : 0.4} />
            <circle cx={x} cy={y} r={isSel ? 6 : isHov ? 5 : 4} fill={isSel ? "#5eead4" : "#2dd4bf"}
              stroke="#0a0a0a" strokeWidth={1.5} opacity={isSel || isHov ? 1 : 0.75} />
            {(isSel || isHov) && (
              <text x={x} y={y - 10} textAnchor="middle" fontSize={9}
                fill={isSel ? "#5eead4" : "#2dd4bf"} fontFamily="monospace">{pk.id}</text>
            )}
          </g>
        );
      })}
      {xTicks.map((t) => (
        <text key={t} x={tx(t)} y={H - 14} textAnchor="middle" fontSize={8} fill="#4b5563" fontFamily="monospace">
          {t.toFixed(1)}
        </text>
      ))}
      <text x={PL + iW / 2} y={H - 1} textAnchor="middle" fontSize={9} fill="#374151">RT (min)</text>
    </svg>
  );
};

// ─── Score pill ───────────────────────────────────────────────────────────────
const ScorePill = ({ value, color }) => (
  <span className="inline-flex items-center font-mono text-[9px] px-1.5 py-0.5 rounded"
    style={{ color, background: color + "22" }}>
    {(value * 100).toFixed(0)}%
  </span>
);

// ─── Method cell ──────────────────────────────────────────────────────────────
const MethodCell = ({ name, score, color, extra, unavailable }) => {
  if (unavailable) return <span className="text-[9px] text-gray-800 italic">not built</span>;
  if (!name) return <span className="text-gray-700 text-[10px]">—</span>;
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-gray-300 truncate" style={{ maxWidth: 110 }} title={name}>{name}</div>
      <div className="flex items-center gap-1 mt-0.5">
        <ScorePill value={score} color={color} />
        {extra && <span className="text-[9px] text-gray-600 font-mono">{extra}</span>}
      </div>
    </div>
  );
};

// ─── Loading spinner cell ─────────────────────────────────────────────────────
const LoadingCell = () => (
  <span className="flex items-center gap-1 text-[9px] text-gray-700">
    <span className="w-1.5 h-1.5 rounded-full bg-teal-500/40 animate-ping flex-shrink-0" />
    querying…
  </span>
);

// ─── Main component ───────────────────────────────────────────────────────────
const GRID = "26px 52px 58px 1fr 1fr 1fr 1fr 66px";

const ComparativeResults = ({ selectedFile }) => {
  const [chrom, setChrom] = useState(null);
  const [selectedPeak, setSelectedPeak] = useState(null);
  const [allResults, setAllResults] = useState({});
  const [computing, setComputing] = useState(false);
  const [activated, setActivated] = useState(false);
  const [broadReady, setBroadReady] = useState(false);

  // Check broad index status once
  useEffect(() => {
    fetch(`${BACKEND}/neural-safety/broad-index-status`)
      .then((r) => r.json())
      .then((d) => setBroadReady(d.state === "ready"))
      .catch(() => setBroadReady(false));
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    setChrom(null); setSelectedPeak(null); setAllResults({});
    setActivated(false); setComputing(false);
    fetch(`${BACKEND}/neural-safety/chromatogram/${selectedFile}`)
      .then((r) => r.json())
      .then((data) => { setChrom(data); if (data.peaks?.length) setSelectedPeak(data.peaks[0]); });
  }, [selectedFile]);

  const handleActivate = async () => {
    if (!chrom?.peaks?.length) return;
    setActivated(true);
    setComputing(true);
    setAllResults({});
    const results = {};

    const safe = (promise) => promise.then((r) => (r.ok ? r.json() : null)).catch(() => null);

    for (const peak of chrom.peaks) {
      const [mbRes, cosRes, sv2Res, sv2bRes] = await Promise.all([
        safe(fetch(`${BACKEND}/neural-safety/massbank-search`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            peaks: peak.ms2.peaks, precursor_mz: peak.precursor_mz,
            ion_mode: "POSITIVE", threshold: 0.5, top_n: 5
          }),
        })),
        safe(fetch(`${BACKEND}/neural-safety/spectral-match`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            peaks: peak.ms2.peaks, precursor_mz: peak.precursor_mz,
            tolerance: 0.01, top_n: 5
          }),
        })),
        safe(fetch(`${BACKEND}/neural-safety/spec2vec-match`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peaks: peak.ms2.peaks, top_n: 5 }),
        })),
        safe(fetch(`${BACKEND}/neural-safety/spec2vec-broad-match`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peaks: peak.ms2.peaks, top_n: 5 }),
        })),
      ]);

      results[peak.id] = {
        mb: mbRes?.results ?? [],
        cos: cosRes?.results ?? [],
        sv2: sv2Res?.results ?? [],
        sv2b: sv2bRes?.results ?? null, // null = unavailable, [] = built but no match
      };
      setAllResults({ ...results });
    }
    setComputing(false);
  };

  const handleSelectPeak = (id) => {
    const pk = chrom?.peaks?.find((p) => p.id === id);
    if (pk) setSelectedPeak(pk);
  };

  // ─── Summary stats ──────────────────────────────────────────────────────────
  const doneCount = Object.keys(allResults).length;
  const verdictCounts = Object.values(allResults).reduce((acc, r) => {
    const v = verdict(r.mb[0] ?? null, r.cos[0] ?? null, r.sv2[0] ?? null,
      r.sv2b ? (r.sv2b[0] ?? null) : null);
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});

  const noInput = !selectedFile;

  return (
    <div className="absolute inset-0 flex items-center justify-center px-12"
      style={{ paddingTop: "200px", paddingBottom: "100px" }}>
      <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800 bg-[#111111]"
        style={{ height: "min(calc(100vh - 300px), 780px)" }}>

        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded text-xs text-gray-500 font-mono">
            <LuDatabase className="w-3 h-3 text-teal-400/60 flex-shrink-0" />
            <span className="max-w-[220px] truncate">{selectedFile ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <LuGitCompare className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Comparative Results · Full Pipeline
            </span>
          </div>
          {chrom ? (
            <div className="text-[10px] text-gray-600 font-mono text-right">
              <div>{chrom.meta?.instrument}</div>
              <div>{chrom.peaks?.length} peaks detected</div>
            </div>
          ) : <div className="w-32" />}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden bg-[#111111] flex flex-col min-h-0">

          {noInput && (
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="text-gray-700 text-xs">No input file selected</div>
              <div className="text-[10px] text-gray-800">Return to the Overview tab to configure your inputs.</div>
            </div>
          )}

          {!noInput && (
            <div className="flex-1 flex min-h-0">

              {/* LEFT — Chromatogram + legend */}
              <div className="flex flex-col px-4 py-4 border-r border-gray-800 min-w-0"
                style={{ width: "30%", flexShrink: 0 }}>

                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <LuActivity className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Total Ion Chromatogram
                  </span>
                </div>
                <div className="flex-shrink-0">
                  <Chromatogram tic={chrom?.tic} peaks={chrom?.peaks ?? []}
                    selectedPeakId={selectedPeak?.id} onSelectPeak={handleSelectPeak} />
                </div>

                {/* 2×2 method grid */}
                <div className="mt-4 flex-shrink-0">
                  <div className="text-[9px] uppercase tracking-widest text-gray-700 mb-2">Methods</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "Classical · Global", sub: "MassBank · CosineGreedy", color: P1 },
                      { label: "Classical · Local", sub: "ECRFS · ModifiedCosine", color: P1 },
                      {
                        label: "AI · Global", sub: "MassBank · Spec2Vec", color: P2,
                        note: broadReady ? null : "index not built"
                      },
                      { label: "AI · Local", sub: "ECRFS · Spec2Vec", color: P2 },
                    ].map(({ label, sub, color, note }) => (
                      <div key={label} className="rounded p-2" style={{ background: color + "10", border: `1px solid ${color}22` }}>
                        <div className="text-[9px] font-semibold leading-tight" style={{ color }}>{label}</div>
                        <div className="text-[8px] text-gray-600 mt-0.5">{sub}</div>
                        {note && <div className="text-[8px] mt-0.5 italic" style={{ color: "#6b7280" }}>{note}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verdict legend */}
                <div className="mt-4 flex-shrink-0">
                  <div className="text-[9px] uppercase tracking-widest text-gray-700 mb-2">Verdict</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      ["confirmed", "≥ 2 methods HIGH (≥ 65%)"],
                      ["tentative", "1 method HIGH"],
                      ["uncertain", "≥ 1 method MID (40–65%)"],
                      ["none", "No method exceeds threshold"],
                    ].map(([v, desc]) => (
                      <div key={v} className="flex items-start gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: VERDICT_COLOR[v] }} />
                        <span className="text-[9px] text-gray-600 leading-tight">
                          <span className="font-semibold" style={{ color: VERDICT_COLOR[v] }}>{VERDICT_LABEL[v]}</span>
                          {" — "}{desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT — Comparative table */}
              <div className="flex-1 flex flex-col min-h-0 px-4 py-4">

                {/* Summary bar */}
                {activated && (
                  <div className="flex items-center gap-4 mb-2 flex-shrink-0 flex-wrap">
                    <span className="text-[9px] uppercase tracking-widest text-gray-700">
                      {doneCount}/{chrom?.peaks?.length ?? 0} processed
                    </span>
                    {Object.entries(VERDICT_LABEL).map(([v, label]) =>
                      verdictCounts[v] ? (
                        <span key={v} className="flex items-center gap-1 text-[10px]"
                          style={{ color: VERDICT_COLOR[v] }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ backgroundColor: VERDICT_COLOR[v] }} />
                          {verdictCounts[v]} {label}
                        </span>
                      ) : null
                    )}
                    {computing && (
                      <span className="text-[10px] text-teal-600/60 font-mono ml-auto animate-pulse">computing…</span>
                    )}
                  </div>
                )}

                {/* Table header — two-level */}
                <div className="flex-shrink-0 border-b border-gray-800 pb-2">
                  {/* Phase row */}
                  <div className="grid mb-1" style={{ gridTemplateColumns: GRID }}>
                    <span /><span /><span />
                    <span className="text-[8px] font-bold uppercase tracking-widest col-span-2 pb-0.5 border-b"
                      style={{ color: "#f97316", borderColor: "#f9731633" }}>
                      Phase 1 · Classical
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-widest col-span-2 pb-0.5 border-b"
                      style={{ color: "#a855f7", borderColor: "#a855f733" }}>
                      Phase 2 · AI
                    </span>
                    <span />
                  </div>
                  {/* Column labels */}
                  <div className="grid text-[9px] uppercase tracking-widest text-gray-600"
                    style={{ gridTemplateColumns: GRID }}>
                    <span>#</span>
                    <span>RT</span>
                    <span>m/z</span>
                    <span style={{ color: P1 + "aa" }}>Global · MB</span>
                    <span style={{ color: P1 + "aa" }}>Local · ECRFS</span>
                    <span style={{ color: P2 + "aa" }}>Global · MB</span>
                    <span style={{ color: P2 + "aa" }}>Local · ECRFS</span>
                    <span className="text-right">Verdict</span>
                  </div>
                </div>

                {/* Gate */}
                {!activated && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="text-center space-y-1">
                      <div className="text-[11px] text-gray-500">
                        Run the full pipeline across all 4 methods
                      </div>
                      <div className="flex items-center justify-center gap-3 mt-2">
                        {COLS.map((c) => (
                          <span key={c.key} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                            style={{ color: c.color, background: c.color + "18" }}>
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleActivate} disabled={!chrom?.peaks?.length}
                      className="flex items-center gap-2 px-6 py-3 rounded text-sm font-semibold
                        bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600
                        text-white hover:shadow-lg hover:scale-105 transition-all
                        disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100">
                      <LuZap className="w-4 h-4" />
                      run full analysis
                    </button>
                  </div>
                )}

                {/* Table rows */}
                {activated && (
                  <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    {(chrom?.peaks ?? []).map((pk) => {
                      const isSel = pk.id === selectedPeak?.id;
                      const r = allResults[pk.id] ?? null;
                      const isLoading = computing && !r;

                      const mb = r?.mb[0] ?? null;
                      const cos = r?.cos[0] ?? null;
                      const sv2 = r?.sv2[0] ?? null;
                      const sv2b = r?.sv2b ? (r.sv2b[0] ?? null) : null;
                      const sv2bUnavail = r && r.sv2b === null;

                      const v = r ? verdict(mb, cos, sv2, sv2b) : null;
                      const vc = v ? VERDICT_COLOR[v] : "#1f2937";


                      return (
                        <div key={pk.id} onClick={() => handleSelectPeak(pk.id)}
                          className={`grid items-center py-2.5 border-b border-gray-800/50 cursor-pointer transition-colors ${isSel ? "bg-teal-600/[0.06]" : "hover:bg-white/[0.02]"
                            }`}
                          style={{ gridTemplateColumns: GRID }}>

                          {/* # */}
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${isSel ? "bg-teal-500/20 text-teal-400" : "bg-gray-800 text-gray-500"
                            }`}>{pk.id}</span>

                          {/* RT */}
                          <span className="text-[10px] font-mono text-gray-400">{pk.rt.toFixed(2)}</span>

                          {/* m/z */}
                          <span className="text-[10px] font-mono text-gray-500">{pk.precursor_mz.toFixed(2)}</span>

                          {/* Classical · Global (MassBank) */}
                          {isLoading ? <LoadingCell /> : r ? (
                            <MethodCell name={mb?.name} score={mb?.score ?? 0}
                              color={mb ? CAT_COLOR[catOf(mb, "mb")] : P1} />
                          ) : <span className="text-gray-800 text-[10px]">–</span>}

                          {/* Classical · Local (ECRFS ModifiedCosine) */}
                          {isLoading ? <span /> : r ? (
                            <MethodCell name={cos?.name} score={cos?.similarity ?? 0}
                              color={cos ? CAT_COLOR[catOf(cos, "cos")] : P1}
                              extra={cos?.n_matches ? `${cos.n_matches}f` : undefined} />
                          ) : <span className="text-gray-800 text-[10px]">–</span>}

                          {/* AI · Global (MassBank Spec2Vec broad) */}
                          {isLoading ? <span /> : r ? (
                            <MethodCell name={sv2b?.name} score={sv2b?.similarity ?? 0}
                              color={sv2b ? CAT_COLOR[catOf(sv2b, "sv2b")] : P2}
                              unavailable={sv2bUnavail} />
                          ) : <span className="text-gray-800 text-[10px]">–</span>}

                          {/* AI · Local (ECRFS Spec2Vec) */}
                          {isLoading ? <span /> : r ? (
                            <MethodCell name={sv2?.name} score={sv2?.similarity ?? 0}
                              color={sv2 ? CAT_COLOR[catOf(sv2, "sv2")] : P2} />
                          ) : <span className="text-gray-800 text-[10px]">–</span>}

                          {/* Verdict */}
                          {r ? (
                            <div className="text-right pr-1">
                              <span className="text-[9px] font-semibold"
                                style={{ color: vc }}>{VERDICT_LABEL[v]}</span>
                            </div>
                          ) : <span />}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparativeResults;
