import { useEffect, useState } from "react";

const STAGES = [
  {
    gen: 0, pts: [
      { x: 0.17, y: 0.38, d: false }, { x: 0.35, y: 0.52, d: false },
      { x: 0.55, y: 0.66, d: false }, { x: 0.75, y: 0.78, d: false },
      { x: 0.45, y: 0.42, d: true }, { x: 0.60, y: 0.55, d: true },
      { x: 0.65, y: 0.60, d: true }, { x: 0.80, y: 0.70, d: true },
      { x: 0.40, y: 0.35, d: true }, { x: 0.25, y: 0.28, d: true },
      { x: 0.50, y: 0.48, d: true }, { x: 0.70, y: 0.30, d: true },
      { x: 0.85, y: 0.45, d: true }, { x: 0.30, y: 0.20, d: true },
      { x: 0.57, y: 0.38, d: true }, { x: 0.43, y: 0.25, d: true },
      { x: 0.73, y: 0.52, d: true }, { x: 0.87, y: 0.62, d: true },
      { x: 0.53, y: 0.28, d: true }, { x: 0.78, y: 0.40, d: true },
      { x: 0.63, y: 0.44, d: true }, { x: 0.37, y: 0.44, d: true },
      { x: 0.90, y: 0.55, d: true }, { x: 0.67, y: 0.68, d: true },
      { x: 0.33, y: 0.32, d: true }, { x: 0.83, y: 0.33, d: true },
    ]
  },
  {
    gen: 15, pts: [
      { x: 0.11, y: 0.47, d: false }, { x: 0.26, y: 0.60, d: false },
      { x: 0.45, y: 0.73, d: false }, { x: 0.63, y: 0.83, d: false },
      { x: 0.37, y: 0.52, d: true }, { x: 0.55, y: 0.65, d: true },
      { x: 0.70, y: 0.74, d: true }, { x: 0.51, y: 0.60, d: true },
      { x: 0.31, y: 0.44, d: true }, { x: 0.75, y: 0.77, d: true },
      { x: 0.20, y: 0.38, d: true }, { x: 0.65, y: 0.50, d: true },
      { x: 0.83, y: 0.68, d: true }, { x: 0.40, y: 0.30, d: true },
      { x: 0.58, y: 0.42, d: true }, { x: 0.47, y: 0.35, d: true },
      { x: 0.77, y: 0.58, d: true }, { x: 0.89, y: 0.72, d: true },
      { x: 0.62, y: 0.55, d: true }, { x: 0.72, y: 0.63, d: true },
      { x: 0.35, y: 0.38, d: true }, { x: 0.85, y: 0.46, d: true },
      { x: 0.53, y: 0.48, d: true }, { x: 0.67, y: 0.40, d: true },
      { x: 0.80, y: 0.82, d: true }, { x: 0.43, y: 0.42, d: true },
    ]
  },
  {
    gen: 30, pts: [
      { x: 0.06, y: 0.56, d: false }, { x: 0.19, y: 0.68, d: false },
      { x: 0.35, y: 0.79, d: false }, { x: 0.51, y: 0.88, d: false },
      { x: 0.68, y: 0.93, d: false },
      { x: 0.29, y: 0.62, d: true }, { x: 0.45, y: 0.73, d: true },
      { x: 0.60, y: 0.82, d: true }, { x: 0.15, y: 0.48, d: true },
      { x: 0.75, y: 0.88, d: true }, { x: 0.40, y: 0.70, d: true },
      { x: 0.55, y: 0.55, d: true }, { x: 0.70, y: 0.65, d: true },
      { x: 0.83, y: 0.78, d: true }, { x: 0.25, y: 0.52, d: true },
      { x: 0.65, y: 0.72, d: true }, { x: 0.50, y: 0.60, d: true },
      { x: 0.37, y: 0.56, d: true }, { x: 0.80, y: 0.70, d: true },
      { x: 0.57, y: 0.68, d: true }, { x: 0.73, y: 0.80, d: true },
      { x: 0.88, y: 0.85, d: true }, { x: 0.33, y: 0.45, d: true },
      { x: 0.63, y: 0.60, d: true }, { x: 0.47, y: 0.50, d: true },
    ]
  },
  {
    gen: 50, pts: [
      { x: 0.02, y: 0.63, d: false }, { x: 0.12, y: 0.74, d: false },
      { x: 0.25, y: 0.83, d: false }, { x: 0.40, y: 0.90, d: false },
      { x: 0.57, y: 0.95, d: false },
      { x: 0.19, y: 0.68, d: true }, { x: 0.33, y: 0.78, d: true },
      { x: 0.50, y: 0.87, d: true }, { x: 0.08, y: 0.55, d: true },
      { x: 0.65, y: 0.90, d: true }, { x: 0.43, y: 0.83, d: true },
      { x: 0.29, y: 0.75, d: true }, { x: 0.53, y: 0.72, d: true },
      { x: 0.75, y: 0.85, d: true }, { x: 0.60, y: 0.80, d: true },
      { x: 0.37, y: 0.65, d: true }, { x: 0.70, y: 0.76, d: true },
      { x: 0.85, y: 0.88, d: true }, { x: 0.47, y: 0.70, d: true },
      { x: 0.15, y: 0.60, d: true }, { x: 0.63, y: 0.84, d: true },
      { x: 0.78, y: 0.92, d: true }, { x: 0.39, y: 0.72, d: true },
      { x: 0.55, y: 0.62, d: true }, { x: 0.73, y: 0.70, d: true },
    ]
  },
  {
    gen: 70, pts: [
      { x: 0.03, y: 0.69, d: false }, { x: 0.09, y: 0.79, d: false },
      { x: 0.17, y: 0.87, d: false }, { x: 0.30, y: 0.93, d: false },
      { x: 0.45, y: 0.96, d: false }, { x: 0.62, y: 0.98, d: false },
      { x: 0.14, y: 0.73, d: true }, { x: 0.25, y: 0.83, d: true },
      { x: 0.39, y: 0.90, d: true }, { x: 0.05, y: 0.62, d: true },
      { x: 0.53, y: 0.93, d: true }, { x: 0.23, y: 0.79, d: true },
      { x: 0.37, y: 0.87, d: true }, { x: 0.50, y: 0.78, d: true },
      { x: 0.67, y: 0.91, d: true }, { x: 0.58, y: 0.85, d: true },
      { x: 0.33, y: 0.72, d: true }, { x: 0.75, y: 0.88, d: true },
      { x: 0.43, y: 0.82, d: true }, { x: 0.12, y: 0.65, d: true },
      { x: 0.65, y: 0.80, d: true }, 
      { x: 0.20, y: 0.70, d: true }, { x: 0.55, y: 0.72, d: true },
      { x: 0.71, y: 0.84, d: true },
    ]
  },
];

