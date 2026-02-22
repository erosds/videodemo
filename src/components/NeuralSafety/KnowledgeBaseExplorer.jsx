import React, { useState, useEffect, useRef } from "react";
import { LuSearch, LuDatabase, LuActivity, LuTriangleAlert, LuFlaskConical, LuAtom } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ──────────────────────────────────────────────────────────────
//  SVG Spectrum Chart — stick spectrum, no external library
// ──────────────────────────────────────────────────────────────
const SpectrumChart = ({ peaks }) => {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  if (!peaks?.length) return null;

  // Top 80 by intensity → capture maxI before re-sorting by m/z
  const byIntensity = [...peaks]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 80);
  const maxI = byIntensity[0]?.intensity || 1;

  const top = byIntensity.sort((a, b) => a.mz - b.mz);
  const mzMin = top[0]?.mz ?? 0;
  const mzMax = top[top.length - 1]?.mz ?? 1;
  const mzRange = mzMax - mzMin || 1;

  // Chart geometry
  const margin = { top: 12, right: 20, bottom: 42, left: 54 };
  const chartW = 900;
  const chartH = 250;
  const innerW = chartW - margin.left - margin.right;
  const innerH = chartH - margin.top - margin.bottom;

  const xScale = (mz) => ((mz - mzMin) / mzRange) * innerW;
  const yScale = (intensity) => innerH - (intensity / maxI) * innerH;

  // X-axis ticks (5-6 evenly spaced)
  const xTickCount = 6;
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    mzMin + (mzRange * i) / (xTickCount - 1)
  );

  // Y-axis ticks (0, 25, 50, 75, 100)
  const yTicks = [0, 25, 50, 75, 100];

  // Bar fill colour by relative intensity
  const barColor = (relPct) => {
    if (relPct > 75) return "#ef4444";
    if (relPct > 40) return "#f97316";
    return "#f59e0b";
  };

  return (
    <div className="relative w-full" style={{ height: chartH, flexShrink: 0 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartW} ${chartH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <defs>
          <clipPath id="nsClip">
            <rect x={0} y={0} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines */}
          {yTicks.map((pct) => {
            const y = innerH - (pct / 100) * innerH;
            return (
              <line
                key={pct}
                x1={0} y1={y} x2={innerW} y2={y}
                stroke="#1f2937"
                strokeWidth={1}
                strokeDasharray={pct === 0 ? "none" : "3 3"}
              />
            );
          })}

          {/* Spectrum sticks */}
          <g clipPath="url(#nsClip)">
            {top.map((p, i) => {
              const relPct = (p.intensity / maxI) * 100;
              const x = xScale(p.mz);
              const y = yScale(p.intensity);
              return (
                <g key={i}>
                  {/* Glow behind base peak */}
                  {relPct > 95 && (
                    <line
                      x1={x} y1={innerH} x2={x} y2={y}
                      stroke={barColor(relPct)}
                      strokeWidth={6}
                      strokeOpacity={0.15}
                    />
                  )}
                  {/* Main stick */}
                  <line
                    x1={x} y1={innerH} x2={x} y2={y}
                    stroke={barColor(relPct)}
                    strokeWidth={relPct > 90 ? 2.5 : 1.5}
                    strokeOpacity={0.85}
                    className="cursor-crosshair"
                    onMouseEnter={(e) => {
                      const rect = svgRef.current?.getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          mz: p.mz.toFixed(4),
                          relPct: relPct.toFixed(1),
                          absI: p.intensity,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </g>
              );
            })}
          </g>

          {/* X-axis line */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#374151" strokeWidth={1} />
          {/* Y-axis line */}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#374151" strokeWidth={1} />

          {/* X-axis ticks & labels */}
          {xTicks.map((mz, i) => {
            const x = xScale(mz);
            return (
              <g key={i} transform={`translate(${x},${innerH})`}>
                <line y2={4} stroke="#374151" />
                <text
                  y={16}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize={10}
                >
                  {mz.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Y-axis ticks & labels */}
          {yTicks.map((pct) => {
            const y = innerH - (pct / 100) * innerH;
            return (
              <g key={pct} transform={`translate(0,${y})`}>
                <line x2={-4} stroke="#374151" />
                <text
                  x={-8}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#6b7280"
                  fontSize={10}
                >
                  {pct}
                </text>
              </g>
            );
          })}

          {/* Axis labels */}
          <text
            x={innerW / 2}
            y={innerH + 36}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={11}
          >
            m/z
          </text>
          <text
            x={-innerH / 2}
            y={-40}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={11}
            transform="rotate(-90)"
          >
            Relative Intensity (%)
          </text>
        </g>
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, 800),
            top: Math.max(tooltip.y - 48, 0),
          }}
        >
          <div className="text-amber-400 font-semibold mb-0.5">m/z: {tooltip.mz}</div>
          <div className="text-gray-300">
            Rel. Intensity:{" "}
            <span className="text-white font-medium">{tooltip.relPct}%</span>
          </div>
          <div className="text-gray-500">
            Abs.: {Number(tooltip.absI).toExponential(2)}
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
//  Tox score helpers
// ──────────────────────────────────────────────────────────────
function toxColor(score) {
  if (!score || score === "N/A" || score === "n/a") return "text-gray-500";
  const n = parseFloat(score);
  if (isNaN(n)) return "text-gray-500";
  if (n >= 8) return "text-red-400";
  if (n >= 5) return "text-orange-400";
  return "text-emerald-400";
}

function toxBgBorder(score) {
  if (!score || score === "N/A" || score === "n/a") return "border-gray-700";
  const n = parseFloat(score);
  if (isNaN(n)) return "border-gray-700";
  if (n >= 8) return "border-red-500/40";
  if (n >= 5) return "border-orange-500/40";
  return "border-emerald-500/40";
}

function toxLabel(score) {
  if (!score || score === "N/A" || score === "n/a") return null;
  const n = parseFloat(score);
  if (isNaN(n)) return null;
  if (n >= 8) return "HIGH RISK";
  if (n >= 5) return "MODERATE";
  return "LOW";
}

function qualityLabel(q) {
  if (q === "1") return "Reference Std";
  if (q === "2") return "In-Silico";
  if (q === "3") return "Predicted";
  return q || "N/A";
}

// ──────────────────────────────────────────────────────────────
//  Main component
// ──────────────────────────────────────────────────────────────
const KnowledgeBaseExplorer = () => {
  const [library, setLibrary]         = useState([]);
  const [selectedId, setSelectedId]   = useState(null);
  const [spectrum, setSpectrum]       = useState(null);
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [specLoading, setSpecLoading] = useState(false);
  const [error, setError]             = useState(null);

  // Load full library on mount
  useEffect(() => {
    fetch(`${BACKEND}/neural-safety/library`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setLibrary(data);
        setLoading(false);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Load spectrum whenever selection changes
  useEffect(() => {
    if (selectedId === null) return;
    setSpecLoading(true);
    setSpectrum(null);
    fetch(`${BACKEND}/neural-safety/spectrum/${selectedId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSpectrum(data);
        setSpecLoading(false);
      })
      .catch(() => setSpecLoading(false));
  }, [selectedId]);

  const filtered = library.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = library.find((m) => m.id === selectedId);

  return (
    <div
      className="absolute rounded inset-0 flex items-center justify-center px-12"
      style={{ paddingTop: "200px", paddingBottom: "100px" }}
    >
      <div className="flex w-full max-w-6xl rounded overflow-hidden border border-gray-800/60"
        style={{ height: "min(calc(100vh - 300px), 760px)" }}>
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-gray-800 bg-[#0e0e0e]">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <LuDatabase className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              EFSA PMT Library
            </span>
          </div>
          <div className="relative">
            <LuSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
            <input
              type="text"
              placeholder="Search compounds..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {loading
              ? "Loading library…"
              : `${filtered.length} / ${library.length} compounds`}
          </div>
        </div>

        {/* Compound list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {loading && (
            <div className="p-6 text-center text-gray-600 text-sm">
              <LuFlaskConical className="w-6 h-6 mx-auto mb-2 text-amber-500/40 animate-pulse" />
              Loading library…
            </div>
          )}
          {error && (
            <div className="p-4 text-xs text-red-400 bg-red-900/10 m-3 rounded">
              {error}
            </div>
          )}
          {!loading &&
            filtered.map((mol) => {
              const isActive = selectedId === mol.id;
              return (
                <button
                  key={mol.id}
                  onClick={() => setSelectedId(mol.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    isActive
                      ? "bg-amber-600/10 border-l-2 border-l-amber-500"
                      : "hover:bg-white/5 border-l-2 border-l-transparent"
                  }`}
                >
                  <div
                    className={`text-xs font-medium leading-snug truncate ${
                      isActive ? "text-amber-300" : "text-gray-300"
                    }`}
                  >
                    {mol.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-600 font-mono">
                      {mol.formula}
                    </span>
                    {toxLabel(mol.tox_score) && (
                      <span
                        className={`text-[10px] font-bold tracking-wide ${toxColor(
                          mol.tox_score
                        )}`}
                      >
                        {toxLabel(mol.tox_score)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* ── MAIN PANEL ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#111111]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            Select a compound from the sidebar
          </div>
        ) : (
          <>
            {/* Molecule header */}
            <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-800">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white leading-tight mb-1">
                    {selected.name}
                  </h2>
                  {selected.smiles && selected.smiles !== "N/A" && (
                    <p className="text-xs text-gray-500 font-mono truncate max-w-lg">
                      {selected.smiles}
                    </p>
                  )}
                </div>
                {/* Tox badge */}
                {toxLabel(selected.tox_score) && (
                  <div
                    className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-1 rounded bg-[#1a1a1a] border ${toxBgBorder(
                      selected.tox_score
                    )}`}
                  >
                    <LuTriangleAlert
                      className={`w-4 h-4 ${toxColor(selected.tox_score)}`}
                    />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-gray-500">
                        EFSA Tox Score
                      </div>
                      <div
                        className={`text-sm font-bold leading-none ${toxColor(
                          selected.tox_score
                        )}`}
                      >
                        {selected.tox_score}
                        <span className="text-xs font-normal text-gray-500 ml-1">
                          /10
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: "Mol. Formula", value: selected.formula, mono: true },
                  {
                    label: "Exact Mass",
                    value:
                      selected.exact_mass && selected.exact_mass !== "N/A"
                        ? `${parseFloat(selected.exact_mass).toFixed(5)} Da`
                        : "N/A",
                  },
                  {
                    label: "CAS Number",
                    value: (selected.cas || "N/A").replace(/^CAS_RN:\s*/i, ""),
                  },
                  { label: "Ion Mode", value: selected.ionmode },
                  {
                    label: "Ret. Time",
                    value:
                      selected.retention_time && selected.retention_time !== "N/A"
                        ? `${parseFloat(selected.retention_time).toFixed(0)} s`
                        : "N/A",
                  },
                  { label: "Instrument", value: selected.instrument },
                  {
                    label: "Lib. Quality",
                    value: qualityLabel(selected.spectrum_quality),
                  },
                  { label: "Peak Count", value: selected.peak_count },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="bg-[#1a1a1a] rounded p-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      {label}
                    </div>
                    <div
                      className={`text-xs text-gray-200 truncate ${
                        mono ? "font-mono" : ""
                      }`}
                      title={String(value)}
                    >
                      {value || "N/A"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tox endpoint row */}
              {selected.tox_endpoint && selected.tox_endpoint !== "N/A" && (
                <div className="mt-1 bg-[#1a1a1a] rounded px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Tox Endpoint:
                  </span>
                  <span className="text-xs text-orange-300">
                    {selected.tox_endpoint}
                  </span>
                  {selected.tox_reliability &&
                    selected.tox_reliability !== "N/A" && (
                      <span className="text-[10px] text-gray-600 ml-auto">
                        {selected.tox_reliability} reliability
                      </span>
                    )}
                </div>
              )}
            </div>

            {/* Spectrum section */}
            <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <LuActivity className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  MS/MS Fragmentation Spectrum
                </h3>
                {specLoading && (
                  <span className="text-xs text-gray-600 ml-1 animate-pulse">
                    Loading…
                  </span>
                )}
                {!specLoading && spectrum?.peaks?.length > 0 && (
                  <span className="text-xs text-gray-700 ml-1">
                    ({Math.min(spectrum.peaks.length, 80)} peaks shown)
                  </span>
                )}
                {selected.activation && selected.activation !== "N/A" && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-gray-600 bg-[#1a1a1a] px-2 py-0.5 rounded">
                    {selected.activation}
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0">
                {specLoading ? (
                  <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                    <LuAtom className="w-5 h-5 mr-2 text-amber-500/40 animate-spin" />
                    Loading spectrum…
                  </div>
                ) : spectrum?.peaks?.length > 0 ? (
                  <SpectrumChart peaks={spectrum.peaks} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                    No spectrum data available
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseExplorer;
