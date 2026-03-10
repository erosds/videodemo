import React from "react";
import { LuBrain } from "react-icons/lu";

// ── Use-case cards (left column) ──────────────────────────────────────────────

const USE_CASES = [
  {
    sector: "Food & Beverage",
    title: "Ingredient reformulation",
    body: "Sugar, alcohol, and fat reduction are global key health targets. Reformulating recipes requires finding molecules that preserve taste and texture while improving nutritional profiles.",
  },
  {
    sector: "Cosmetics & Fragrance",
    title: "Allergen replacement",
    body: "Regulations and consumer preferences drive product development. Replacements must preserve the olfactory character while eliminating the allergenic potential.",
  },
  {
    sector: "Materials & Polymers",
    title: "New material design",
    body: "Designing materials with specific properties (e.g. strength, flexibility, conductivity) requires finding molecules that are also cost-effective and environmentally friendly.",
  },
  {
    sector: "...and more",
    title: "",
    body: "",
  }
];

const UseCaseCard = ({ uc, isLast }) => (
  <div className={`py-3 ${!isLast ? "border-b border-gray-800/50" : ""}`}>
    <div className="text-[9px] uppercase tracking-widest text-gray-600">{uc.sector}</div>
    <span className="text-xs font-semibold uppercase tracking-widest text-gray-300">{uc.title}</span>
    <p className="text-[12px] text-gray-500 leading-snug">{uc.body}</p>
  </div>
);

// ── 2-D scatter plot (left of right column) ────────────────────────────────────

