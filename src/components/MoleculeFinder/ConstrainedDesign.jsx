import { useState, useEffect, useRef } from "react";

const BACKEND = "http://localhost:8000";
const STEP_DURATION = 1200; // ms — same for all 3 steps

// ── Step indicator bar ─────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: "Candidate Pool" },
  { n: 2, label: "Property Prediction" },
  { n: 3, label: "NSGA-II (3-obj)" },
];

const StepBar = ({ activeStep }) => (
  <div className="flex items-center mb-3">
    {STEPS.map((s, i) => (
      <div key={s.n} className="flex items-center">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-500
          ${activeStep === s.n
            ? "bg-violet-900/40 border border-violet-700/50 text-violet-300"
            : "bg-gray-900/40 border border-gray-800 text-gray-600"}`}>
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-500
            ${activeStep === s.n ? "bg-violet-600 text-white" : "bg-gray-700 text-gray-500"}`}>
            {s.n}
          </span>
          {s.label}
        </div>
        {i < STEPS.length - 1 && (
          <div className="h-px w-6 mx-1 bg-gray-800" />
        )}
      </div>
    ))}
  </div>
);

// ── Tanimoto color helpers ─────────────────────────────────────────────────────
function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1,3),16), g1 = parseInt(hex1.slice(3,5),16), b1 = parseInt(hex1.slice(5,7),16);
  const r2 = parseInt(hex2.slice(1,3),16), g2 = parseInt(hex2.slice(3,5),16), b2 = parseInt(hex2.slice(5,7),16);
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}
function tanimotoColor(t) {
  if (t < 0.33) return lerpColor("#3b82f6","#14b8a6", t/0.33);
  if (t < 0.66) return lerpColor("#14b8a6","#f59e0b",(t-0.33)/0.33);
  return lerpColor("#f59e0b","#f43f5e",(t-0.66)/0.34);
}

const KNOWN_ALTS = new Set([
  "Vanillin","Ethylvanillin","Piperonal","Guaiacol",
  "4-Hydroxybenzaldehyde","Anisaldehyde","Heliotropin",
  "3,4-Dimethoxybenzaldehyde","Syringaldehyde",
]);