const STEPS = [
  {
    n: 1, color: "#f43f5e",
    title: "Generate candidates",
    desc: "Draw an initial population from a curated library of real, known compounds — each encoded as a fingerprint.",
    details: [
      "Targeted design: the candidate pool is pre-filtered to be relevant to the problem at hand, e.g. drug-like molecules with a certain scaffold.",
      "Independent from training: the library is distinct from the model's training set, so predictions are genuinely blind.",
    ],
  },
  {
    n: 2, color: "#ec4899",
    title: "Predict properties",
    desc: "The trained model scores each candidate on every objective in under 2 ms, enabling rapid evaluation of large candidate pools.",
    badge: "uses trained models",
  },
  {
    n: 3, color: "#a855f7",
    title: "Find the Pareto front",
    desc: "Any candidate beaten on every objective simultaneously by another is discarded. The survivors form the Pareto front — the set of pareto-optimal solutions.",
    details: [
      "Analogy: choosing a car — you want fast, efficient, and cheap. No car wins on all three. The Pareto front is the set where improving one spec always requires sacrificing another.",
    ],
  },
  {
    n: 4, color: "#7c3aed",
    title: "Evolve and repeat",
    desc: "Survivors are recombined and mutated to breed the next generation: new individuals can be generated deterministically, by substituting atoms or functional groups, or via GenAI models based on similarity. Then, the algorithm goes back to step 2, until the front stops improving.",
  },
];

