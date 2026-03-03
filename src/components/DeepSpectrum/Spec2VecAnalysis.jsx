import { useState, useEffect, useRef } from "react";
import { LuActivity, LuDatabase, LuSparkles, LuGlobe, LuZap, LuFolderOpen, LuInfo } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ─── TIC Chromatogram (same as SpectralMatching) ─────────────────────────────
const Chromatogram = ({ tic, peaks, selectedPeakId, onSelectPeak }) => {
  const [hovered, setHovered] = useState(null);

  if (!tic?.rt?.length) return <div className="w-full bg-[#0a0a0a] rounded" style={{ height: 130 }} />;

  const W = 700, H = 180, PL = 32, PR = 12, PT = 20, PB = 36;
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
        <linearGradient id="sv2TicGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />
      {[0, 0.25, 0.5, 0.75, 1.0].map((t) => (
        <line key={t} x1={PL} y1={ty(t * intMax)} x2={W - PR} y2={ty(t * intMax)}
          stroke="#1f1f1f" strokeWidth={1} />
      ))}
      <polygon points={`${PL},${ty(0)} ${pts} ${W - PR},${ty(0)}`}
        fill="url(#sv2TicGrad)" opacity={0.25} />
      <polyline points={pts} fill="none" stroke="#a855f7" strokeWidth={1.5} opacity={0.7} />

      {peaks.map((pk) => {
        const x = tx(pk.rt), y = ty(pk.intensity);
        const isSel = pk.id === selectedPeakId, isHov = pk.id === hovered;
        return (
          <g key={pk.id} onClick={() => onSelectPeak(pk.id)}
            onMouseEnter={() => setHovered(pk.id)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}>
            <line x1={x} y1={y} x2={x} y2={ty(0)}
              stroke={isSel ? "#5e44ef" : "#a855f7"}
              strokeWidth={isSel ? 1.5 : 1}
              strokeDasharray={isSel ? "none" : "3 3"}
              opacity={isSel || isHov ? 0.8 : 0.4} />
            <circle cx={x} cy={y} r={isSel ? 6 : isHov ? 5 : 4}
              fill={isSel ? "#5e44ef" : "#a855f7"}
              stroke="#0a0a0a" strokeWidth={1.5}
              opacity={isSel || isHov ? 1 : 0.75} />
            {(isSel || isHov) && (
              <text x={x} y={y - 10} textAnchor="middle"
                fontSize={9} fill={isSel ? "#5e44ef" : "#a855f7"} fontFamily="monospace">
                {pk.id}
              </text>
            )}
          </g>
        );
      })}

      {xTicks.map((t) => (
        <text key={t} x={tx(t)} y={H - 16} textAnchor="middle"
          fontSize={8} fill="#4b5563" fontFamily="monospace">{t.toFixed(1)}</text>
      ))}
      <text x={PL + iW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="#374151">RT (min)</text>
      <text x={8} y={PT + iH / 2} textAnchor="middle" fontSize={12} fill="#374151"
        transform={`rotate(-90, 8, ${PT + iH / 2})`}>Intensity</text>
    </svg>
  );
};

