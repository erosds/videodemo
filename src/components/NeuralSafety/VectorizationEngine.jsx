import { useState, useEffect, useRef } from "react";
import { LuActivity, LuAtom, LuDatabase } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ──────────────────────────────────────────────────────────────
//  Color helpers
// ──────────────────────────────────────────────────────────────
function toxHex(score) {
  if (!score || score === "N/A" || score === "n/a") return "#6b7280";
  const n = parseFloat(score);
  if (isNaN(n)) return "#6b7280";
  if (n >= 8) return "#ef4444";
  if (n >= 5) return "#f97316";
  return "#10b981";
}

// Diverging heatmap with log scale: blue (neg) → dark-gray (0) → amber-red (pos)
// log(1 + linear*99)/log(100) compresses the range so small values become visible
function heatmapColor(val, absMax) {
  if (!absMax) return "#222222";
  const linear = Math.abs(val) / absMax;
  if (linear < 0.001) return "#222222";
  const t = Math.log(1 + linear * 99) / Math.log(100);
  if (val < 0) return `hsl(220, ${Math.round(55 + t * 35)}%, ${Math.round(10 + t * 36)}%)`;
  const hue = Math.round(42 - t * 40);
  return `hsl(${hue}, 90%, ${Math.round(13 + t * 35)}%)`;
}

// ──────────────────────────────────────────────────────────────
//  Stick spectrum (full-width)
// ──────────────────────────────────────────────────────────────
const SpectrumBar = ({ peaks }) => {
  const W = 600, H = 120, PAD = 4;
  const iW = W - PAD * 2, iH = H - PAD * 2;

  if (!peaks?.length) return <div className="w-full h-full bg-[#0a0a0a] rounded" />;

  const byIntensity = [...peaks].sort((a, b) => b.intensity - a.intensity).slice(0, 60);
  const maxI  = byIntensity[0]?.intensity || 1;
  const top   = byIntensity.sort((a, b) => a.mz - b.mz);
  const mzMin = top[0].mz;
  const mzRng = (top[top.length - 1].mz - mzMin) || 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      style={{ display: "block" }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />
      <g transform={`translate(${PAD},${PAD})`}>
        {top.map((p, i) => {
          const rel = p.intensity / maxI;
          const x   = ((p.mz - mzMin) / mzRng) * iW;
          const h   = rel * iH;
          const c   = rel > 0.75 ? "#ef4444" : rel > 0.4 ? "#f97316" : "#f59e0b";
          return <line key={i} x1={x} y1={iH} x2={x} y2={iH - h} stroke={c} strokeWidth={1.5} strokeOpacity={0.85} />;
        })}
      </g>
    </svg>
  );
};