const AlgoStep = ({ step }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-800 bg-[#111111]">
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
      style={{ background: step.color + "25", color: step.color }}
    >
      {step.n}
    </div>
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-xs font-semibold text-gray-200">{step.title}</div>
        {step.badge && (
          <span
            className="text-[11px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: step.color + "22", color: step.color }}
          >
            {step.badge}
          </span>
        )}
      </div>
      <p className="text-[12px] text-gray-400 leading-snug mt-0.5">{step.desc}</p>
      {step.details && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {step.details.map((d, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] text-gray-500 leading-snug">
              <span className="flex-shrink-0 mt-px" style={{ color: step.color + "99" }}>›</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

const ParetoChart = ({ stage }) => {
  const W = 340, H = 200;
  const pad = { l: 38, r: 18, t: 20, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const px = (x) => pad.l + x * plotW;
  const py = (y) => pad.t + (1 - y) * plotH;

  const front = stage.pts.filter(p => !p.d).sort((a, b) => a.x - b.x);
  const frontPath = front.length > 1
    ? front.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ")
    : "";

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {[0.25, 0.5, 0.75].map(v => (
        <g key={v}>
          <line x1={px(v)} y1={pad.t} x2={px(v)} y2={pad.t + plotH} stroke="#1f2937" strokeWidth={0.5} />
          <line x1={pad.l} y1={py(v)} x2={pad.l + plotW} y2={py(v)} stroke="#1f2937" strokeWidth={0.5} />
        </g>
      ))}

      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + plotH} stroke="#374151" strokeWidth={1} />
      <line x1={pad.l} y1={pad.t + plotH} x2={pad.l + plotW} y2={pad.t + plotH} stroke="#374151" strokeWidth={1} />

      <rect x={pad.l} y={pad.t} width={plotW * 0.14} height={plotH * 0.20}
        fill="#a855f7" opacity={0.08} rx={3} />
      <text x={pad.l + 5} y={pad.t + 13} fontSize={7} fill="#a855f7" opacity={0.5}>ideal</text>

      {frontPath && (
        <path d={frontPath} fill="none" stroke="#f43f5e" strokeWidth={1.5}
          strokeDasharray="5 3" opacity={0.15} />
      )}

      {stage.pts.map((p, i) => (
        <g key={i} style={{
          transform: `translate(${px(p.x).toFixed(1)}px, ${py(p.y).toFixed(1)}px)`,
          transition: "transform 0.65s ease, opacity 0.4s ease",
        }}>
          <circle
            r={p.d ? 3.5 : 5.5}
            fill={p.d ? "#374151" : "#f43f5e"}
            opacity={p.d ? 0.5 : 0.88}
          />
        </g>
      ))}

      {[0, 0.5, 1].map(v => (
        <g key={v}>
          <text x={px(v)} y={pad.t + plotH + 13} fontSize={7.5} fill="#6b7280" textAnchor="middle">
            {v.toFixed(1)}
          </text>
          <text x={pad.l - 5} y={py(v) + 3} fontSize={7.5} fill="#6b7280" textAnchor="end">
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      <text x={pad.l + plotW / 2} y={H - 2} fontSize={8} fill="#4b5563" textAnchor="middle">
        Property # 1 ← minimize
      </text>
      <text x={10} y={pad.t + plotH / 2} fontSize={8} fill="#4b5563" textAnchor="middle"
        transform={`rotate(-90,10,${pad.t + plotH / 2})`}>
        Property # 2  →  maximize
      </text>

      <text x={W - pad.r} y={pad.t + 12} fontSize={9} fill="#6b7280"
        textAnchor="end" fontFamily="monospace">
        gen {stage.gen} / 70
      </text>

      <circle cx={W - pad.r - 1} cy={pad.t + 24} r={3.5} fill="#f43f5e" opacity={0.88} />
      <text x={W - pad.r - 7} y={pad.t + 27.5} fontSize={7} fill="#6b7280" textAnchor="end">Pareto-optimal</text>

      <circle cx={W - pad.r - 1} cy={pad.t + 36} r={2.5} fill="#374151" opacity={0.5} />
      <text x={W - pad.r - 7} y={pad.t + 39.5} fontSize={7} fill="#6b7280" textAnchor="end">Dominated</text>
    </svg>
  );
};

const MultiObjectiveOptimizer = () => {
  const [stageIdx, setStageIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // Nuovo stato
  const [done, setDone] = useState(false);

  const handleRun = () => {
    setStageIdx(0);
    setRunning(true);
    setIsPaused(false); // Reset pausa
    setDone(false);
  };

  useEffect(() => {
    if (!running || isPaused) return; // Se in pausa, non far partire il timeout

    if (stageIdx >= STAGES.length - 1) {
      setRunning(false);
      setDone(true);
      return;
    }

    const t = setTimeout(() => setStageIdx(i => i + 1), 1400);
    return () => clearTimeout(t);
  }, [running, stageIdx, isPaused]); // Aggiungi isPaused alle dipendenze

  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-20"
      style={{ paddingTop: 200, paddingBottom: 100 }}
    >
      <div className="max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-7 gap-6 items-stretch">

          <div className="col-span-3 flex flex-col gap-3 h-full">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              NSGA-II — how the algorithm works
            </div>
            {STEPS.map(step => <AlgoStep key={step.n} step={step} />)}
          </div>

          <div className="col-span-4 flex flex-col gap-3 h-full">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              Evolving the Pareto front — watch the algorithm in action
            </div>
            <div className="flex-1 rounded-lg border border-gray-800 bg-[#111111] p-4 flex flex-col gap-3">

              <ParetoChart stage={STAGES[stageIdx]} />

              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-[11px] text-gray-500 leading-snug">
                    Each dot is a candidate molecule positioned by its properties. Properties could be anything we want to optimize and could be more than two.
                    {" "}<span className="text-rose-400 font-medium">Red dots</span> are Pareto-optimal — no other candidate beats them on <em>both</em> axes at once.
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    {running && (
                      <button
                        onClick={() => setIsPaused(!isPaused)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        {isPaused ? "▶ Play" : "⏸ Pause"}
                      </button>
                    )}
                    <button
                      onClick={handleRun}
                      disabled={running && !isPaused}
                      className="px-8 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40"
                      style={{ background: "#f43f5e18", borderColor: "#f43f5e55", color: "#f43f5e" }}
                    >
                      {running ? "Running" : done ? "↺ Replay" : "▶ Animate"}
                    </button>
                  </div>
                </div>
                <p className="text-[12px] text-gray-300 leading-snug">
                  Only a small, already-promising subset moves forward to validation and lab experiments — cutting synthesis costs and time-to-hit by orders of magnitude.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MultiObjectiveOptimizer;