// ─── Similarity bar ───────────────────────────────────────────────────────────
const SimBar = ({ value, color, suffix }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all"
        style={{ width: `${value * 100}%`, backgroundColor: color }} />
    </div>
    <span className="text-[10px] font-mono text-right" style={{ color }}>
      {(value * 100).toFixed(0)}%{suffix ? <span className="text-[8px] text-gray-700 ml-0.5">{suffix}</span> : null}
    </span>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatLibName = (stem) =>
  stem?.replace(/_/g, " ").replace(/\bfinal\b/gi, "").replace(/\s+/g, " ").trim() ?? "ECRFS Library";

// ─── Main component ───────────────────────────────────────────────────────────
const Spec2VecAnalysis = ({ selectedFile, activeLib }) => {
  const [chrom, setChrom] = useState(null);
  const [selectedPeak, setSelectedPeak] = useState(null);
  const [allResults, setAllResults] = useState({});
  const [computing, setComputing] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState(null);
  const [libInfo, setLibInfo] = useState(null);

  // ── Broad search mode ────────────────────────────────────────
  const [broadMode, setBroadMode] = useState(true);
  const [broadStatus, setBroadStatus] = useState(null);   // {state,progress,n_spectra,message}
  const [broadResults, setBroadResults] = useState({});     // { [peakId]: [...] }
  const [broadComputing, setBroadComputing] = useState(false);
  const [broadActivated, setBroadActivated] = useState(false);
  const pollRef = useRef(null);

  // Reset local results and fetch lib info when activeLib changes
  useEffect(() => {
    setActivated(false);
    setAllResults({});
    setError(null);
    setLibInfo(null);
    fetch(`${BACKEND}/deep-spectrum/libraries`)
      .then((r) => r.json())
      .then((libs) => {
        const target = activeLib ?? null;
        const found = target
          ? libs.find((l) => l.id === target)
          : libs.find((l) => l.id === "ECRFS_library_final" || l.is_default) ?? libs[0];
        if (found) setLibInfo(found);
      })
      .catch(() => {});
  }, [activeLib]);

  // Poll broad index status while building
  useEffect(() => {
    if (!broadMode) return;
    const poll = () => {
      fetch(`${BACKEND}/deep-spectrum/broad-index-status`)
        .then((r) => r.json())
        .then((s) => {
          setBroadStatus(s);
          if (s.state === "building") {
            pollRef.current = setTimeout(poll, 1500);
          }
        })
        .catch(() => { });
    };
    poll();
    return () => clearTimeout(pollRef.current);
  }, [broadMode]);

  const handleBuildIndex = () => {
    fetch(`${BACKEND}/deep-spectrum/build-broad-index`, { method: "POST" })
      .then((r) => r.json())
      .then((s) => {
        setBroadStatus(s);
        if (s.state === "building") {
          // kick off polling
          setBroadMode(true);
        }
      })
      .catch(() => { });
  };

  const handleBroadActivate = async () => {
    if (!chrom?.peaks?.length) return;
    setBroadActivated(true);
    setBroadComputing(true);
    setBroadResults({});
    const results = {};
    for (const peak of chrom.peaks) {
      try {
        const res = await fetch(`${BACKEND}/deep-spectrum/spec2vec-broad-match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peaks: peak.ms2.peaks, top_n: 10 }),
        });
        const data = await res.json();
        results[peak.id] = data.results ?? [];
      } catch {
        results[peak.id] = [];
      }
      setBroadResults({ ...results });
    }
    setBroadComputing(false);
  };

  useEffect(() => {
    if (!selectedFile) return;
    setChrom(null); setSelectedPeak(null); setAllResults({});
    setActivated(false); setComputing(false); setError(null);
    setBroadResults({}); setBroadActivated(false); setBroadComputing(false);
    fetch(`${BACKEND}/deep-spectrum/chromatogram/${selectedFile}`)
      .then((r) => r.json())
      .then((data) => { setChrom(data); if (data.peaks?.length) setSelectedPeak(data.peaks[0]); });
  }, [selectedFile]);

  const handleActivate = async () => {
    if (!chrom?.peaks?.length) return;
    setActivated(true);
    setComputing(true);
    setAllResults({});
    setError(null);
    const results = {};
    for (const peak of chrom.peaks) {
      try {
        const [cosineRes, sv2Res] = await Promise.all([
          fetch(`${BACKEND}/deep-spectrum/spectral-match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peaks: peak.ms2.peaks, precursor_mz: peak.precursor_mz, tolerance: 0.01, top_n: 10, lib: activeLib ?? null }),
          }).then((r) => r.json()),
          fetch(`${BACKEND}/deep-spectrum/spec2vec-match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peaks: peak.ms2.peaks, top_n: 10, lib: activeLib ?? null }),
          }).then((r) => r.json()),
        ]);
        results[peak.id] = {
          cosine: (cosineRes.results ?? []).slice(0, 10),
          sv2: (sv2Res.results ?? []).slice(0, 10),
        };
      } catch {
        results[peak.id] = { cosine: [], sv2: [] };
      }
      setAllResults({ ...results });
    }
    setComputing(false);
  };

  const handleSelectPeak = (id) => {
    const pk = chrom?.peaks?.find((p) => p.id === id);
    if (pk) setSelectedPeak(pk);
  };

  const currentCache = selectedPeak ? (allResults[selectedPeak.id] ?? null) : null;
  const isDone = selectedPeak ? selectedPeak.id in allResults : false;
  const isSearching = computing && !isDone;

  // Build merged comparison: Spec2Vec rows annotated with Cosine rank + n_matches
  const buildComparison = (cosineResults, sv2Results) => {
    if (!cosineResults?.length && !sv2Results?.length) return [];
    const cosineRankMap = {};
    cosineResults.forEach((m, i) => { cosineRankMap[m.id] = i + 1; });
    return sv2Results.slice(0, 10).map((mol, i) => {
      const sv2Rank = i + 1;
      const cosineRank = cosineRankMap[mol.id] ?? null;
      const delta = cosineRank !== null ? cosineRank - sv2Rank : null;
      const cosineEntry = cosineResults.find((m) => m.id === mol.id);
      const cosineSim = cosineEntry?.similarity ?? null;
      const nMatches = cosineEntry?.n_matches ?? null;
      const falsePosWarning = cosineSim !== null && cosineSim >= 0.65 && nMatches !== null && nMatches < 5;
      return {
        mol, sv2Rank, cosineRank, delta,
        cosineSim, sv2Sim: mol.similarity,
        nMatches, falsePosWarning,
        aiOnly: cosineRank === null,
      };
    });
  };

  const comparison = isDone && currentCache ? buildComparison(currentCache.cosine, currentCache.sv2) : [];

  return (
    <div className="absolute inset-0 flex items-center justify-center px-12"
      style={{ paddingTop: "200px", paddingBottom: "100px" }}>
      <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800 bg-[#111111]"
        style={{ height: "min(calc(100vh - 300px), 780px)" }}>

        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded text-xs text-gray-500 font-mono">
            <LuDatabase className="w-3 h-3 text-purple-400/60 flex-shrink-0" />
            <span className="max-w-[220px] truncate">{selectedFile ?? "—"}</span>
          </div>

          <div className="flex items-center gap-2">
            <LuSparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              AI Similarity Search · Spec2Vec
            </span>
          </div>

          {chrom && (
            <div className="text-[10px] text-gray-600 font-mono text-right">
              <div>{chrom.meta?.instrument}</div>
              <div>{chrom.peaks?.length} peaks detected</div>
            </div>
          )}
          {!chrom && <div className="w-32" />}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden bg-[#111111] flex flex-col min-h-0">

          {!selectedFile && (
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="text-gray-700 text-xs">No input file selected</div>
              <div className="text-[10px] text-gray-800">Return to the Overview tab to configure your inputs.</div>
            </div>
          )}

          {selectedFile && (
            <div className="flex-1 flex min-h-0">

              {/* LEFT — Chromatogram + Peaks table */}
              <div className="flex-1 flex flex-col px-5 py-4 border-r border-gray-800 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <LuActivity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Total Ion Chromatogram
                  </span>
                </div>
                <div className="flex-shrink-0">
                  <Chromatogram tic={chrom?.tic} peaks={chrom?.peaks ?? []}
                    selectedPeakId={selectedPeak?.id} onSelectPeak={handleSelectPeak} />
                </div>

                <div className="flex items-center gap-2 mt-4 mb-2 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-gray-600">Detected Peaks</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {["#", "RT (min)", "Intensity", "Precursor m/z", "ID"].map((h) => (
                          <th key={h} className="text-left text-[10px] text-gray-600 uppercase tracking-wide py-1.5 px-2 font-normal">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(chrom?.peaks ?? []).map((pk) => {
                        const isSel = pk.id === selectedPeak?.id;
                        return (
                          <tr key={pk.id} onClick={() => handleSelectPeak(pk.id)}
                            className={`border-b border-gray-800/40 cursor-pointer transition-colors ${isSel ? "bg-purple-600/10" : "hover:bg-white/[0.03]"
                              }`}>
                            <td className="py-1.5 px-2">
                              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold ${isSel ? "bg-purple-500/20 text-purple-400" : "bg-gray-800 text-gray-500"
                                }`}>{pk.id}</span>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-gray-300">{pk.rt.toFixed(2)}</td>
                            <td className="py-1.5 px-2 font-mono text-gray-300">{pk.intensity.toLocaleString()}</td>
                            <td className="py-1.5 px-2 font-mono text-gray-400">{pk.precursor_mz.toFixed(4)}</td>
                            <td className={`py-1.5 px-2 font-mono ${isSel ? "text-purple-400" : "text-gray-600"}`}>Unknown {pk.id}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT — mode toggle + results */}
              <div className="flex-1 flex flex-col px-5 py-4 min-w-0">

                {/* Mode toggle */}
                <div className="flex items-center gap-1 mb-3 flex-shrink-0 self-start">
                  <button
                    onClick={() => setBroadMode(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${broadMode
                        ? "bg-purple-600/20 text-purple-300 border border-purple-600/40"
                        : "text-gray-600 border border-transparent hover:text-gray-400"
                      }`}>
                    <LuGlobe className="w-3 h-3" />
                    Public DB · MassBank
                  </button>
                  <button
                    onClick={() => setBroadMode(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${!broadMode
                        ? "bg-purple-600/20 text-purple-300 border border-purple-600/40"
                        : "text-gray-600 border border-transparent hover:text-gray-400"
                      }`}>
                    <LuFolderOpen className="w-3 h-3" />
                    Local Dataset · {formatLibName(activeLib ?? "ECRFS Library")}
                  </button>
                  <div className="relative group ml-1">
                    <LuInfo className="w-3 h-3 text-gray-700 cursor-pointer hover:text-gray-400 transition-colors" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 px-3 py-2 rounded bg-[#1a1a1a] border border-gray-700 text-xs text-gray-400 leading-relaxed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                      Spec2Vec encodes each spectrum as a 300-dimensional vector trained on millions of spectra. Similarity is the cosine distance between two embedding vectors — not a peak-by-peak comparison. This lets the model find matches even when noise, adducts, or instrument variation shift fragment positions, capturing structural context that classical cosine cannot.
                    </div>
                  </div>
                </div>

                {/* ── ECRFS mode ─────────────────────────────────────── */}
                {!broadMode && (
                  <>
                    {/* Gate */}
                    {!activated && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="text-center max-w-xs">
                          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                            Spec2Vec · {formatLibName(activeLib ?? "ECRFS Library")}
                          </div>
                          <div className="text-[10px] text-gray-600">
                            300-D embedding similarity{libInfo ? ` · ${libInfo.n_spectra} spectra` : ""}
                          </div>
                        </div>
                        <button onClick={handleActivate} disabled={!selectedPeak}
                          className="flex items-center gap-2 px-6 py-3 rounded text-sm font-semibold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100">
                          <LuSparkles className="w-4 h-4" />
                          spec2vec local search
                        </button>
                      </div>
                    )}

                    {/* After activation */}
                    {activated && (
                      <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex items-center justify-between mb-3 flex-shrink-0">
                          <span className="text-[10px] uppercase tracking-widest text-gray-600">
                            Spec2Vec · {formatLibName(activeLib ?? "ECRFS Library")}{libInfo ? ` (${libInfo.n_spectra} spectra)` : ""}
                          </span>
                          {computing && (
                            <span className="text-[10px] text-purple-600/60 font-mono">
                              {Object.keys(allResults).length} / {chrom?.peaks?.length ?? 0} peaks
                            </span>
                          )}
                        </div>

                        {isSearching && (
                          <div className="flex-1 flex items-center justify-center gap-3 text-gray-600 text-xs">
                            <div className="w-3 h-3 rounded-full bg-purple-500/40 animate-ping" />
                            Running dual analysis…
                          </div>
                        )}

                        {error && !isSearching && (
                          <div className="flex-1 flex items-center justify-center text-red-500/70 text-xs font-mono">
                            {error}
                          </div>
                        )}

                        {isDone && !isSearching && comparison.length > 0 && (
                          <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                            <div className="flex items-center gap-3 px-3 mb-1 flex-shrink-0">
                              <span className="w-4 text-[9px] text-gray-700">#</span>
                              <span className="flex-1 text-[9px] text-gray-700 uppercase tracking-wide">Compound</span>
                              <span className="w-16 text-[9px] text-gray-700 text-right">Formula</span>
                              <span className="w-24 text-[9px] text-purple-500/70 text-right">Spec2Vec</span>
                            </div>
                            {comparison.map((row) => {
                              const col = row.sv2Sim >= 0.65 ? "#a855f7" : row.sv2Sim >= 0.4 ? "#fbbf24" : "#4b5563";
                              return (
                                <div key={row.mol.id}
                                  className="flex items-center gap-3 px-3 py-2 bg-[#0e0e0e] rounded border border-gray-800/60 flex-shrink-0">
                                  <span className="text-[10px] text-gray-600 w-4">{row.sv2Rank}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[10px] text-gray-300 truncate">{row.mol.name}</div>
                                    <div className="text-[8px] text-gray-700 font-mono mt-0.5">{row.mol.source ?? formatLibName(activeLib ?? "ECRFS Library")}</div>
                                  </div>
                                  <span className="w-16 text-[9px] font-mono text-gray-500 text-right shrink-0">{row.mol.formula ?? "—"}</span>
                                  <div className="w-24 flex-shrink-0">
                                    <SimBar value={row.sv2Sim} color={col} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── Broad mode ──────────────────────────────────────── */}
                {broadMode && (
                  <div className="flex-1 flex flex-col min-h-0">

                    {/* Not built yet */}
                    {(!broadStatus || broadStatus.state === "not_built") && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="text-center max-w-xs">
                          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                            Spec2Vec · MassBank Index
                          </div>
                          <div className="text-[10px] text-gray-600">
                            One-time build · 86,970 spectra · ~2–4 min
                          </div>
                        </div>
                        <button onClick={handleBuildIndex}
                          className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white hover:scale-105 transition-all">
                          <LuZap className="w-4 h-4" />
                          Build Broad Index
                        </button>
                      </div>
                    )}

                    {/* Building */}
                    {broadStatus?.state === "building" && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
                        <div className="text-[10px] text-purple-400/80 font-mono text-center">
                          {broadStatus.message}
                        </div>
                        <div className="w-full max-w-xs">
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all"
                              style={{ width: `${broadStatus.progress}%` }} />
                          </div>
                          <div className="flex justify-between text-[9px] text-gray-700 mt-1 font-mono">
                            <span>building index…</span>
                            <span>{broadStatus.progress}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {broadStatus?.state === "error" && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
                        <div className="text-red-400/70 text-xs font-mono">{broadStatus.message}</div>
                        <button onClick={handleBuildIndex}
                          className="text-[10px] text-purple-500 underline underline-offset-2">
                          Riprova
                        </button>
                      </div>
                    )}

                    {/* Ready */}
                    {broadStatus?.state === "ready" && (
                      <>
                        {/* Gate */}
                        {!broadActivated && (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <div className="text-center max-w-xs">
                              <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
                                Spec2Vec · MassBank Index
                              </div>
                              <div className="text-[10px] text-gray-600">
                                300-D embedding similarity · {broadStatus.n_spectra?.toLocaleString()} spectra
                              </div>
                            </div>
                            <button onClick={handleBroadActivate} disabled={!chrom?.peaks?.length}
                              className="flex items-center gap-2 px-6 py-3 rounded text-sm font-semibold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white hover:scale-105 transition-all disabled:opacity-40">
                              <LuSparkles className="w-4 h-4" />
                              spec2vec broad search
                            </button>
                          </div>
                        )}

                        {/* Results */}
                        {broadActivated && (
                          <div className="flex flex-col flex-1 min-h-0">
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                              <span className="text-[10px] uppercase tracking-widest text-gray-600">
                                Spec2Vec · MassBank ({broadStatus.n_spectra?.toLocaleString()} spectra)
                              </span>
                              {broadComputing && (
                                <span className="text-[10px] text-purple-600/60 font-mono">
                                  {Object.keys(broadResults).length} / {chrom?.peaks?.length ?? 0} peaks
                                </span>
                              )}
                            </div>

                            {/* Show results for selected peak */}
                            {(() => {
                              const hits = selectedPeak ? (broadResults[selectedPeak.id] ?? null) : null;
                              const isLoading = broadComputing && hits === null;
                              if (isLoading) return (
                                <div className="flex-1 flex items-center justify-center gap-3 text-gray-600 text-xs">
                                  <div className="w-3 h-3 rounded-full bg-purple-500/40 animate-ping" />
                                  Searching MassBank…
                                </div>
                              );
                              if (!hits) return null;
                              if (hits.length === 0) return (
                                <div className="flex-1 flex items-center justify-center text-gray-700 text-xs">
                                  No match found in MassBank broad index
                                </div>
                              );
                              return (
                                <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                                  <div className="flex items-center gap-3 px-3 mb-1 flex-shrink-0">
                                    <span className="w-4 text-[9px] text-gray-700">#</span>
                                    <span className="flex-1 text-[9px] text-gray-700 uppercase tracking-wide">Compound</span>
                                    <span className="w-16 text-[9px] text-gray-700 text-right">Formula</span>
                                    <span className="w-24 text-[9px] text-purple-500/70 text-right">Spec2Vec</span>
                                  </div>
                                  {hits.map((hit, rank) => {
                                    const col = hit.similarity >= 0.65 ? "#a855f7" : hit.similarity >= 0.4 ? "#e0d0ff" : "#4b5563";
                                    return (
                                      <div key={hit.id}
                                        className="flex items-center gap-3 px-3 py-2 bg-[#0e0e0e] rounded border border-gray-800/60 flex-shrink-0">
                                        <span className="text-[10px] text-gray-600 w-4">{rank + 1}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[10px] text-gray-300 truncate">{hit.name}</div>
                                          <div className="text-[8px] text-gray-700 font-mono mt-0.5">{hit.source}</div>
                                        </div>
                                        <span className="w-16 text-[9px] font-mono text-gray-500 text-right shrink-0">{hit.formula}</span>
                                        <div className="w-24 flex-shrink-0">
                                          <SimBar value={hit.similarity} color={col} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
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

export default Spec2VecAnalysis;