// ──────────────────────────────────────────────────────────────
//  Arrow glyph
// ──────────────────────────────────────────────────────────────
const Arrow = () => (
  <svg className="w-5 h-5 flex-shrink-0 text-gray-700 self-center" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

// ──────────────────────────────────────────────────────────────
//  3D Canvas – axes, drop lines, drag rotation, auto-resume
// ──────────────────────────────────────────────────────────────
const Canvas3D = ({ points }) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const angleYRef = useRef(0);
  const angleXRef = useRef(0.2);   // slight initial tilt
  const projRef = useRef([]);
  const isDragRef = useRef(false);
  const lastMXRef = useRef(0);
  const lastMYRef = useRef(0);
  const lastActRef = useRef(null);
  const autoRef = useRef(true);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!points.length) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const zs = points.map((p) => p.z);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    const rng = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      Math.max(...zs) - Math.min(...zs)
    ) / 2 || 1;

    const norm = points.map((p) => ({
      ...p,
      nx: (p.x - cx) / rng,
      ny: (p.y - cy) / rng,
      nz: (p.z - cz) / rng,
      r: 4,
    }));

    const SCALE = Math.min(W, H) * 0.36;
    const FOV = 2.0;

    // Full Y-then-X rotation with perspective
    const proj = (nx, ny, nz, ay, ax) => {
      // Y-axis rotation
      const rx1 = nx * Math.cos(ay) + nz * Math.sin(ay);
      const ry1 = ny;
      const rz1 = -nx * Math.sin(ay) + nz * Math.cos(ay);
      // X-axis rotation
      const rx2 = rx1;
      const ry2 = ry1 * Math.cos(ax) - rz1 * Math.sin(ax);
      const rz2 = ry1 * Math.sin(ax) + rz1 * Math.cos(ax);
      const d = FOV / (rz2 + FOV);
      return { sx: W / 2 + rx2 * SCALE * d, sy: H / 2 - ry2 * SCALE * d, d, rz: rz2 };
    };

    const draw = () => {
      const ay = angleYRef.current;
      const ax = angleXRef.current;
      ctx.clearRect(0, 0, W, H);

      // PCA axes originating from centre (0,0,0)
      const ALEN = 0.82;
      [
        { dx: 1, dy: 0, dz: 0, color: "#ef4444", label: "PC1" },
        { dx: 0, dy: 1, dz: 0, color: "#10b981", label: "PC2" },
        { dx: 0, dy: 0, dz: 1, color: "#3b82f6", label: "PC3" },
      ].forEach(({ dx, dy, dz, color, label }) => {
        const ep = proj(dx * ALEN, dy * ALEN, dz * ALEN, ay, ax);
        ctx.beginPath();
        ctx.moveTo(W / 2, H / 2);
        ctx.lineTo(ep.sx, ep.sy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.30;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ep.sx, ep.sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.45;
        ctx.fill();
        ctx.font = "9px monospace";
        ctx.fillStyle = color;
        ctx.fillText(label, ep.sx + 5, ep.sy + 3);
        ctx.globalAlpha = 1;
      });

      const projected = norm
        .map((p) => { const r = proj(p.nx, p.ny, p.nz, ay, ax); return { ...p, ...r }; })
        .sort((a, b) => a.rz - b.rz);
      projRef.current = projected;

      // Lines from each point to the origin (W/2, H/2)
      projected.forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(W / 2, H / 2);
        ctx.strokeStyle = toxHex(p.tox_score);
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.12 + 0.10 * p.d;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Molecules
      projected.forEach((p) => {
        const hex = toxHex(p.tox_score);
        const n = parseFloat(p.tox_score);
        if (!isNaN(n) && n >= 8) {
          const grd = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, p.r * 3.2);
          grd.addColorStop(0, "rgba(239,68,68,0.28)");
          grd.addColorStop(1, "rgba(239,68,68,0)");
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
        ctx.globalAlpha = 0.55 + 0.45 * p.d;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hex;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    };

    const RESUME_MS = 3000;
    const animate = () => {
      if (!isDragRef.current) {
        const since = lastActRef.current ? Date.now() - lastActRef.current : Infinity;
        if (since >= RESUME_MS) autoRef.current = true;
      }
      if (autoRef.current && !isDragRef.current) angleYRef.current += 0.007;
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [points]);

  const handleMouseDown = (e) => {
    isDragRef.current = true;
    autoRef.current = false;
    lastMXRef.current = e.clientX;
    lastMYRef.current = e.clientY;
    lastActRef.current = Date.now();
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    lastActRef.current = Date.now();
    if (isDragRef.current) {
      angleYRef.current += (e.clientX - lastMXRef.current) * 0.010;
      angleXRef.current += (e.clientY - lastMYRef.current) * 0.010;
      lastMXRef.current = e.clientX;
      lastMYRef.current = e.clientY;
      setTooltip(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let nearest = null, minDist = 20;
    projRef.current.forEach((p) => {
      const d = Math.sqrt((p.sx - mx) ** 2 + (p.sy - my) ** 2);
      if (d < minDist) { minDist = d; nearest = p; }
    });
    setTooltip(nearest ? { ...nearest, mx, my } : null);
  };

  const handleMouseUp = () => {
    isDragRef.current = false;
    lastActRef.current = Date.now();
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  const handleMouseLeave = () => {
    isDragRef.current = false;
    setTooltip(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(tooltip.mx + 14, 680), top: Math.max(tooltip.my - 72, 4) }}
        >
          <div className="text-white font-semibold max-w-[180px] truncate">{tooltip.name}</div>
          <div className="text-gray-400 font-mono text-[10px]">{tooltip.formula}</div>
          <div className="mt-1 text-[10px] font-bold" style={{ color: toxHex(tooltip.tox_score) }}>
            {tooltip.tox_score !== "N/A" && tooltip.tox_score !== "n/a"
              ? `EFSA Tox: ${tooltip.tox_score}/10`
              : "No tox data"}
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
        {[
          { label: "High risk  (≥ 8)", color: "#ef4444" },
          { label: "Moderate  (5–7)", color: "#f97316" },
          { label: "Low  (< 5)", color: "#10b981" },
          { label: "No data", color: "#6b7280" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      <div className="absolute top-3 right-3 text-[10px] text-gray-600 font-mono">
        PCA · 3 components · 102 molecules
      </div>
      <div className="absolute top-3 left-4 text-[10px] text-gray-700">
        drag to rotate · auto-resumes after 3 s
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
//  Main component
// ──────────────────────────────────────────────────────────────
const VectorizationEngine = () => {
  const [activated, setActivated] = useState(false);
  const [activating, setActivating] = useState(false);
  const [library, setLibrary] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [spectrum, setSpectrum] = useState(null);
  const [embedding, setEmbedding] = useState(null);
  const [points3D, setPoints3D] = useState([]);
  const [show3D, setShow3D] = useState(false);
  const [loading3D, setLoading3D] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleActivate = () => {
    setActivating(true);
    setActivated(true);
  };

  useEffect(() => {
    if (!activated) return;
    const minDelay = new Promise((r) => setTimeout(r, 1800));
    Promise.all([
      fetch(`${BACKEND}/neural-safety/library`).then((r) => r.json()),
      minDelay,
    ])
      .then(([data]) => {
        setLibrary(data);
        if (data.length) setSelectedId(data[0].id);
        setActivating(false);
      })
      .catch(() => setActivating(false));
  }, [activated]);

  useEffect(() => {
    if (selectedId === null) return;
    setSpectrum(null);
    setEmbedding(null);
    Promise.all([
      fetch(`${BACKEND}/neural-safety/spectrum/${selectedId}`).then((r) => r.json()),
      fetch(`${BACKEND}/neural-safety/embedding/${selectedId}`).then((r) => r.json()),
    ]).then(([spec, emb]) => { setSpectrum(spec); setEmbedding(emb.embedding); });
  }, [selectedId]);

  useEffect(() => {
    if (!show3D || points3D.length > 0) return;
    setLoading3D(true);
    fetch(`${BACKEND}/neural-safety/embeddings-3d`)
      .then((r) => r.json())
      .then((data) => { setPoints3D(data); setLoading3D(false); })
      .catch(() => setLoading3D(false));
  }, [show3D, points3D.length]);

  const selectedMol = library.find((m) => m.id === selectedId);
  const embMax = embedding ? Math.max(...embedding.map(Math.abs)) : 1;

  // Stage 1: top 7 by intensity
  const top17 = spectrum?.peaks
    ? [...spectrum.peaks].sort((a, b) => b.intensity - a.intensity).slice(0, 17)
    : null;
  const maxI7 = top17 ? Math.max(...top17.map((p) => p.intensity)) : 1;

  // Stage 2: token chips
  const tokens = top17 ? top17.map((p) => p.mz.toFixed(2)) : [];

  // Stage 3: first 4 embedding dims
  const embPreview = embedding ? embedding.slice(0, 40) : [];

  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-12"
      style={{ paddingTop: "200px", paddingBottom: "100px" }}
    >
      <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800/60"
        style={{ height: "min(calc(100vh - 300px), 760px)" }}>

        {/* ── TOP BAR ── */}
        <div className={`flex items-center ${activated && !activating ? "justify-between" : "justify-center"} px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0`}>

          {/* Molecule dropdown — only when activated */}
          {activated && !activating && (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-gray-300 hover:border-amber-500/50 transition-colors"
              >
                <LuDatabase className="w-3 h-3 text-amber-400" />
                <span className="max-w-[200px] truncate">{selectedMol?.name ?? "Select molecule…"}</span>
                <svg className={`w-3 h-3 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-64 bg-[#1a1a1a] border border-gray-700 rounded shadow-2xl max-h-60 overflow-y-auto"
                  style={{ scrollbarWidth: "none" }}>
                  {library.map((mol) => (
                    <button key={mol.id}
                      onClick={() => { setSelectedId(mol.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs border-b border-gray-800/50 transition-colors ${
                        mol.id === selectedId ? "text-amber-300 bg-amber-600/10" : "text-gray-300 hover:bg-white/5"
                      }`}>
                      {mol.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Centre label */}
          <div className="flex items-center gap-2">
            <LuAtom className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Spec2Vec · Vectorization Engine
            </span>
          </div>

          {/* 3D toggle — only when activated */}
          {activated && !activating && (
            <button
              onClick={() => setShow3D((s) => !s)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold transition-all duration-300 ${show3D
                ? "bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:bg-white/5"
                : "bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white hover:shadow-lg hover:scale-105"
                }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              {show3D ? "← Back" : "3D Landscape"}
            </button>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div className="flex-1 overflow-hidden bg-[#111111] flex flex-col">

          {(!activated || activating) ? (
            /* ── GATE: button or spinner ── */
            <div className="flex-1 flex items-center justify-center">
              {activating ? (
                <div className="flex flex-col items-center gap-3 text-gray-600 text-xs">
                  <LuAtom className="w-6 h-6 text-amber-500/40 animate-spin" />
                  <span>Initializing Spec2Vec embeddings…</span>
                </div>
              ) : (
                <button onClick={handleActivate}
                  className="flex items-center gap-2 px-6 py-3 rounded text-sm font-semibold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white hover:shadow-lg hover:scale-105 transition-all">
                  <LuAtom className="w-4 h-4" />
                  Use Spec2Vec
                </button>
              )}
            </div>
          ) : show3D ? (
            /* ── 3D VIEW ── */
            <div className="flex flex-col h-full">
              <div className="px-5 pt-3 pb-2 border-b border-gray-800/50 flex-shrink-0">
                <span className="text-[10px] uppercase tracking-widest text-gray-600">
                  Chemical space · Spec2Vec embeddings projected to 3D via PCA
                </span>
              </div>
              <div className="flex-1 min-h-0">
                {loading3D ? (
                  <div className="h-full flex items-center justify-center text-gray-600 text-sm gap-2">
                    <LuAtom className="w-5 h-5 text-amber-500/40 animate-spin" />
                    Computing embeddings…
                  </div>
                ) : (
                  <Canvas3D points={points3D} />
                )}
              </div>
            </div>

          ) : (
            /* ── SPLIT VIEW (no scroll, fills height) ── */
            <div className="flex-1 flex min-h-0">

              {/* LEFT · Spectrum + Pipeline — two equal halves */}
              <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">

                {/* TOP HALF — Spectrum */}
                <div className="flex-1 flex flex-col px-5 py-4 border-b border-gray-800 min-h-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                    <LuActivity className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      Raw MS/MS Spectrum
                    </span>
                  </div>

                  <div className="flex-1 min-h-0">
                    {spectrum
                      ? <SpectrumBar peaks={spectrum.peaks} />
                      : <div className="w-full h-full rounded bg-[#0a0a0a] animate-pulse" />}
                  </div>

                  {selectedMol && (
                    <div className="grid grid-cols-3 gap-2 mt-3 flex-shrink-0">
                      <div className="bg-[#1a1a1a] rounded p-2.5">
                        <div className="text-[10px] text-gray-600 uppercase tracking-wide">Molecule</div>
                        <div className="text-xs text-gray-200 mt-0.5 truncate">{selectedMol.name}</div>
                      </div>
                      <div className="bg-[#1a1a1a] rounded p-2.5">
                        <div className="text-[10px] text-gray-600 uppercase tracking-wide">Exact Mass</div>
                        <div className="text-xs text-gray-200 mt-0.5 font-mono">
                          {selectedMol.exact_mass !== "N/A" ? `${parseFloat(selectedMol.exact_mass).toFixed(3)} Da` : "N/A"}
                        </div>
                      </div>
                      <div className="bg-[#1a1a1a] rounded p-2.5">
                        <div className="text-[10px] text-gray-600 uppercase tracking-wide">Peaks</div>
                        <div className="text-xs text-gray-200 mt-0.5">{selectedMol.peak_count}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTTOM HALF — Vectorization Pipeline */}
                <div className="flex-1 flex flex-col px-5 py-4 min-h-0 overflow-hidden">
                  <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-3 flex-shrink-0">
                    Vectorization Pipeline
                  </div>
                  <div className="flex items-stretch gap-2 flex-1 min-h-0">

                    <div className="flex-1 bg-[#0e0e0e] rounded p-3 border border-gray-800 overflow-hidden flex flex-col">
                      <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mb-2 flex-shrink-0">
                        1 · Spectrum
                      </div>
                      <div className="flex items-end gap-0.5 overflow-hidden flex-1">
                        {(top17 ?? Array.from({ length: 7 }, (_, i) => ({ intensity: (7 - i) / 7 }))).map((p, i) => {
                          const rel = p.intensity / maxI7;
                          return (
                            <div key={i} className="flex-1 rounded-sm"
                              style={{
                                height: `${Math.max(10, rel * 100)}%`,
                                background: rel > 0.7 ? "#ef4444" : rel > 0.4 ? "#f97316" : "#f59e0b",
                                opacity: 0.75,
                              }}
                            />
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1.5 flex-shrink-0">MS/MS fingerprint</div>
                    </div>

                    <Arrow />

                    <div className="flex-1 bg-[#0e0e0e] rounded p-3 border border-gray-800 overflow-hidden flex flex-col">
                      <div className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-2 flex-shrink-0">
                        2 · Tokens
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto flex flex-wrap items-start content-start gap-1"
                        style={{ scrollbarWidth: "none" }}>
                        {(tokens.length ? tokens : ["—", "—", "—", "—", "—", "—"]).map((t, i) => (
                          <span key={i} className="text-[9px] font-mono bg-gray-800/80 text-amber-400/80 px-1 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                        {tokens.length > 0 && (
                          <span className="text-[9px] font-mono text-gray-600 px-1 py-0.5">…</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1.5 flex-shrink-0">peaks as words</div>
                    </div>

                    <Arrow />

                    <div className="flex-1 bg-[#0e0e0e] rounded p-3 border border-gray-800 overflow-hidden flex flex-col">
                      <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-2 flex-shrink-0">
                        3 · Embedding
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto font-mono text-[9px] text-emerald-400/80 leading-relaxed"
                        style={{ scrollbarWidth: "none" }}>
                        [{embPreview.map((v) => v.toFixed(2)).join(", ")}{embedding ? "…]" : "…]"}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1.5 flex-shrink-0">300D vector</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT · Chemical Embedding — heatmap fills remaining height */}
              <div className="flex-1 flex flex-col px-5 py-4 min-w-0">

                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  <LuAtom className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Chemical Embedding · 300 Dimensions
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3 flex-shrink-0">
                  {[
                    { label: "Model",        value: "Spec2Vec" },
                    { label: "Dimensions",   value: "300" },
                    { label: "Architecture", value: "Word2Vec" },
                    { label: "Training",     value: "EFSA Lib." },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#1a1a1a] rounded p-2 text-center">
                      <div className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</div>
                      <div className="text-xs text-amber-400/80 font-semibold mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-600">20 × 15 grid · 300 dimensions</span>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600">
                    {[
                      { c: "hsl(220,90%,42%)", l: "negative" },
                      { c: "#222",             l: "≈ 0" },
                      { c: "#f59e0b",          l: "positive" },
                    ].map(({ c, l }) => (
                      <span key={l} className="flex items-center gap-1">
                        <span className="inline-block w-3 h-2 rounded border border-gray-700/50" style={{ background: c }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Heatmap — flex-1 so it fills all remaining vertical space */}
                <div className="flex-1 min-h-0 rounded p-0.5">
                  {embedding ? (
                    <div className="w-full h-full grid gap-1"
                      style={{ gridTemplateColumns: "repeat(20, 1fr)", gridTemplateRows: "repeat(15, 1fr)" }}>
                      {embedding.map((val, i) => (
                        <div key={i}
                          title={`dim ${i + 1}: ${val.toFixed(4)}`}
                          style={{ backgroundColor: heatmapColor(val, embMax) }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full grid gap-1"
                      style={{ gridTemplateColumns: "repeat(20, 1fr)", gridTemplateRows: "repeat(15, 1fr)" }}>
                      {Array.from({ length: 300 }).map((_, i) => (
                        <div key={i} className="animate-pulse" style={{ backgroundColor: "#1e1e1e" }} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-1 text-[10px] text-gray-700 font-mono flex-shrink-0">
                  <span>dim 1</span><span>dim 300</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VectorizationEngine;
