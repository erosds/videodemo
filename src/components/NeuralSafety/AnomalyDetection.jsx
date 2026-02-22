import { useState, useEffect } from "react";
import { LuActivity, LuDatabase, LuGlobe } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

function scoreCategory(score) {
  if (score >= 0.65) return "HIGH";
  if (score >= 0.40) return "UNCERTAIN";
  return "NONE";
}

function scoreColor(score) {
  const cat = scoreCategory(score);
  if (cat === "HIGH")      return "#f97316";
  if (cat === "UNCERTAIN") return "#fbbf24";
  return "#4b5563";
}

// ─── TIC Chromatogram ────────────────────────────────────────────────────────
const Chromatogram = ({ tic, peaks, selectedPeakId, onSelectPeak }) => {
  const [hovered, setHovered] = useState(null);

  if (!tic?.rt?.length) return <div className="w-full bg-[#0a0a0a] rounded" style={{ height: 130 }} />;

  const W = 700, H = 180, PL = 32, PR = 12, PT = 20, PB = 36;
  const iW = W - PL - PR, iH = H - PT - PB;

  const rtMin = tic.rt[0], rtMax = tic.rt[tic.rt.length - 1];
  const intMax = Math.max(...tic.intensity);

  const tx = (rt) => PL + ((rt - rtMin) / (rtMax - rtMin)) * iW;
  const ty = (v)  => PT + iH - (v / intMax) * iH;

  const pts = tic.rt.map((rt, i) => `${tx(rt).toFixed(1)},${ty(tic.intensity[i]).toFixed(1)}`).join(" ");
  const xTicks = Array.from({ length: 7 }, (_, i) => Math.round(rtMax / 6 * i * 10) / 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="w-full" style={{ height: H, display: "block", cursor: "crosshair" }}>
      <defs>
        <linearGradient id="adTicGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />
      {[0, 0.25, 0.5, 0.75, 1.0].map((t) => (
        <line key={t} x1={PL} y1={ty(t * intMax)} x2={W - PR} y2={ty(t * intMax)}
          stroke="#1f1f1f" strokeWidth={1} />
      ))}
      <polygon points={`${PL},${ty(0)} ${pts} ${W - PR},${ty(0)}`}
        fill="url(#adTicGrad)" opacity={0.25} />
      <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.7} />

      {peaks.map((pk) => {
        const x = tx(pk.rt), y = ty(pk.intensity);
        const isSel = pk.id === selectedPeakId, isHov = pk.id === hovered;
        return (
          <g key={pk.id} onClick={() => onSelectPeak(pk.id)}
            onMouseEnter={() => setHovered(pk.id)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}>
            <line x1={x} y1={y} x2={x} y2={ty(0)}
              stroke={isSel ? "#ef4444" : "#f59e0b"}
              strokeWidth={isSel ? 1.5 : 1}
              strokeDasharray={isSel ? "none" : "3 3"}
              opacity={isSel || isHov ? 0.8 : 0.4} />
            <circle cx={x} cy={y} r={isSel ? 6 : isHov ? 5 : 4}
              fill={isSel ? "#ef4444" : "#f59e0b"}
              stroke="#0a0a0a" strokeWidth={1.5}
              opacity={isSel || isHov ? 1 : 0.75} />
            {(isSel || isHov) && (
              <text x={x} y={y - 10} textAnchor="middle"
                fontSize={9} fill={isSel ? "#ef4444" : "#f59e0b"} fontFamily="monospace">
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

// ─── MS2 Spectrum ─────────────────────────────────────────────────────────────
const MS2Chart = ({ peaks, height = 110 }) => {
  if (!peaks?.length) return <div className="w-full bg-[#0a0a0a] rounded" style={{ height }} />;

  const W = 600, H = height, PAD = 8, PB = 16;
  const iW = W - PAD * 2, iH = H - PAD - PB;

  const maxI  = Math.max(...peaks.map((p) => p.intensity));
  const mzMin = Math.min(...peaks.map((p) => p.mz));
  const mzMax = Math.max(...peaks.map((p) => p.mz));
  const mzRng = (mzMax - mzMin) || 1;

  const xTicks = Array.from({ length: 5 }, (_, i) =>
    Math.round(mzMin + (mzRng / 4) * i)
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="w-full" style={{ height, display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />
      <g transform={`translate(${PAD},${PAD})`}>
        {peaks.map((p, i) => {
          const rel = p.intensity / maxI;
          const x   = ((p.mz - mzMin) / mzRng) * iW;
          const h   = rel * iH;
          const c   = rel > 0.75 ? "#f97316" : rel > 0.4 ? "#fb923c" : "#c2410c";
          return <line key={i} x1={x} y1={iH} x2={x} y2={iH - h}
            stroke={c} strokeWidth={2} strokeOpacity={0.85} />;
        })}
        {xTicks.map((t) => {
          const x = ((t - mzMin) / mzRng) * iW;
          return (
            <g key={t}>
              <line x1={x} y1={iH} x2={x} y2={iH + 4} stroke="#374151" strokeWidth={1} />
              <text x={x} y={iH + 12} textAnchor="middle" fontSize={8} fill="#4b5563" fontFamily="monospace">
                {t}
              </text>
            </g>
          );
        })}
      </g>
      <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={7} fill="#374151">m/z</text>
    </svg>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const AnomalyDetection = ({ selectedFile }) => {
  const [chrom,        setChrom]        = useState(null);
  const [selectedPeak, setSelectedPeak] = useState(null);
  const [allResults,   setAllResults]   = useState({});
  const [computing,    setComputing]    = useState(false);
  const [activated,    setActivated]    = useState(false);

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
    for (const peak of chrom.peaks) {
      try {
        const res = await fetch(`${BACKEND}/neural-safety/massbank-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            peaks: peak.ms2.peaks,
            precursor_mz: peak.precursor_mz,
            ion_mode: "POSITIVE",
            threshold: 0.5,
            top_n: 5,
          }),
        });
        const data = await res.json();
        results[peak.id] = data.results ?? [];
      } catch {
        results[peak.id] = [];
      }
      setAllResults({ ...results });
    }
    setComputing(false);
  };

  const handleSelectPeak = (id) => {
    const pk = chrom?.peaks?.find((p) => p.id === id);
    if (pk) setSelectedPeak(pk);
  };

  const selectedMs2  = selectedPeak?.ms2?.peaks ?? [];
  const currentHits  = selectedPeak ? (allResults[selectedPeak.id] ?? null) : null;
  const isDone       = selectedPeak ? selectedPeak.id in allResults : false;
  const isSearching  = computing && !isDone;

  return (
    <div className="absolute inset-0 flex items-center justify-center px-12"
      style={{ paddingTop: "200px", paddingBottom: "100px" }}>
      <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800 bg-[#111111]"
        style={{ height: "min(calc(100vh - 300px), 780px)" }}>

        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded text-xs text-gray-500 font-mono">
            <LuDatabase className="w-3 h-3 text-orange-400/60 flex-shrink-0" />
            <span className="max-w-[220px] truncate">{selectedFile ?? "—"}</span>
          </div>

          <div className="flex items-center gap-2">
            <LuGlobe className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Global Screening · MassBank Europe
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
                  <LuActivity className="w-3.5 h-3.5 text-orange-400" />
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
                            className={`border-b border-gray-800/40 cursor-pointer transition-colors ${
                              isSel ? "bg-orange-600/10" : "hover:bg-white/[0.03]"
                            }`}>
                            <td className="py-1.5 px-2">
                              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold ${
                                isSel ? "bg-orange-500/20 text-orange-400" : "bg-gray-800 text-gray-500"
                              }`}>{pk.id}</span>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-gray-300">{pk.rt.toFixed(2)}</td>
                            <td className="py-1.5 px-2 font-mono text-gray-300">{pk.intensity.toLocaleString()}</td>
                            <td className="py-1.5 px-2 font-mono text-gray-400">{pk.precursor_mz.toFixed(4)}</td>
                            <td className={`py-1.5 px-2 font-mono ${isSel ? "text-orange-400" : "text-gray-600"}`}>Unknown {pk.id}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT — MS2 + MassBank results */}
              <div className="flex-1 flex flex-col px-5 py-4 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <LuActivity className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">MS/MS Spectrum</span>
                  {selectedPeak && (
                    <span className="text-[10px] text-gray-600 font-mono ml-1">
                      Unknown {selectedPeak.id} · RT {selectedPeak.rt.toFixed(2)} min · {selectedPeak.precursor_mz.toFixed(4)} Da
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <MS2Chart peaks={selectedMs2} height={110} />
                </div>

                {selectedPeak && (
                  <div className="grid grid-cols-4 gap-2 mt-3 flex-shrink-0">
                    <div className="bg-[#1a1a1a] rounded p-2.5">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wide">Precursor</div>
                      <div className="text-xs text-gray-200 mt-0.5 font-mono">{selectedPeak.precursor_mz.toFixed(4)}</div>
                    </div>
                    <div className="bg-[#1a1a1a] rounded p-2.5">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wide">Fragments</div>
                      <div className="text-xs text-gray-200 mt-0.5">{selectedMs2.length}</div>
                    </div>
                    <div className="bg-[#1a1a1a] rounded p-2.5">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wide">RT</div>
                      <div className="text-xs text-gray-200 mt-0.5 font-mono">{selectedPeak.rt.toFixed(2)} min</div>
                    </div>
                    <div className="bg-[#1a1a1a] rounded p-2.5">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wide">Source</div>
                      <div className="text-[9px] text-gray-500 mt-0.5 font-mono truncate">{selectedPeak.ms2?.source}</div>
                    </div>
                  </div>
                )}

                {/* Results area */}
                <div className="border-t border-gray-800 mt-4 pt-4 flex-1 flex flex-col min-h-0">

                  {/* Gate: button before first activation */}
                  {!activated && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
                      <span className="text-[10px] uppercase tracking-widest text-gray-700">
                        CosineGreedy · MassBank Europe 20,000+ spectra
                      </span>
                      <button onClick={handleActivate} disabled={!selectedPeak}
                        className="flex items-center gap-2 px-6 py-3 rounded text-sm font-semibold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white hover:shadow-lg hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100">
                        <LuGlobe className="w-4 h-4" />
                        run global spectral matching
                      </button>
                    </div>
                  )}

                  {/* After activation */}
                  {activated && (
                    <>
                      <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <span className="text-[10px] uppercase tracking-widest text-gray-600">
                          CosineGreedy · MassBank Europe
                        </span>
                        {computing && (
                          <span className="text-[10px] text-orange-600/60 font-mono">
                            {Object.keys(allResults).length} / {chrom?.peaks?.length ?? 0} peaks
                          </span>
                        )}
                      </div>

                      {/* Searching selected peak */}
                      {isSearching && (
                        <div className="flex-1 flex items-center justify-center gap-3 text-gray-600 text-xs">
                          <div className="w-3 h-3 rounded-full bg-orange-500/40 animate-ping" />
                          Searching MassBank Europe…
                        </div>
                      )}

                      {/* Results for selected peak */}
                      {isDone && !isSearching && (
                        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

                          {/* No match */}
                          {currentHits.length === 0 && (
                            <div className="rounded border flex-shrink-0"
                              style={{ borderColor: "#4b556355", background: "#4b55630c" }}>
                              <div className="px-4 py-3 space-y-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-gray-400">No match in MassBank Europe</div>
                                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">structure absent from global database</div>
                                  </div>
                                  <div className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-800">
                                    No Match
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Best match card */}
                          {currentHits.length > 0 && (() => {
                            const best    = currentHits[0];
                            const col     = scoreColor(best.score);
                            const cat     = scoreCategory(best.score);
                            const hitsPct = (currentHits.length / 5) * 100;
                            return (
                              <div className="rounded border flex-shrink-0"
                                style={{ borderColor: col + "55", background: col + "0c" }}>
                                <div className="px-4 py-3 space-y-1">

                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-gray-200 truncate">{best.name}</div>
                                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        {best.formula} · {best.mass.toFixed(4)} Da
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                                      style={{ color: col, background: col + "20" }}>
                                      {cat === "HIGH" ? "Confirmed" : cat === "UNCERTAIN" ? "Uncertain" : "No Match"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex justify-between items-baseline mb-1">
                                      <span className="text-[10px] text-gray-500 uppercase tracking-wide">Similarity score</span>
                                      <span className="text-sm font-bold font-mono" style={{ color: col }}>
                                        {(best.score * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all"
                                        style={{ width: `${best.score * 100}%`, backgroundColor: col }} />
                                    </div>
                                    <div className="text-[9px] text-gray-700 mt-0.5">
                                      threshold for confirmation: ≥ 65%
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex justify-between items-baseline mb-1">
                                      <span className="text-[10px] text-gray-500 uppercase tracking-wide">Database hits</span>
                                      <span className="text-sm font-bold font-mono" style={{ color: col }}>
                                        {currentHits.length} <span className="text-[10px] text-gray-600">compounds</span>
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all"
                                        style={{ width: `${hitsPct}%`, backgroundColor: col + "bb" }} />
                                    </div>
                                    <div className="text-[9px] text-gray-700 mt-0.5">
                                      unique compounds returned (top 5)
                                    </div>
                                  </div>

                                </div>
                              </div>
                            );
                          })()}

                          {/* Top hits ranking */}
                          {currentHits.length > 0 && (
                            <div className="flex-shrink-0">
                              <div className="flex items-center gap-4 text-[9px] text-gray-700 uppercase tracking-widest mb-1.5 px-3">
                                <span className="w-4" />
                                <span className="flex-1">Compound</span>
                                <span className="w-28 text-right">Score</span>
                                <span className="w-20 text-right">Mass (Da)</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                {currentHits.map((hit, rank) => {
                                  const col = scoreColor(hit.score);
                                  return (
                                    <div key={hit.accession} className="flex items-center gap-4 px-3 py-2 bg-[#0e0e0e] rounded border border-gray-800/60">
                                      <span className="text-[10px] text-gray-600 w-4 flex-shrink-0">{rank + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-gray-300 truncate">{hit.name}</div>
                                        <div className="text-[9px] text-gray-600 font-mono">{hit.formula}</div>
                                      </div>
                                      <div className="w-28 flex-shrink-0">
                                        <div className="flex justify-between text-[9px] mb-0.5">
                                          <span className="text-gray-700">score</span>
                                          <span className="font-mono" style={{ color: col }}>
                                            {(hit.score * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                          <div className="h-full rounded-full"
                                            style={{ width: `${hit.score * 100}%`, backgroundColor: col }} />
                                        </div>
                                      </div>
                                      <div className="w-20 flex-shrink-0 text-right">
                                        <span className="text-[9px] font-mono text-gray-500">{hit.mass.toFixed(4)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnomalyDetection;
