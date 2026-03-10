import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import MolImageButton from "./MolImageButton";

const BACKEND = "http://localhost:8000";
const DUR_POOL_MUTATION = 800;  // dots appear — not much to see
const DUR_PREDICTION = 1800; // dots animate up — needs time to complete
const DUR_NSGA2 = 1100; // colour sweep — 250ms delay + 650ms transition + 200ms settle

// ── Step indicator bar ─────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: "Candidate Pool" },
  { n: 2, label: "NSGA-II Mutation" },
  { n: 3, label: "Property Prediction" },
  { n: 4, label: "NSGA-II Sort" },
];

const StepBar = ({ activeStep, pulseStep }) => (
  <div className="flex items-center">
    {STEPS.map((s, i) => (
      <div key={s.n} className="flex items-center">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-500
          ${pulseStep === s.n ? "animate-pulse" : ""}
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

// ── Color helpers ──────────────────────────────────────────────────────────────
function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
function psweetColor(p) {
  if (p < 0.5) return lerpColor("#3b82f6", "#14b8a6", p / 0.5);
  return lerpColor("#14b8a6", "#f43f5e", (p - 0.5) / 0.5);
}
function logSColor(v) {
  // v = logS, range roughly -6 to 2. Higher is better (more soluble).
  // green ≥ -1, amber ≥ -3, red < -3
  if (v == null) return "#6b7280";
  if (v >= -1) return "#22c55e";
  if (v >= -3) return "#f59e0b";
  return "#ef4444";
}

// ── Animated scatter (3-objective: P(sweet), MW, logS) ────────────────────────
const AnimatedScatter = ({ animPhase, generations, currentGenIdx, reference, prevAllDots, prevPareto, bounds, parentColorMap }) => {
  const W = 380, H = 240;
  const pad = { l: 44, r: 16, t: 28, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const axisY = pad.t + plotH;

  const currentGen = generations[currentGenIdx] ?? generations[0];
  const dots = currentGen?.candidates ?? [];
  const inNsga2 = animPhase === "nsga2" || animPhase === "done" || animPhase === "wait_mutation";
  const inPred = animPhase === "prediction";

  // P(sweet) ∈ [0, 1] — fix Y-axis to full probability range.
  let mwMin, mwMax;
  if (bounds) {
    mwMin = bounds.mwMin;
    mwMax = bounds.mwMax;
  } else {
    const allCands = generations.flatMap(g => g.candidates ?? []);
    const allMW = [...allCands.map(c => c.mw), reference?.mw ?? 302].filter(Boolean);
    mwMin = Math.max(60, Math.min(...allMW) - 12);
    mwMax = Math.max(...allMW) + 20;
  }
  const ldMin = 0;
  const ldMax = 1;

  const px = mw => pad.l + ((mw - mwMin) / (mwMax - mwMin)) * plotW;
  const py = ld => pad.t + (1 - (ld - ldMin) / (ldMax - ldMin)) * plotH;

  const [hovered, setHovered] = useState(null);

  const inMutation = animPhase === "mutation";
  const getDotCy = c => (animPhase === "pool" || (inMutation && c.is_new)) ? axisY : py(c.psweet);

  const getDotFill = c => {
    if (inMutation || inPred) {
      if (c.is_new) return "#818cf8";                               // this gen's offspring
      const prev = parentColorMap?.get(c.smiles);
      if (prev) return prev.dominated ? "#374151" : logSColor(prev.logS ?? -4);
      return "#6b7280";
    }
    if (inNsga2) return c.dominated ? "#374151" : logSColor(c.logS ?? -4);
    return "#6b7280";
  };
  const getDotR = c => inNsga2 ? (c.dominated ? 3.5 : (c.is_new ? 5 : 5.5)) : 4;
  const getDotOp = c => {
    if (animPhase === "pool") return 0.5;
    if (inMutation || inPred) {
      if (c.is_new) return inMutation ? 0.65 : 0.75;
      const prev = parentColorMap?.get(c.smiles);
      if (prev) return prev.dominated ? 0.35 : 0.87;
      return 0.45;
    }
    if (inNsga2) return c.dominated ? 0.35 : 0.87;
    return 0.75;
  };

  const getDotTransition = i => {
    if (animPhase === "pool" || inMutation) return "none";
    if (animPhase === "prediction") return `cy 1.0s cubic-bezier(0.34,1.56,0.64,1) ${i * 5}ms, opacity 0.3s ease ${i * 5}ms`;
    // nsga2: delay 250ms then slow colour sweep
    return "fill 0.65s ease 0.25s, opacity 0.55s ease 0.25s, r 0.4s ease 0.2s";
  };

  const getLabelY = c => (animPhase === "pool") ? axisY - 9 : py(c.psweet) - 9;
  const getLabelOp = () => inPred ? 0.72 : 0;
  const getLabelTransition = i => {
    if (animPhase === "pool") return "none";
    if (animPhase === "prediction")
      return `y 1.0s cubic-bezier(0.34,1.56,0.64,1) ${i * 5}ms, opacity 0.5s ease ${i * 5}ms`;
    return "opacity 0.3s ease";
  };

  const ghostDots = animPhase === "pool" ? (prevAllDots ?? []) : (prevPareto ?? []);

  const front = inNsga2
    ? [...dots].filter(c => !c.dominated).sort((a, b) => a.mw - b.mw)
    : [];
  const frontPath = front.length > 1
    ? front.map((c, j) => `${j === 0 ? "M" : "L"}${px(c.mw).toFixed(1)},${py(c.psweet).toFixed(1)}`).join(" ")
    : "";

  const mwTicks = [80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 450, 500].filter(v => v >= mwMin && v <= mwMax + 4);
  const ldTicks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].filter(v => v >= ldMin - 0.01 && v <= ldMax + 0.01);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">

        {mwTicks.map(v => (
          <line key={v} x1={px(v)} y1={pad.t} x2={px(v)} y2={axisY} stroke="#1f2937" strokeWidth={0.5} />
        ))}
        {ldTicks.map(v => (
          <line key={v} x1={pad.l} y1={py(v)} x2={pad.l + plotW} y2={py(v)} stroke="#1f2937" strokeWidth={0.5} />
        ))}

        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={axisY} stroke="#374151" strokeWidth={1} />
        <line x1={pad.l} y1={axisY} x2={pad.l + plotW} y2={axisY} stroke="#374151" strokeWidth={1} />

        {frontPath && (
          <path d={frontPath} fill="none" stroke="#a855f7" strokeWidth={1.5}
            strokeDasharray="5 3" opacity={0.6} />
        )}

        {ghostDots.map((c, i) => {
          const fill = c.is_new ? "#818cf8" : (c.dominated ? "#374151" : logSColor(c.logS ?? -4));
          const op = animPhase === "pool"
            ? (c.dominated ? 0.12 : 0.22)
            : (c.dominated ? 0.18 : 0.32);
          return (
            <circle
              key={`ghost-${c.smiles ?? i}`}
              cx={px(c.mw)}
              cy={py(c.psweet)}
              r={c.dominated ? 3 : 4}
              fill={fill}
              opacity={op}
              style={{ transition: "opacity 0.4s ease" }}
            />
          );
        })}

        {dots.map((c, i) => (
          <g key={c.smiles ?? i}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}>

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
              {c.psweet?.toFixed(3)}
            </text>

            <circle
              cx={px(c.mw)}
              cy={getDotCy(c)}
              r={getDotR(c)}
              fill={getDotFill(c)}
              opacity={getDotOp(c)}
              style={{ transition: getDotTransition(i) }}
            />

            {hovered === i && animPhase !== "pool" && (
              <g>
                <rect x={px(c.mw) + 9} y={py(c.psweet) - 34} width={165} height={48}
                  rx={4} fill="#111" stroke="#374151" />
                <text x={px(c.mw) + 13} y={py(c.psweet) - 21} fontSize={8} fill="#e5e7eb">
                  {c.cid == null ? (c.smiles?.length > 28 ? c.smiles.slice(0, 28) + "…" : c.smiles) : c.name}
                </text>
                <text x={px(c.mw) + 13} y={py(c.psweet) - 10} fontSize={7} fill="#9ca3af">
                  P(sweet) {c.psweet?.toFixed(3)} · MW {c.mw} Da
                </text>
                <text x={px(c.mw) + 13} y={py(c.psweet) + 1} fontSize={7}
                  fill={logSColor(c.logS ?? -4)}>
                  logS {(c.logS ?? -4).toFixed(3)}{c.is_new ? " · new" : ""}
                </text>
              </g>
            )}
            {hovered === i && animPhase === "pool" && (
              <g>
                <rect x={px(c.mw) + 9} y={axisY - 36} width={120} height={26}
                  rx={4} fill="#111" stroke="#374151" />
                <text x={px(c.mw) + 13} y={axisY - 23} fontSize={8} fill="#e5e7eb">
                  {c.cid == null ? (c.smiles?.length > 28 ? c.smiles.slice(0, 28) + "…" : c.smiles) : c.name}
                </text>
                <text x={px(c.mw) + 13} y={axisY - 11} fontSize={7} fill="#9ca3af">MW {c.mw} Da</text>
              </g>
            )}
          </g>
        ))}

        {reference?.psweet != null && reference?.mw != null && (
          <g style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered("ref")}
            onMouseLeave={() => setHovered(null)}>
            <circle cx={px(reference.mw)} cy={py(reference.psweet)} r={7}
              fill="none" stroke="#fbbf24" strokeWidth={2} opacity={0.9} />
            <circle cx={px(reference.mw)} cy={py(reference.psweet)} r={3} fill="#fbbf24" opacity={0.9} />
            {hovered === "ref" && (
              <g>
                <rect x={px(reference.mw) + 9} y={py(reference.psweet) - 34} width={175} height={48}
                  rx={4} fill="#111" stroke="#374151" />
                <text x={px(reference.mw) + 13} y={py(reference.psweet) - 21} fontSize={8} fill="#fbbf24">Sucrose (reference)</text>
                <text x={px(reference.mw) + 13} y={py(reference.psweet) - 10} fontSize={7} fill="#9ca3af">
                  P(sweet) {reference.psweet?.toFixed(3)} · MW {reference.mw} Da
                </text>
                {reference.logS != null && (
                  <text x={px(reference.mw) + 13} y={py(reference.psweet) + 1} fontSize={7} fill="#fbbf24">
                    logS {reference.logS?.toFixed(3)}
                  </text>
                )}
              </g>
            )}
          </g>
        )}

        {mwTicks.map(v => (
          <text key={v} x={px(v)} y={axisY + 11} fontSize={7} fill="#6b7280" textAnchor="middle">{v}</text>
        ))}
        {ldTicks.map(v => (
          <text key={v} x={pad.l - 4} y={py(v) + 3} fontSize={7} fill="#6b7280" textAnchor="end">{v.toFixed(1)}</text>
        ))}

        <text x={pad.l + plotW / 2} y={axisY + 23} fontSize={8} fill="#6b7280" textAnchor="middle">
          Molecular Weight (Da) — minimise →
        </text>
        <text x={10} y={pad.t + plotH / 2} fontSize={8} fill="#6b7280" textAnchor="middle"
          transform={`rotate(-90,10,${pad.t + plotH / 2})`}>
          P(sweet) — maximise →
        </text>
      </svg>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const SweetnessEnhancer = () => {
  const [animPhase, setAnimPhase] = useState("idle");
  const [poolMeta, setPoolMeta] = useState(null);
  const [modelMeta, setModelMeta] = useState(null);
  const [propRange, setPropRange] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [reference, setReference] = useState(null);
  const [currentGenIdx, setCurrentGenIdx] = useState(0);
  const [nGensTotal, setNGensTotal] = useState(0);
  const [error, setError] = useState(null);
  const [modelsReady, setModelsReady] = useState({ aqsol: false, taste: false });
  const [prevAllDots, setPrevAllDots] = useState([]);
  const [prevPareto, setPrevPareto] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [parentColorMap, setParentColorMap] = useState(new Map());
  const [smilesNames, setSmilesNames] = useState({});
  const [resultsFromCache, setResultsFromCache] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });

  const phaseTimers = useRef([]);
  const gensRef = useRef([]);
  const animQueueRef = useRef([]);
  const isAnimatingRef = useRef(false);
  const streamDoneRef = useRef(false);
  const pendingNextRef = useRef(false);
  const abortRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/molecule-finder/candidates/meta`).then(r => r.ok ? r.json() : null),
      fetch(`${BACKEND}/molecule-finder/available-datasets`).then(r => r.ok ? r.json() : []),
      fetch(`${BACKEND}/molecule-finder/saved-optimization/3obj`).then(r => r.status === 204 ? null : r.ok ? r.json() : null),
    ]).then(([meta, datasets, saved]) => {
      if (meta) setPoolMeta(meta.sweetness);
      const aqsol = datasets.find(d => d.id === "aqsoldb");
      const taste = datasets.find(d => d.id === "flavor_sensory");
      setModelsReady({ aqsol: !!aqsol?.n_cached, taste: !!taste?.n_cached });
      if (saved?.generations?.length > 0) {
        const gens = saved.generations;
        gensRef.current = gens;
        setGenerations(gens);
        setReference(saved.reference ?? null);
        setModelMeta(saved.modelMeta ?? null);
        setPropRange(saved.propRange ?? null);
        setCurrentGenIdx(gens.length - 1);
        setNGensTotal(gens.length);
        setAnimPhase("done");
        setResultsFromCache(true);
      }
    }).catch(() => { });
  }, []);

  const clearAll = () => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
  };

  const processNextGen = () => {
    if (animQueueRef.current.length === 0) {
      isAnimatingRef.current = false;
      if (streamDoneRef.current) {
        setGenerations([...gensRef.current]);
        setNGensTotal(gensRef.current.length);
        setAnimPhase("done");
      } else {
        setAnimPhase("wait_mutation");
        pendingNextRef.current = true;
      }
      return;
    }

    isAnimatingRef.current = true;
    const { genIdx, prevCands, prevFront } = animQueueRef.current.shift();

    setGenerations([...gensRef.current]);
    setCurrentGenIdx(genIdx);
    setAnimPhase(genIdx === 0 ? "pool" : "mutation");
    setPrevAllDots(prevCands);
    setPrevPareto(prevFront);
    setParentColorMap(new Map(prevCands.map(c => [c.smiles, c])));

    const t1 = setTimeout(() => {
      setAnimPhase("prediction");
      setPrevAllDots([]);

      const t2 = setTimeout(() => {
        setAnimPhase("nsga2");

        const t3 = setTimeout(processNextGen, DUR_NSGA2);
        phaseTimers.current.push(t3);
      }, DUR_PREDICTION);
      phaseTimers.current.push(t2);
    }, DUR_POOL_MUTATION);
    phaseTimers.current.push(t1);
  };

  // Y-axis (P(sweet)) always [0, 1] inside AnimatedScatter.
  const scatterBounds = useMemo(() => {
    if (!propRange) return null;
    const refMW = reference?.mw ?? 302;
    return {
      mwMin: Math.max(60, Math.min(propRange.mw_min ?? 100, refMW) - 18),
      mwMax: Math.max(propRange.mw_max ?? 500, refMW) + 30,
    };
  }, [propRange, reference]);

  const handleOptimize = async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    clearAll();
    gensRef.current = [];
    animQueueRef.current = [];
    isAnimatingRef.current = false;
    streamDoneRef.current = false;
    pendingNextRef.current = false;

    setAnimPhase("loading");
    setGenerations([]);
    setCurrentGenIdx(0);
    setNGensTotal(0);
    setError(null);
    setPropRange(null);
    setParentColorMap(new Map());

    try {
      const res = await fetch(`${BACKEND}/molecule-finder/optimize-3obj/stream`, {
        method: "POST",
        signal: abortRef.current.signal,
      });

      if (res.status === 409) {
        setError("Models not ready.");
        setAnimPhase("idle");
        setModelsReady({ aqsol: false, taste: false });
        return;
      }
      if (!res.ok) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const lines = block.split("\n");
          let eventType = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          let data;
          try { data = JSON.parse(dataStr); } catch { continue; }

          if (eventType === "meta") {
            setModelsReady({ aqsol: true, taste: true });
            setPoolMeta(data.pool_meta);
            setModelMeta(data.model_meta);
            setReference(data.reference);
            if (data.total_generations) setNGensTotal(data.total_generations);

          } else if (eventType === "generation") {
            if (data.property_range) setPropRange(data.property_range);

            const prevCands = gensRef.current.length > 0
              ? (gensRef.current[gensRef.current.length - 1].candidates ?? [])
              : [];
            const prevFront = prevCands.filter(c => !c.dominated);

            gensRef.current = [...gensRef.current, data];
            animQueueRef.current.push({ genIdx: data.gen, prevCands, prevFront });

            if (pendingNextRef.current) {
              pendingNextRef.current = false;
              processNextGen();
            } else if (!isAnimatingRef.current) {
              processNextGen();
            }

          } else if (eventType === "pareto_final") {
            const bySmiles = new Map(data.map(c => [c.smiles, c]));
            if (gensRef.current.length > 0) {
              const lastIdx = gensRef.current.length - 1;
              gensRef.current = gensRef.current.map((gen, i) => {
                if (i !== lastIdx) return gen;
                return {
                  ...gen,
                  candidates: gen.candidates.map(c => {
                    const enriched = bySmiles.get(c.smiles);
                    return enriched ? { ...c, ...enriched } : c;
                  }),
                };
              });
            }

          } else if (eventType === "done") {
            streamDoneRef.current = true;
            if (!isAnimatingRef.current && animQueueRef.current.length === 0) {
              setGenerations([...gensRef.current]);
              setNGensTotal(gensRef.current.length);
              setAnimPhase("done");
            }

          } else if (eventType === "error") {
            if (data.status === 409) {
              setError(data.detail ?? "Models not ready.");
              setAnimPhase("idle");
              setModelsReady({ aqsol: false, taste: false });
            } else {
              setError(data.detail);
              setAnimPhase("idle");
            }
            return;
          }
        }
      }

      streamDoneRef.current = true;
      if (!isAnimatingRef.current && animQueueRef.current.length === 0) {
        setGenerations([...gensRef.current]);
        setNGensTotal(gensRef.current.length);
        setAnimPhase("done");
      }

    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
      setAnimPhase("idle");
    }
  };

  const handleReplay = () => {
    if (gensRef.current.length === 0) return;
    clearAll();
    animQueueRef.current = [];
    isAnimatingRef.current = false;
    streamDoneRef.current = true;
    pendingNextRef.current = false;

    const gens = gensRef.current;
    for (let i = 0; i < gens.length; i++) {
      const prevCands = i > 0 ? (gens[i - 1].candidates ?? []) : [];
      const prevFront = prevCands.filter(c => !c.dominated);
      animQueueRef.current.push({ genIdx: i, prevCands, prevFront });
    }
    processNextGen();
  };

  const exportCsv = () => {
    const rows = [
      ["#", "Name/SMILES", "P(sweet)", "MW (Da)", "logS", "QED", "SA Score", "PAINS", "Origin"],
      ...finalPareto.map((c, i) => [
        i + 1,
        c.cid == null ? c.smiles : c.name,
        (c.psweet ?? 0).toFixed(3),
        c.mw,
        (c.logS ?? -4).toFixed(3),
        c.qed != null ? c.qed.toFixed(3) : "",
        c.sa_score != null ? c.sa_score.toFixed(2) : "",
        (c.pains?.length ?? 0) > 0 ? c.pains.join("; ") : "clean",
        c.cid == null ? "new" : "pool",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "pareto_3obj.csv"; a.click();
    URL.revokeObjectURL(url);
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

  // Persist results whenever a live run completes
  useEffect(() => {
    if (animPhase !== "done" || generations.length === 0 || resultsFromCache) return;
    fetch(`${BACKEND}/molecule-finder/save-optimization/3obj`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generations, reference, poolMeta, modelMeta, propRange }),
    }).catch(() => { });
  }, [animPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    fetch(`${BACKEND}/molecule-finder/saved-optimization/3obj`, { method: "DELETE" }).catch(() => { });
    clearAll();
    abortRef.current?.abort();
    gensRef.current = [];
    animQueueRef.current = [];
    isAnimatingRef.current = false;
    streamDoneRef.current = false;
    pendingNextRef.current = false;
    setAnimPhase("idle");
    setGenerations([]);
    setReference(null);
    setModelMeta(null);
    setPropRange(null);
    setCurrentGenIdx(0);
    setNGensTotal(0);
    setResultsFromCache(false);
    setError(null);
  };

  useEffect(() => () => {
    clearAll();
    abortRef.current?.abort();
  }, []);

  const isRunning = ["pool", "mutation", "wait_mutation", "prediction", "nsga2"].includes(animPhase);
  const isActive = isRunning || animPhase === "done";
  const bothReady = modelsReady.aqsol && modelsReady.taste;

  const activeStep =
    animPhase === "pool" ? 1
      : (animPhase === "mutation" || animPhase === "wait_mutation") ? 2
        : animPhase === "prediction" ? 3
          : (animPhase === "nsga2" || animPhase === "done") ? 4
            : 0;

  const currentGen = generations[currentGenIdx];
  const totalGens = nGensTotal || 1;
  const progress = nGensTotal > 1 && currentGenIdx > 0
    ? (currentGenIdx / (totalGens - 1)) * 100
    : 0;

  const finalPareto = animPhase === "done"
    ? [...(generations[generations.length - 1]?.candidates ?? [])]
      .filter(c => !c.dominated)
      .sort((a, b) => (b.psweet ?? 0.5) - (a.psweet ?? 0.5))
    : [];

  const s1 = activeStep === 1;
  const s2 = activeStep === 2;
  const s3 = activeStep === 3;
  const s4 = activeStep === 4 || animPhase === "done";

  const missingModels = [
    !modelsReady.aqsol && "AqSolDB Solubility",
    !modelsReady.taste && "FartDB Taste",
  ].filter(Boolean);

  const handleSort = (key) => {
    setSortConfig(prev => prev.key === key && prev.dir === 'asc' ? { key, dir: 'desc' } : { key, dir: 'asc' });
  };

  const COLUMN_DEFS = [
    { label: "#", key: null },
    { label: "Name", key: "name" },
    { label: "P(sweet) ↑", key: "psweet" },
    { label: "MW (Da) ↓", key: "mw" },
    { label: "logS ↑", key: "logS" },
    { label: "QED", key: "qed" },
    { label: "SA", key: "sa_score" },
    { label: "PAINS", key: null },
    { label: "Origin", key: "is_new" },
  ];

  const sortedPareto = useMemo(() => {
    if (!sortConfig.key) return finalPareto;
    return [...finalPareto].sort((a, b) => {
      let av = a[sortConfig.key] ?? (typeof b[sortConfig.key] === 'number' ? -Infinity : '');
      let bv = b[sortConfig.key] ?? (typeof a[sortConfig.key] === 'number' ? -Infinity : '');
      if (sortConfig.key === 'is_new') { av = a.cid == null ? 1 : 0; bv = b.cid == null ? 1 : 0; }
      if (sortConfig.key === 'name') { av = (a.cid == null ? a.smiles : a.name) ?? ''; bv = (b.cid == null ? b.smiles : b.name) ?? ''; }
      if (typeof av === 'string') return sortConfig.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortConfig.dir === 'asc' ? av - bv : bv - av;
    });
  }, [finalPareto, sortConfig]);

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
                <span className="text-amber-300 font-semibold">Sucrose</span>
                <span className="ml-1.5 text-gray-600">CAS 57-50-1 · 342.30 Da</span>
                {reference?.psweet != null && (
                  <span className="ml-1.5 text-gray-600">· P(sweet) {reference.psweet.toFixed(2)}</span>
                )}
                {reference?.logS != null && (
                  <span className="ml-1.5 text-gray-600">· logS {reference.logS?.toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3" />

            {/* Step 1 — Candidate Pool */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s1 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>1</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s1 ? "text-gray-200" : "text-gray-500"}`}>
                  Candidate Pool
                </div>
                {poolMeta ? (
                  poolMeta.status === "pending" ? (
                    <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                      <span className="text-amber-600/80 font-mono">generating pool…</span>
                      <span className="text-[9px] text-gray-600 leading-snug">
                        ~{poolMeta.target_n} sweet compounds · seeds: {poolMeta.seeds?.join(", ")}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                      <span>
                        <span className={`font-semibold transition-colors duration-500 ${s1 ? "text-gray-300" : ""}`}>
                          {poolMeta.n_after_filter ?? poolMeta.n_candidates}
                        </span> sweet compounds · PubChem
                      </span>
                      {(poolMeta.n_excluded ?? 0) > 0 && (
                        <span className="text-[9px] text-gray-600">
                          {poolMeta.n_excluded} excluded (halogens/metals)
                        </span>
                      )}
                    </div>
                  )
                ) : <span className="text-[10px] text-gray-600">Loading…</span>}
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3" />

            {/* Step 2 — NSGA-II Mutation */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s2 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>2</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s2 ? "text-gray-200" : "text-gray-500"}`}>
                  NSGA-II Mutation
                </div>
                <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                  <span>13 SMARTS reactions applied to selected parents</span>
                  <span className="text-[9px] text-gray-600">add-OH · OMe→OEt · Me→Et · CHO→CH2OH · …</span>
                  <span className="text-[9px] text-gray-600">Novel analogs · offspring MW 60–350 Da · phenolic scaffold required</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3" />

            {/* Step 3 — Property Prediction */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s3 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>3</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s3 ? "text-gray-200" : "text-gray-500"}`}>
                  Property Prediction
                </div>
                <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                  <span>P(sweet) and logS (AqSolDB): <span className={`text-[9px] leading-snug transition-colors duration-500 text-indigo-400`}>Models trained in the Property Prediction Tab</span></span>
                  <span>MW: <span className="text-gray-400">RDKit ExactMolWt</span></span>
                  {propRange && (
                    <span className="text-[9px] text-gray-600">
                      P(sweet) {propRange.psweet_min}…{propRange.psweet_max} · MW {propRange.mw_min}–{propRange.mw_max} Da
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-800/60 mb-3" />

            {/* Step 4 — NSGA-II Sort */}
            <div className="flex items-start gap-2.5 pb-3">
              <span className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold transition-all duration-500
                ${s4 ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-500"}`}>4</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-semibold mb-1 transition-colors duration-500 ${s4 ? "text-gray-200" : "text-gray-500"}`}>
                  NSGA-II Sort
                </div>
                <div className="text-[10px] text-gray-500 flex flex-col gap-0.5">
                  <span>Obj-1: P(sweet) ↑ &nbsp;·&nbsp; Obj-2: MW ↓ &nbsp;·&nbsp; Obj-3: logS ↑</span>
                  <span className="text-[9px] text-gray-600">Non-dominated rank + crowding distance · selects top 100</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-3" />
            <div className="h-px bg-gray-800/60 mb-3" />
            {isActive && (
              <div className="">
                <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                  <span>Gen {currentGenIdx} / {totalGens - 1}</span>
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
            <div className="flex-1 min-h-3" />
            <div className="h-px bg-gray-800/60 mb-3" />

            {missingModels.length > 0 && (
              <div className="mb-3 px-3 py-2.5 rounded-lg bg-amber-900/25 border border-amber-700/40 text-[11px] text-amber-300 leading-snug">
                ⚠ Train first in <strong>Property Prediction</strong>: {missingModels.join(" · ")}.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleOptimize}
                disabled={!bothReady || isRunning || animPhase === "loading"}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                  bg-violet-700/80 border border-violet-600/60 text-white hover:bg-violet-600/80
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {animPhase === "loading" ? "Loading…"
                  : isRunning ? "Optimising…"
                    : animPhase === "done" ? "▶ Run again"
                      : "▶ Run pipeline"}
              </button>
              {resultsFromCache && (
                <div className="px-3 py-1.5 rounded-lg bg-indigo-900/20 border border-indigo-800/40 text-[10px] text-indigo-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  Results loaded from previous run
                </div>
              )}
              {animPhase === "done" && (
                <button
                  onClick={handleReplay}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
                  title="Replay animation"
                >↺</button>
              )}
              {animPhase === "done" && (
                <button
                  onClick={handleClear}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-800 text-gray-600 hover:text-red-400 hover:border-red-900/60 transition-all"
                  title="Clear saved results"
                >×</button>
              )}
            </div>
          </div>

          {/* ── Right column — chart ── */}
          <div className="col-span-3 rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              {(poolMeta?.n_after_filter ?? poolMeta?.n_candidates)
                ? `${poolMeta.n_after_filter ?? poolMeta.n_candidates} sweet compounds · colour = logS from AqSolDB RF`
                : "3-objective Pareto space"}
            </div>
            <div className="flex items-center">
              <StepBar activeStep={activeStep} pulseStep={animPhase === "wait_mutation" ? 2 : null} />
              {animPhase === "done" && finalPareto.length > 0 && (
                <>
                  <div className="h-px w-6 mx-1 bg-gray-800" />
                  <button
                    onClick={() => setShowResults(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-900/40 border border-violet-700/50 text-violet-300 hover:bg-violet-800/40 transition-all whitespace-nowrap"
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-violet-600 text-white">↗</span>
                    Show results
                  </button>
                </>
              )}
            </div>

            {isActive ? (
              <>
                <AnimatedScatter
                  animPhase={animPhase}
                  generations={generations}
                  currentGenIdx={currentGenIdx}
                  reference={reference}
                  prevAllDots={prevAllDots}
                  prevPareto={prevPareto}
                  bounds={scatterBounds}
                  parentColorMap={parentColorMap}
                />

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] text-gray-600">logS (solubility):</span>
                  <svg width={90} height={10} viewBox="0 0 90 10">
                    <defs>
                      <linearGradient id="logSGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                    <rect x={0} y={2} width={90} height={6} rx={3} fill="url(#logSGrad)" opacity={0.8} />
                  </svg>
                  <span className="text-[9px] text-red-400">low (−6)</span>
                  <span className="text-[9px] text-emerald-400 ml-1">high (−1+)</span>

                  <div className="ml-3 flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 opacity-85" />New offspring
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-600 opacity-60" />Dominated
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-90" />Sucrose (ref)
                    </div>
                  </div>
                </div>
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

        {/* ── Results dialog — rendered via portal to escape stacking context ── */}
        {showResults && finalPareto.length > 0 && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-6"
            onClick={() => setShowResults(false)}>
            <div className="bg-[#111111] border border-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] uppercase tracking-widest text-gray-500">
                  Pareto-optimal candidates — Final generation
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600">
                    {sortConfig.key ? `sorted by ${sortConfig.key} ${sortConfig.dir === 'asc' ? '▲' : '▼'}` : 'click column to sort'}
                  </span>
                  <button onClick={exportCsv}
                    className="px-2.5 py-1 rounded text-[10px] border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
                    title="Export CSV">⬇ CSV</button>
                  <button onClick={() => setShowResults(false)}
                    className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#0e0e0e]">
                    <tr className="border-b border-gray-800">
                      {COLUMN_DEFS.map(({ label, key }) => (
                        <th
                          key={label}
                          onClick={key ? () => handleSort(key) : undefined}
                          className={`px-3 py-2 text-left font-medium text-[11px] select-none ${key ? 'cursor-pointer hover:text-gray-300' : ''} ${sortConfig.key === key && key ? 'text-gray-200' : 'text-gray-500'}`}
                        >
                          {label}
                          {key && sortConfig.key === key && (
                            <span className="ml-1 text-[9px]">{sortConfig.dir === 'asc' ? '▲' : '▼'}</span>
                          )}
                          {key && sortConfig.key !== key && (
                            <span className="ml-1 text-[9px] text-gray-700">⇅</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPareto.map((c, i) => {
                      const isNew = c.cid == null;
                      const logSval = c.logS ?? -4;
                      const lookup = smilesNames[c.smiles];
                      return (
                        <tr key={i} className={`border-b border-gray-800/40 ${logSval >= -1 ? "bg-emerald-900/10" : ""}`}>
                          <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                          <td className="px-3 py-2 max-w-[220px]">
                            {isNew ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[9px] text-gray-400 break-all block">{c.smiles}</span>
                                  {!lookup && (
                                    <button onClick={() => lookupSmiles(c.smiles)}
                                      className="flex-shrink-0 text-gray-500 hover:text-violet-400 transition-colors text-[13px]"
                                      title="Search in PubChem">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                      </svg>
                                    </button>
                                  )}
                                  <MolImageButton smiles={c.smiles} hoverColor="hover:text-violet-400" />
                                  {lookup?.status === "loading" && (
                                    <span className="text-[9px] text-gray-600">…</span>
                                  )}
                                </div>
                                {lookup?.status === "found" && (
                                  <div className="text-[9px] text-emerald-400 mt-0.5">{lookup.name}</div>
                                )}
                                {lookup?.status === "unknown" && (
                                  <div className="text-[9px] text-gray-600 mt-0.5">not in PubChem</div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-gray-200">{c.name}</span>
                                <MolImageButton cid={c.cid} smiles={c.smiles} hoverColor="hover:text-violet-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            <span style={{ color: (c.psweet ?? 0) > (reference?.psweet ?? 0.7) ? "#22c55e" : "#9ca3af" }}>
                              {(c.psweet ?? 0).toFixed(3)}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-400">{c.mw}</td>
                          <td className="px-3 py-2 font-mono">
                            <span style={{ color: logSColor(logSval) }}>{logSval.toFixed(3)}</span>
                            {logSval >= -1 && (
                              <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-emerald-900/30 text-emerald-400">soluble</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {c.qed != null ? (
                              <span style={{ color: c.qed >= 0.5 ? "#22c55e" : c.qed >= 0.3 ? "#f59e0b" : "#9ca3af" }}>
                                {c.qed.toFixed(3)}
                              </span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {c.sa_score != null ? (
                              <span style={{ color: c.sa_score <= 4 ? "#22c55e" : c.sa_score <= 6 ? "#f59e0b" : "#ef4444" }}>
                                {c.sa_score.toFixed(1)}
                              </span>
                            ) : <span className="text-gray-700">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {(c.pains?.length ?? 0) > 0 ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/40 text-red-400"
                                title={c.pains.join("; ")}>
                                {c.pains.length} hit{c.pains.length > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-[9px] text-emerald-600">clean</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isNew ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-400">new</span>
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
              <div className="px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600 flex-shrink-0">
                Seed pool: {poolMeta?.n_after_filter ?? poolMeta?.n_candidates ?? "—"} sweet compounds ·
                SMARTS mutation generated {Math.max(0, (generations[generations.length - 1]?.n_evaluated ?? 0) - (poolMeta?.n_after_filter ?? poolMeta?.n_candidates ?? 0))} analogs ·{" "}
                {generations[generations.length - 1]?.n_evaluated ?? 0} total evaluated.
                P(sweet): FartDB taste RF · OOB acc. {modelMeta?.oob_accuracy_taste ?? "—"}.
                logS: AqSolDB solubility RF · OOB R² {modelMeta?.oob_r2_solubility ?? "—"}.
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </div>
  );
};

export default SweetnessEnhancer;