const ScatterPlot2D = () => {
  const W = 320, H = 240;
  const ml = 18, mr = 16, mt = 22, mb = 28;
  const pw = W - ml - mr;
  const ph = H - mt - mb;

  const toSVG = (nx, ny) => ({
    sx: ml + nx * pw,
    sy: mt + (1 - ny) * ph,
  });

  const pts = [
    { x: 0.15, y: 0.80, optimal: true },
    { x: 0.40, y: 0.60 },
    { x: 0.65, y: 0.72 },
    { x: 0.75, y: 0.30 },
    { x: 0.55, y: 0.20 },
    { x: 0.30, y: 0.40 },
    { x: 0.85, y: 0.55 },
    { x: 0.70, y: 0.45 },
    { x: 0.45, y: 0.78 },
    { x: 0.20, y: 0.52 },
    { x: 0.80, y: 0.82 },
    { x: 0.58, y: 0.12 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <rect width={W} height={H} fill="#0d0d0d" />

      {/* Axes */}
      <line x1={ml} y1={mt + ph} x2={ml + pw} y2={mt + ph} stroke="#374151" strokeWidth={0.7} />
      <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke="#374151" strokeWidth={0.7} />

      {/* Axis labels */}
      <text x={ml + pw} y={mt + ph + 14} fontSize={9} fill="#6b7280" textAnchor="end">property 1 ←</text>
      <text x={ml} y={mt - 6} fontSize={9} fill="#6b7280">↑ property 2</text>

      {/* Points */}
      {pts.map((pt, i) => {
        const { sx, sy } = toSVG(pt.x, pt.y);
        if (pt.optimal) {
          return (
            <g key={i}>
              <circle cx={sx} cy={sy} r={6.5} fill="none" stroke="#ffffff" strokeWidth={1.1} opacity={0.6} />
              <circle cx={sx} cy={sy} r={2.5} fill="#ffffff" opacity={0.85} />
              <line x1={sx} y1={sy - 8} x2={sx + 24} y2={sy - 22}
                stroke="#ffffff" strokeWidth={0.6} strokeOpacity={0.95} />
              <text x={sx + 27} y={sy - 24} fontSize={9} fill="#ffffff">optimal candidate</text>
            </g>
          );
        }
        return <circle key={i} cx={sx} cy={sy} r={1.8} fill="#ffffff" fillOpacity={0.8} />;
      })}
    </svg>
  );
};

// ── 3-D optimization surface (right column) ────────────────────────────────────

const SurfacePlot = () => {
  const W = 400, H = 260;
  const cx = 200, cy = 108;
  const scale = 170, zScale = 78;

  const proj = (x, y, z) => ({
    sx: cx + (x - y) * Math.cos(Math.PI / 6) * scale,
    sy: cy + (x + y) * Math.sin(Math.PI / 6) * scale - z * zScale,
  });

  // Complex energy landscape: primary + secondary well, barrier, and wavy texture
  const N = 18;
  const ox = 0.62, oy = 0.38;

  const f = (x, y) => {
    // Primary well (global minimum — optimal candidate)
    const dx1 = x - ox, dy1 = y - oy;
    const well1 = 1.8 * dx1 * dx1 + 1.5 * dy1 * dy1 + 0.4 * dx1 * dy1;

    // Secondary well (local minimum — suboptimal competitor)
    const dx2 = x - 0.20, dy2 = y - 0.74;
    const well2 = 2.2 * dx2 * dx2 + 1.9 * dy2 * dy2 + 0.18;

    // Third shallow valley along one edge
    const dx3 = x - 0.80, dy3 = y - 0.78;
    const well3 = 3.0 * dx3 * dx3 + 2.5 * dy3 * dy3 + 0.32;

    // Gaussian barrier between primary and secondary wells
    const bx = x - 0.40, by = y - 0.56;
    const barrier = 0.14 * Math.exp(-(bx * bx + by * by) * 16);

    // Smaller ripple bump near (0.78, 0.22)
    const rx = x - 0.78, ry = y - 0.22;
    const bump = 0.08 * Math.exp(-(rx * rx + ry * ry) * 22);

    // Terrain waves (different frequencies on each axis for asymmetry)
    const waves =
      0.025 * Math.sin(x * Math.PI * 6) * Math.sin(y * Math.PI * 5) +
      0.015 * Math.cos(x * Math.PI * 9 + 0.4) * Math.sin(y * Math.PI * 7);

    const base = Math.min(well1, well2, well3);
    return Math.min(0.95, Math.max(0.02, base + barrier + bump + waves + 0.04));
  };

  // Build grid cells, sort back-to-front
  const cells = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = i / N, x1 = (i + 1) / N;
      const y0 = j / N, y1 = (j + 1) / N;
      const z00 = f(x0, y0), z10 = f(x1, y0), z11 = f(x1, y1), z01 = f(x0, y1);
      cells.push({
        pts: [proj(x0, y0, z00), proj(x1, y0, z10), proj(x1, y1, z11), proj(x0, y1, z01)],
        zAvg: (z00 + z10 + z11 + z01) / 4,
        depth: i + j,
      });
    }
  }
  cells.sort((a, b) => a.depth - b.depth);

  // Lightness + subtle blue tint in valley
  const fill = (z) => {
    const t = Math.min(1, z);
    const l = 11 + (1 - t) * 40;
    const s = 4 + (1 - t) * 14;
    return `hsl(222,${s.toFixed(0)}%,${l.toFixed(0)}%)`;
  };

  const minPt = proj(ox, oy, f(ox, oy));
  const origin = proj(0, 0, 0);
  const endX = proj(1.1, 0, 0);
  const endY = proj(0, 1.1, 0);
  const endZ = proj(0, 0, 0.95);

  const suboptimalPoints = [
    { x: 0.20, y: 0.74 }, // Nel secondo pozzo
    { x: 0.45, y: 0.30 }, // Su un pendio
    { x: 0.70, y: 0.15 }, // Vicino al bordo
    { x: 0.10, y: 0.40 }, // Un altro punto casuale
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <rect width={W} height={H} fill="#0d0d0d" />

      {cells.map(({ pts, zAvg }, i) => (
        <path key={i}
          d={`M${pts.map(p => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join("L")}Z`}
          fill={fill(zAvg)} stroke="#090909" strokeWidth={0.25} />
      ))}

      {/* Axes */}
      <line x1={origin.sx} y1={origin.sy} x2={endX.sx} y2={endX.sy} stroke="#374151" strokeWidth={0.7} />
      <line x1={origin.sx} y1={origin.sy} x2={endY.sx} y2={endY.sy} stroke="#374151" strokeWidth={0.7} />
      <line x1={origin.sx} y1={origin.sy} x2={endZ.sx} y2={endZ.sy}
        stroke="#374151" strokeWidth={0.7} strokeDasharray="3 2" />

      <text x={endX.sx - 35} y={endX.sy + 3} fontSize={12} fill="#6b7280">property 1 →</text>
      <text x={endY.sx + 35} y={endY.sy + 3} fontSize={12} fill="#6b7280" textAnchor="end">⬋ property 2</text>
      <text x={endZ.sx - 4} y={endZ.sy + 2} fontSize={12} fill="#6b7280" textAnchor="end">property 3 ↓</text>

      {/* Suboptimal candidates */}
      {suboptimalPoints.map((pt, i) => {
        const p = proj(pt.x, pt.y, f(pt.x, pt.y));
        return (
          <circle
            key={i}
            cx={p.sx}
            cy={p.sy}
            r={1.8}
            fill="#ffffff"
            fillOpacity={0.8}
          />
        );
      })}
      {/* Optimal candidate */}
      <circle cx={minPt.sx} cy={minPt.sy} r={6.5} fill="none" stroke="#ffffff" strokeWidth={1.1} opacity={0.6} />
      <circle cx={minPt.sx} cy={minPt.sy} r={2.5} fill="#ffffff" opacity={0.85} />
      <line x1={minPt.sx} y1={minPt.sy - 8} x2={minPt.sx + 26} y2={minPt.sy - 26}
        stroke="#ffffff" strokeWidth={0.6} strokeOpacity={0.95} />
      <text x={minPt.sx + 29} y={minPt.sy - 28} fontSize={13} fill="#ffffff">optimal candidate</text>
    </svg>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────

const Overview = () => (
  <div
    className="absolute inset-0 overflow-y-auto no-scrollbar px-20"
    style={{ paddingTop: 200, paddingBottom: 100 }}
  >
    <div className="max-w-6xl mx-auto flex flex-col gap-5">

      <div className="grid grid-cols-7 gap-6 items-stretch">

        {/* Left — use cases */}
        <div className="col-span-3 flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-3">
            When do you need to find or replace a molecule?
          </div>
          <div className="bg-[#0d0d0d] border border-gray-800 rounded-lg px-4 py-0.5 flex-1">
            {USE_CASES.map((uc, i) => (
              <UseCaseCard key={i} uc={uc} isLast={i === USE_CASES.length - 1} />
            ))}
          </div>
        </div>

        {/* Right — 3-D surface */}
        <div className="col-span-4 flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-3">
            Finding a molecule that satisfies multiple properties at once
          </div>

          <div className="bg-[#0d0d0d] border border-gray-800 rounded-lg p-4 flex-1 flex flex-col gap-3">
            {/* Two charts side by side */}
            <div className="flex-1 min-h-0 flex" style={{ minHeight: 160 }}>
              {/* Left: 2D scatter */}
              <div className="flex-1 relative">
                <div className="absolute inset-0">
                  <ScatterPlot2D />
                </div>
              </div>

              {/* Vertical divider */}
              <div className="w-px bg-gray-800 self-stretch flex-shrink-0 mx-1" />

              {/* Right: 3D surface (unchanged) */}
              <div className="flex-1 relative">
                <div className="absolute inset-0">
                  <SurfacePlot />
                </div>
              </div>
            </div>

            {/* Caption */}
            <p className="text-[12px] text-gray-400 leading-snug flex-shrink-0">
              Each point on the plots is a molecule positioned by two or three properties. Based on the optimization requested, the algorithm identifies the best candidates. Real problems involve many more dimensions:
              how can we efficiently navigate such high-dimensional spaces?
            </p>
          </div>
        </div>

      </div>

      {/* State of the art */}
      <div className="border border-purple-900/30 rounded-lg px-3 py-3 bg-purple-950/10 flex flex-col gap-3">
        <p className="text-sm text-gray-400 leading-relaxed">
          Domain experts narrow down candidates running thousands of biochemical tests and long experimental campaigns. The harder challenge is <strong className="text-gray-300">multi-objective design</strong>: finding a molecule that is simultaneously active, safe, stable, and economically viable.
        </p>
        <div className="flex items-center gap-3 border-t border-purple-900/20 pt-3">
          <LuBrain className="w-4 h-4 text-purple-500/60 flex-shrink-0" />
          <p className="text-sm text-gray-200 leading-relaxed">
            What if AI models could predict a molecule's properties before it is ever synthesised — and learn, generation after generation, where the best candidates are hiding?
          </p>
        </div>
      </div>

    </div>
  </div>
);

export default Overview;