// ── Animated scatter (3-objective) ────────────────────────────────────────────
const AnimatedScatter = ({ animPhase, generations, currentGenIdx, reference, prevAllDots, prevPareto }) => {
  const W = 380, H = 240;
  const pad = { l: 44, r: 16, t: 28, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const axisY = pad.t + plotH;

  const currentGen = generations[currentGenIdx] ?? generations[0];
  const dots = currentGen?.candidates ?? [];
  const inNsga2 = animPhase === "nsga2" || animPhase === "done";
  const inPred  = animPhase === "prediction";

  const allCands = generations.flatMap(g => g.candidates ?? []);
  const allMW   = [...allCands.map(c => c.mw),   reference?.mw  ?? 152].filter(Boolean);
  const allLogS = [...allCands.map(c => c.logS), reference?.logS ?? -1.2].filter(v => v != null);
  const mwMin = Math.max(60, Math.min(...allMW) - 12);
  const mwMax =              Math.max(...allMW) + 20;
  const lsMin =              Math.min(...allLogS) - 0.4;
  const lsMax =              Math.max(...allLogS) + 0.4;

  const px = mw   => pad.l + ((mw   - mwMin) / (mwMax - mwMin)) * plotW;
  const py = logS => pad.t + (1 - (logS - lsMin) / (lsMax - lsMin)) * plotH;

  const [hovered, setHovered] = useState(null);

  // Current-gen dots: gray during pool/prediction; Tanimoto colors appear at nsga2
  const getDotFill = c => inNsga2
    ? (c.is_new ? "#818cf8" : (c.dominated ? "#374151" : tanimotoColor(c.tanimoto ?? 0)))
    : "#6b7280";
  const getDotR   = c => inNsga2 ? (c.dominated ? 3.5 : (c.is_new ? 5 : 5.5)) : 4;
  const getDotOp  = c => animPhase === "pool" ? 0.5 : (inNsga2 ? (c.dominated ? 0.35 : 0.87) : 0.75);

  const getDotCy = c => (animPhase === "pool") ? axisY : py(c.logS);

  const getDotTransition = i => {
    if (animPhase === "pool")       return "none";
    if (animPhase === "prediction") return `cy 1.0s cubic-bezier(0.34,1.56,0.64,1) ${i * 12}ms, opacity 0.3s ease`;
    return "cy 0.4s ease, fill 0.4s ease, opacity 0.3s ease, r 0.3s ease";
  };

  const getLabelY  = c => (animPhase === "pool") ? axisY - 9 : py(c.logS) - 9;
  const getLabelOp = () => inPred ? 0.72 : 0;
  const getLabelTransition = i => {
    if (animPhase === "pool") return "none";
    if (animPhase === "prediction")
      return `y 1.0s cubic-bezier(0.34,1.56,0.64,1) ${i * 12}ms, opacity 0.5s ease ${i * 12}ms`;
    return "opacity 0.3s ease";
  };

  // Ghost dots: all prev-gen during pool; only Pareto during prediction/nsga2
  const ghostDots = animPhase === "pool" ? (prevAllDots ?? []) : (prevPareto ?? []);

  // Pareto frontier (nsga2/done)
  const front = inNsga2
    ? [...dots].filter(c => !c.dominated).sort((a,b) => a.mw - b.mw)
    : [];
  const frontPath = front.length > 1
    ? front.map((c,j) => `${j===0?"M":"L"}${px(c.mw).toFixed(1)},${py(c.logS).toFixed(1)}`).join(" ")
    : "";

  const mwTicks = [80,100,120,140,160,180,200,220,240,260,280,300].filter(v => v >= mwMin && v <= mwMax + 4);
  const lsTicks = [-5,-4.5,-4,-3.5,-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1].filter(v => v >= lsMin - 0.1 && v <= lsMax + 0.1);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">

        {mwTicks.map(v => (
          <line key={v} x1={px(v)} y1={pad.t} x2={px(v)} y2={axisY} stroke="#1f2937" strokeWidth={0.5} />
        ))}
        {!(animPhase === "pool") && lsTicks.map(v => (
          <line key={v} x1={pad.l} y1={py(v)} x2={pad.l + plotW} y2={py(v)} stroke="#1f2937" strokeWidth={0.5} />
        ))}

        {inNsga2 && (
          <>
            <rect x={pad.l} y={pad.t} width={plotW * 0.22} height={plotH * 0.22}
              fill="#a855f7" opacity={0.06} rx={3} />
            <text x={pad.l + 5} y={pad.t + 12} fontSize={7} fill="#a855f7" opacity={0.45}>ideal</text>
          </>
        )}

        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={axisY} stroke="#374151" strokeWidth={1} />
        <line x1={pad.l} y1={axisY} x2={pad.l + plotW} y2={axisY} stroke="#374151" strokeWidth={1} />

        {frontPath && (
          <path d={frontPath} fill="none" stroke="#a855f7" strokeWidth={1.5}
            strokeDasharray="5 3" opacity={0.6} />
        )}

        {animPhase === "pool" && (
          <text x={pad.l + plotW / 2} y={axisY - 8} fontSize={7.5} fill="#374151" textAnchor="middle">
            logS not yet predicted
          </text>
        )}

        {/* Ghost dots: prev-gen with their Tanimoto colors */}
        {ghostDots.map((c, i) => {
          const fill = c.is_new ? "#818cf8" : (c.dominated ? "#374151" : tanimotoColor(c.tanimoto ?? 0));
          const op   = animPhase === "pool"
            ? (c.dominated ? 0.12 : 0.22)
            : (c.dominated ? 0.18 : 0.32);
          return (
            <circle
              key={`ghost-${c.smiles ?? i}`}
              cx={px(c.mw)}
              cy={py(c.logS)}
              r={c.dominated ? 3 : 4}
              fill={fill}
              opacity={op}
              style={{ transition: "opacity 0.4s ease" }}
            />
          );
        })}

        {/* Dots + rising logS labels */}
        {dots.map((c, i) => {
          const isKnown = inNsga2 && KNOWN_ALTS.has(c.name) && !c.dominated;
          return (
            <g key={c.smiles ?? i}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}>

              {/* logS label — rises with dot in prediction */}
              <text
                x={px(c.mw)}
                y={getLabelY(c)}
                textAnchor="middle"
                fontSize={6}
                fill="#9ca3af"
                opacity={getLabelOp()}
                style={{ transition: getLabelTransition(i) }}
                pointerEvents="none"
              >
                {c.logS?.toFixed(1)}
              </text>

              {/* Known-alt ring */}
              {isKnown && (
                <circle cx={px(c.mw)} cy={py(c.logS)} r={getDotR(c) + 4}
                  fill="none" stroke={getDotFill(c)} strokeWidth={1.5} opacity={0.5} />
              )}

              {/* Dot */}
              <circle
                cx={px(c.mw)}
                cy={getDotCy(c)}
                r={getDotR(c)}
                fill={getDotFill(c)}
                opacity={getDotOp(c)}
                style={{ transition: getDotTransition(i) }}
              />

              {/* Known-alt label */}
              {isKnown && (
                <text x={px(c.mw) + getDotR(c) + 3} y={py(c.logS) + 3}
                  fontSize={7} fill={getDotFill(c)} opacity={0.85}
                  style={{ pointerEvents: "none" }}>
                  {c.name.split(" ")[0]}
                </text>
              )}

              {/* Tooltip */}
              {hovered === i && animPhase !== "pool" && (
                <g>
                  <rect x={px(c.mw) + 9} y={py(c.logS) - 34} width={148} height={48}
                    rx={4} fill="#111" stroke="#374151" />
                  <text x={px(c.mw) + 13} y={py(c.logS) - 21} fontSize={8} fill="#e5e7eb">{c.name}</text>
                  <text x={px(c.mw) + 13} y={py(c.logS) - 10} fontSize={7} fill="#9ca3af">
                    logS {c.logS?.toFixed(2)} · MW {c.mw} Da
                  </text>
                  <text x={px(c.mw) + 13} y={py(c.logS) + 1} fontSize={7} fill={getDotFill(c)}>
                    Tanimoto {(c.tanimoto ?? 0).toFixed(3)}{c.is_new ? " · new" : ""}
                  </text>
                </g>
              )}
              {hovered === i && animPhase === "pool" && (
                <g>
                  <rect x={px(c.mw) + 9} y={axisY - 36} width={120} height={26}
                    rx={4} fill="#111" stroke="#374151" />
                  <text x={px(c.mw) + 13} y={axisY - 23} fontSize={8} fill="#e5e7eb">{c.name}</text>
                  <text x={px(c.mw) + 13} y={axisY - 11} fontSize={7} fill="#9ca3af">MW {c.mw} Da</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Vanillin reference */}
        {inNsga2 && reference?.logS != null && reference?.mw != null && (
          <g style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered("ref")}
            onMouseLeave={() => setHovered(null)}>
            <circle cx={px(reference.mw)} cy={py(reference.logS)} r={7}
              fill="none" stroke="#fbbf24" strokeWidth={2} opacity={0.9} />
            <circle cx={px(reference.mw)} cy={py(reference.logS)} r={3} fill="#fbbf24" opacity={0.9} />
            {hovered === "ref" && (
              <g>
                <rect x={px(reference.mw) + 9} y={py(reference.logS) - 34} width={135} height={48}
                  rx={4} fill="#111" stroke="#374151" />
                <text x={px(reference.mw) + 13} y={py(reference.logS) - 21} fontSize={8} fill="#fbbf24">Vanillin (reference)</text>
                <text x={px(reference.mw) + 13} y={py(reference.logS) - 10} fontSize={7} fill="#9ca3af">
                  logS {reference.logS?.toFixed(2)} · MW {reference.mw} Da
                </text>
                <text x={px(reference.mw) + 13} y={py(reference.logS) + 1} fontSize={7} fill="#fbbf24">
                  Tanimoto 1.00 (self)
                </text>
              </g>
            )}
          </g>
        )}

        {/* Axis ticks */}
        {mwTicks.map(v => (
          <text key={v} x={px(v)} y={axisY + 11} fontSize={7} fill="#6b7280" textAnchor="middle">{v}</text>
        ))}
        {animPhase !== "pool" && lsTicks.map(v => (
          <text key={v} x={pad.l - 4} y={py(v) + 3} fontSize={7} fill="#6b7280" textAnchor="end">{v.toFixed(1)}</text>
        ))}

        <text x={pad.l + plotW / 2} y={axisY + 23} fontSize={8} fill="#6b7280" textAnchor="middle">
          Molecular Weight (Da) — minimise →
        </text>
        {animPhase !== "pool" && (
          <text x={10} y={pad.t + plotH / 2} fontSize={8} fill="#6b7280" textAnchor="middle"
            transform={`rotate(-90,10,${pad.t + plotH / 2})`}>
            logS (mol/L) — maximise →
          </text>
        )}
      </svg>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const ConstrainedDesign = () => {
  const [animPhase, setAnimPhase]         = useState("idle");
  const [poolMeta, setPoolMeta]           = useState(null);
  const [modelMeta, setModelMeta]         = useState(null);
  const [propRange, setPropRange]         = useState(null);
  const [generations, setGenerations]     = useState([]);
  const [reference, setReference]         = useState(null);
  const [foundAlts, setFoundAlts]         = useState([]);
  const [currentGenIdx, setCurrentGenIdx] = useState(0);
  const [error, setError]                 = useState(null);
  const [modelReady, setModelReady]       = useState(false);
  const [prevAllDots, setPrevAllDots]     = useState([]);
  const [prevPareto, setPrevPareto]       = useState([]);
  const phaseTimers = useRef([]);

  useEffect(() => {
    fetch(`${BACKEND}/molecule-finder/candidates/meta`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPoolMeta(d); })
      .catch(() => {});

    fetch(`${BACKEND}/molecule-finder/available-datasets`)
      .then(r => r.ok ? r.json() : [])
      .then(datasets => {
        const aqsol = datasets.find(d => d.id === "aqsoldb");
        if (aqsol?.n_cached) setModelReady(true);
      })
      .catch(() => {});
  }, []);

  const clearAll = () => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
  };

  const startAnimation = (gens) => {
    setCurrentGenIdx(0);
    setAnimPhase("pool");
    setPrevAllDots([]);
    setPrevPareto([]);

    let offset = STEP_DURATION;

    for (let genIdx = 0; genIdx < gens.length; genIdx++) {
      const capturedIdx = genIdx;
      const prevCands   = genIdx > 0 ? (gens[genIdx - 1].candidates ?? []) : [];
      const prevFront   = prevCands.filter(c => !c.dominated);

      if (genIdx > 0) {
        phaseTimers.current.push(setTimeout(() => {
          setCurrentGenIdx(capturedIdx);
          setAnimPhase("pool");
          setPrevAllDots(prevCands);
          setPrevPareto(prevFront);
        }, offset));
        offset += STEP_DURATION;
      }

      phaseTimers.current.push(setTimeout(() => {
        setAnimPhase("prediction");
        setPrevAllDots([]);
      }, offset));
      offset += STEP_DURATION;

      phaseTimers.current.push(setTimeout(() => {
        setAnimPhase("nsga2");
      }, offset));
      offset += STEP_DURATION;
    }

    phaseTimers.current.push(setTimeout(() => {
      setAnimPhase("done");
    }, offset));
  };

  const handleOptimize = async () => {
    clearAll();
    setAnimPhase("loading");
    setGenerations([]);
    setCurrentGenIdx(0);
    setFoundAlts([]);
    setError(null);

    try {
      const res = await fetch(`${BACKEND}/molecule-finder/optimize-3obj`, { method: "POST" });
      if (res.status === 409) { setAnimPhase("idle"); setModelReady(false); return; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setModelReady(true);
      setPoolMeta(data.pool_meta);
      setModelMeta(data.model_meta);
      setPropRange(data.property_range);
      setReference(data.reference);
      setFoundAlts(data.known_alternatives_found ?? []);
      setGenerations(data.generations);
      startAnimation(data.generations);
    } catch (e) {
      setError(e.message);
      setAnimPhase("idle");
    }
  };

  const handleReplay = () => {
    if (generations.length === 0) return;
    clearAll();
    setPrevAllDots([]);
    setPrevPareto([]);
    startAnimation(generations);
  };

  useEffect(() => () => clearAll(), []);

  const isRunning = ["pool", "prediction", "nsga2"].includes(animPhase);
  const isActive  = isRunning || animPhase === "done";

  const activeStep =
    animPhase === "pool"                              ? 1
    : animPhase === "prediction"                      ? 2
    : (animPhase === "nsga2" || animPhase === "done") ? 3
    : 0;

  const currentGen = generations[currentGenIdx];
  const progress   = generations.length > 0 ? (currentGenIdx / (generations.length - 1)) * 100 : 0;

  const finalPareto = animPhase === "done"
    ? [...(generations[generations.length - 1]?.candidates ?? [])]
        .filter(c => !c.dominated)
        .sort((a,b) => (b.tanimoto ?? 0) - (a.tanimoto ?? 0))
    : [];

  const s1 = activeStep === 1;
  const s2 = activeStep === 2;
  const s3 = activeStep === 3 || animPhase === "done";

  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: 200, paddingBottom: 100 }}
    >
      <div className="max-w-6xl mx-auto w-full">

        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-5 gap-5">

          {/* ── Left column ── */}
          <div className="col-span-2 rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-0">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">
              Optimization Workflow
            </div>

            {/* Reference */}
            <div className="flex items-center gap-2.5 pb-1">
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400" />
              </div>
              <div className="text-[10px] text-gray-500">
                <span className="text-amber-300 font-semibold">Vanillin</span>
                <span className="ml-1.5 text-gray-600">E1001 · 152.15 Da · Tanimoto ref</span>
                {reference?.logS != null && (
                  <span className="ml-1.5 text-gray-600">· logS {reference.logS.toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3 mt-2" />

            {/* Step 1 — Candidate Pool */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s1 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>1</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s1 ? "text-gray-200" : "text-gray-500"}`}>
                  Candidate Pool
                </div>
                {poolMeta ? (
                  <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                    <span>
                      <span className={`font-semibold transition-colors duration-500 ${s1 ? "text-gray-300" : ""}`}>
                        {poolMeta.n_after_filter ?? poolMeta.n_candidates}
                      </span> aromatic compounds · PubChem
                    </span>
                    {poolMeta.n_excluded > 0 && (
                      <span className="text-[9px] text-gray-600">
                        {poolMeta.n_excluded} excluded (halogens/metals)
                      </span>
                    )}
                    <span>Similarity ≥ <span className="text-gray-400">{poolMeta.threshold}%</span></span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {poolMeta.seeds?.map(seed => (
                        <span key={seed} className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors duration-500
                          ${s1 ? "bg-violet-900/20 border-violet-800/30 text-violet-400" : "bg-gray-900 border-gray-800 text-gray-600"}`}>
                          {seed}
                        </span>
                      ))}
                    </div>
                    <span className="text-[9px] text-gray-600 mt-0.5">SMARTS mutation generates novel analogs per generation</span>
                  </div>
                ) : <span className="text-[10px] text-gray-600">Loading…</span>}
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3" />

            {/* Step 2 — Property Prediction */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s2 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>2</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s2 ? "text-gray-200" : "text-gray-500"}`}>
                  Property Prediction
                </div>
                <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                  <span>RF · <span className="text-gray-400">AqSolDB</span> · Target: log S (mol/L)</span>
                  <span>MW: <span className="text-gray-400">RDKit exact</span></span>
                  <span>Tanimoto: <span className="text-gray-400">ECFP4 2048-bit vs Vanillin</span></span>
                  {modelMeta && (
                    <span>OOB R²: <span className={`font-semibold transition-colors duration-500 ${s2 ? "text-emerald-400" : "text-gray-500"}`}>{modelMeta.oob_r2}</span></span>
                  )}
                  {propRange && (
                    <span className="text-[9px] text-gray-600">
                      logS {propRange.logS_min}…{propRange.logS_max} · MW {propRange.mw_min}–{propRange.mw_max} Da
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3" />

            {/* Step 3 — NSGA-II (3-obj) */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s3 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>3</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s3 ? "text-gray-200" : "text-gray-500"}`}>
                  NSGA-II (3-objective)
                </div>
                <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                  <span>Obj-1: logS ↑ &nbsp;·&nbsp; Obj-2: MW ↓ &nbsp;·&nbsp; Obj-3: Tanimoto ↑</span>
                  <span>pop_size 30 · 8 generations</span>
                  {isActive && (
                    <div className="mt-1">
                      <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                        <span>Gen {currentGen?.gen ?? 0} / 70</span>
                        <span>
                          {(currentGen?.n_new ?? 0) > 0 && (
                            <span className="text-indigo-400 mr-1">+{currentGen.n_new} new</span>
                          )}
                          {currentGen?.candidates?.filter(c => !c.dominated).length ?? 0} Pareto-opt.
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-1000"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-3" />
            <div className="h-px bg-gray-800/60 mt-3 mb-3" />

            {!modelReady && (
              <div className="mb-3 px-3 py-2.5 rounded-lg bg-amber-900/25 border border-amber-700/40 text-[11px] text-amber-300 leading-snug">
                ⚠ Train the <strong>AqSolDB</strong> model first in the <strong>Property Prediction</strong> tab.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleOptimize}
                disabled={!modelReady || isRunning || animPhase === "loading"}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                  bg-violet-700/80 border border-violet-600/60 text-white hover:bg-violet-600/80
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {animPhase === "loading" ? "Loading…"
                  : isRunning            ? "Optimising…"
                  : animPhase === "done" ? "▶ Run again"
                  : "▶ Run pipeline"}
              </button>
              {animPhase === "done" && (
                <button
                  onClick={handleReplay}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
                  title="Replay animation"
                >↺</button>
              )}
            </div>
          </div>

          {/* ── Right column — chart ── */}
          <div className="col-span-3 rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              {poolMeta
                ? `${poolMeta.n_after_filter ?? poolMeta.n_candidates} compounds · colour = Tanimoto to Vanillin`
                : "3-objective Pareto space"}
            </div>
            <StepBar activeStep={activeStep} />

            {isActive ? (
              <>
                <AnimatedScatter
                  animPhase={animPhase}
                  generations={generations}
                  currentGenIdx={currentGenIdx}
                  reference={reference}
                  prevAllDots={prevAllDots}
                  prevPareto={prevPareto}
                />

                {/* Tanimoto colour legend */}
                {(animPhase === "nsga2" || animPhase === "done") && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] text-gray-600">Tanimoto to Vanillin:</span>
                    <svg width={90} height={10} viewBox="0 0 90 10">
                      <defs>
                        <linearGradient id="tanimGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%"   stopColor="#3b82f6" />
                          <stop offset="33%"  stopColor="#14b8a6" />
                          <stop offset="66%"  stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#f43f5e" />
                        </linearGradient>
                      </defs>
                      <rect x={0} y={2} width={90} height={6} rx={3} fill="url(#tanimGrad)" opacity={0.8} />
                    </svg>
                    <span className="text-[9px] text-blue-400">0.0</span>
                    <span className="text-[9px] text-rose-400 ml-1">1.0</span>

                    <div className="ml-3 flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 opacity-85" />New offspring
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-600 opacity-60" />Dominated
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-90" />Vanillin (ref)
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <div className="w-2.5 h-2.5 rounded-full border border-rose-400 opacity-80" />Known alt.
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center min-h-48">
                {animPhase === "loading" ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-600 text-sm">Evaluating pool & running NSGA-II…</span>
                  </div>
                ) : (
                  <span className="text-gray-600 text-sm">Click Run pipeline to start</span>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ── Pareto results — full width ── */}
        {animPhase === "done" && finalPareto.length > 0 && (
          <div className="mt-5 rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-gray-500">
                Pareto-optimal candidates — Final generation
              </span>
              <span className="text-[10px] text-gray-600">sorted by Tanimoto ↓</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["#","Name","logS (RF) ↑","MW (Da) ↓","Tanimoto ↑","Origin"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {finalPareto.slice(0, 14).map((c, i) => {
                    const isKnown = KNOWN_ALTS.has(c.name);
                    const tSim    = c.tanimoto ?? 0;
                    return (
                      <tr key={i} className={`border-b border-gray-800/40 ${isKnown ? "bg-violet-900/10" : ""}`}>
                        <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-200">
                          {c.name}
                          {isKnown && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-900/40 text-violet-300">
                              known alt.
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span style={{ color: c.logS > (reference?.logS ?? -1.2) ? "#22c55e" : "#9ca3af" }}>
                            {c.logS.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-400">{c.mw}</td>
                        <td className="px-3 py-2 font-mono">
                          <span style={{ color: tanimotoColor(tSim) }}>{tSim.toFixed(3)}</span>
                        </td>
                        <td className="px-3 py-2">
                          {c.name.startsWith("Analog-") ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-400">generated</span>
                          ) : (
                            <span className="text-[9px] text-gray-600">pool</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600">
              Seed pool: {poolMeta?.n_after_filter ?? poolMeta?.n_candidates} compounds · SMARTS mutation generated{" "}
              {Math.max(0, (generations[generations.length - 1]?.n_evaluated ?? 0) - (poolMeta?.n_after_filter ?? poolMeta?.n_candidates ?? 0))} analogs ·{" "}
              {generations[generations.length - 1]?.n_evaluated ?? 0} total evaluated.
              logS: AqSolDB RF (OOB R² {modelMeta?.oob_r2}). Tanimoto: ECFP4 2048-bit vs Vanillin.
            </div>
          </div>
        )}

        {/* ── Known alternatives callout — full width ── */}
        {animPhase === "done" && foundAlts.length > 0 && (
          <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/15 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-400 text-lg">✓</span>
              <span className="text-sm font-semibold text-emerald-300">Pipeline validation</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
              Without being told what to find, the 3-objective NSGA-II independently placed the following
              compounds on the Pareto front — the same molecules the flavour industry uses as vanillin alternatives:
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {foundAlts.map(name => (
                <span key={name}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold
                    bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">
                  {name}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 leading-snug">
              Their appearance validates the pipeline: PubChem seed compounds mutated by SMARTS-based aromatic
              substituent swaps, scored by a real solubility RF model and ECFP4 Tanimoto similarity, selected
              by 3-objective NSGA-II — sufficient to rediscover known industry solutions.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default ConstrainedDesign;
