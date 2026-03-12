import { useState, useEffect, useRef, useCallback } from "react";

const BACKEND = "http://localhost:8000";

// Module-level cache — survives unmount/remount cycles.
// When training completes while the component is unmounted, React silently
// drops the state update; writing directly to this cache ensures the next
// mount picks up the results without waiting for a new /saved-models fetch.
const _persistedResults  = {};
const _persistedStatuses = {};

// ── Learning curve (animated) ───────────────────────────────────────────────
const OobCurvePanel = ({ data, targetLabel, taskType = "regression", modelName = "Random Forest" }) => {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setProgress(0); setDone(false);
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      setProgress(frame / 70);
      if (frame >= 70) { clearInterval(id); setDone(true); }
    }, 18);
    return () => clearInterval(id);
  }, [data]);

  const W = 280, H = 130;
  const maxTrees = 500;
  const allScores = data.map(p => p.oob_score);
  const yMin = Math.max(0, Math.min(...allScores) - 0.05);
  const yMax = Math.min(1, Math.max(...allScores) + 0.05);
  const px = (t) => 28 + (t / maxTrees) * (W - 40);
  const py = (v) => H - 20 - ((v - yMin) / (yMax - yMin)) * (H - 34);
  const visiblePts = data.filter(p => (p.trees / maxTrees) <= progress);
  const pathD = visiblePts.length < 2
    ? ""
    : visiblePts.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.trees).toFixed(1)},${py(p.oob_score).toFixed(1)}`).join(" ");
  const finalScore = data[data.length - 1]?.oob_score;
  const convergePt = data.find((p, i) => i > 0 && (p.oob_score - data[i - 1].oob_score) < 0.005);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map(v => Math.round(v * 100) / 100);
  const isClf = taskType === "classification";
  const scoreLabel = isClf ? "Accuracy" : "R²";

  return (
    <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-2 h-full">
      <div className="flex flex-col gap-0.5">
        <div className="text-[11px] uppercase tracking-widest text-gray-500">Learning Curve</div>
        <div className="text-[9px] text-gray-600 leading-snug">
          {isClf ? "Accuracy" : "Prediction"} on held-out data · target:{" "}
          <span className="text-gray-500">{targetLabel}</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible flex-1">
        {yTicks.map(v => (
          <line key={v} x1={28} y1={py(v)} x2={W - 12} y2={py(v)} stroke="#1f2937" strokeWidth={1} />
        ))}
        <line x1={28} y1={14} x2={28} y2={H - 20} stroke="#374151" strokeWidth={1} />
        <line x1={28} y1={H - 20} x2={W - 12} y2={H - 20} stroke="#374151" strokeWidth={1} />
        {yTicks.map(v => (
          <text key={v} x={4} y={py(v) + 3} fontSize={7.5} fill="#6b7280">{v.toFixed(2)}</text>
        ))}
        {[0, 250, 500].map(t => (
          <text key={t} x={px(t) - 5} y={H - 5} fontSize={7.5} fill="#6b7280">{t}</text>
        ))}
        <text x={W / 2} y={H + 2} textAnchor="middle" fontSize={7.5} fill="#4b5563">n trees</text>
        {pathD && (
          <path d={pathD} fill="none" stroke="#a855f7" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {done && convergePt && (
          <>
            <line x1={px(convergePt.trees)} y1={14} x2={px(convergePt.trees)} y2={H - 20}
              stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
            <text x={px(convergePt.trees) + 3} y={26} fontSize={7} fill="#f43f5e" opacity={0.8}>
              plateau ≈ {convergePt.trees}
            </text>
          </>
        )}
      </svg>
      <div className="flex gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded text-[9px] bg-purple-900/30 text-purple-300">
          Final {scoreLabel} {finalScore?.toFixed(3)}
        </span>
        {convergePt && (
          <span className="px-2 py-0.5 rounded text-[9px] bg-rose-900/30 text-rose-300">
            Plateau ~{convergePt.trees}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 leading-snug border-t border-gray-800/50 pt-2">
        {modelName === "LightGBM"
          ? <>Each point shows validation {scoreLabel} on the held-out scaffold-split test set
              as more boosting iterations are added — computed without retraining via
              <span className="text-gray-400"> LightGBM num_iteration</span>.</>
          : <>Each point shows how well the model predicts on molecules it never trained on — as
              more decision trees are added, the estimate stabilises. This is called an
              <span className="text-gray-400"> OOB (Out-of-Bag) learning curve</span>: trees
              vote only on samples not used to build them, giving a free validation signal
              without a separate test set.</>
        }
      </p>
    </div>
  );
};

// ── Feature importance bars ─────────────────────────────────────────────────
const FeatureBar = ({ name, importance, maxImp, color, delay }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((importance / maxImp) * 100), delay);
    return () => clearTimeout(t);
  }, [importance, maxImp, delay]);

  const displayName = name.startsWith("ECFP4 bit ")
    ? `ECFP4[${name.slice(10)}]`
    : name;

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <div className="text-[9px] text-gray-300 w-20 flex-shrink-0 truncate font-mono">{displayName}</div>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${width}%`, background: color, transitionDelay: `${delay}ms` }} />
      </div>
      <div className="text-[9px] font-mono text-gray-400 w-8 text-right flex-shrink-0">
        {(importance * 100).toFixed(1)}%
      </div>
    </div>
  );
};

const FEAT_COLORS = [
  "#f43f5e","#ec4899","#a855f7","#7c3aed","#6366f1",
  "#8b5cf6","#d946ef","#e879f9","#c084fc","#a3a3a3",
];

const FeatureImportancePanel = ({ features, modelName }) => {
  const maxImp = features[0]?.importance ?? 1;
  const isLGBM = modelName?.toLowerCase().includes("lightgbm") || modelName?.toLowerCase().includes("lgbm");
  const footerText = isLGBM
    ? "This graph shows basically how important is a feature to determine the prediction about the property. Normalized split-count importance across all LightGBM trees."
    : "This graph shows basically how important is a feature to determine the prediction about the property. Mean decrease in impurity (MDI) across all trees.";
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-1 h-full">
      <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">
        Top-10 Features
      </div>
      {features.map((f, i) => (
        <FeatureBar key={f.name} {...f} maxImp={maxImp} color={FEAT_COLORS[i]} delay={i * 80} />
      ))}
      <p className="text-[11px] text-gray-500 mt-2 leading-snug">
        {footerText}
      </p>
    </div>
  );
};

// ── Metrics 2×2 ─────────────────────────────────────────────────────────────
const MetricsGrid = ({ metrics, n_train, n_test, n_valid, targetLabel, taskType = "regression" }) => {
  const cards = taskType === "classification"
    ? [
        { label: "Accuracy",    value: metrics.accuracy?.toFixed(3)    ?? "—", sub: "test set",              color: "#f59e0b" },
        { label: "F1",          value: metrics.f1?.toFixed(3)          ?? "—", sub: "binary sweet/bitter",   color: "#a855f7" },
        { label: "AUC-ROC",     value: metrics.auc?.toFixed(3)         ?? "—", sub: "test set",              color: "#6366f1" },
        { label: "CV Acc.",     value: metrics.oob_accuracy?.toFixed(3)?? "—", sub: "5-fold CV",              color: "#ec4899" },
      ]
    : [
        { label: "R²",          value: metrics.r2?.toFixed(3)          ?? "—", sub: "test set",              color: "#f43f5e" },
        { label: "MAE",         value: metrics.mae?.toFixed(3)         ?? "—", sub: targetLabel,             color: "#a855f7" },
        { label: "RMSE",        value: metrics.rmse?.toFixed(3)        ?? "—", sub: "test set",              color: "#6366f1" },
        { label: "CV R²",       value: metrics.oob_r2?.toFixed(3)      ?? "—", sub: "5-fold CV",              color: "#ec4899" },
      ];
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-3 h-full">
      <div className="text-[11px] uppercase tracking-widest text-gray-500">Metrics</div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {cards.map(({ label, value, sub, color }) => (
          <div key={label}
            className="rounded-lg bg-[#0e0e0e] p-3 flex flex-col items-center justify-center text-center">
            <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
            <div className="text-[9px] text-gray-700">{sub}</div>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-gray-500 font-mono leading-snug">
        {n_valid?.toLocaleString()} mol · {n_train?.toLocaleString()} train / {n_test?.toLocaleString()} test
      </div>
    </div>
  );
};

// ── Placeholder panel ───────────────────────────────────────────────────────
const Placeholder = ({ label, loading, queued }) => (
  <div className="rounded-xl border border-gray-800/50 bg-[#0a0a0a] p-4 flex flex-col items-center justify-center gap-2 h-full min-h-[220px]">
    {loading
      ? <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-gray-600 animate-spin" />
      : queued
      ? <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center text-[8px] text-gray-600">⏳</div>
      : <div className="w-5 h-5 rounded-full border border-gray-800" />
    }
    <span className="text-[10px] text-gray-700 text-center">{label}</span>
  </div>
);

// ── Main ────────────────────────────────────────────────────────────────────
const PropertyPrediction = () => {
  const [datasets, setDatasets]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [allResults, setAllResults] = useState(() => ({ ..._persistedResults }));
  // Per-dataset: "idle" | "queued" | "loading" | "done" | "error"
  const [statuses, setStatuses]     = useState(() => ({ ..._persistedStatuses }));
  const [elapseds, setElapseds]     = useState({});
  const [errors, setErrors]         = useState({});

  // Queue: array of dataset IDs waiting to be trained
  const queueRef    = useRef([]);
  const runningRef  = useRef(false);
  const timerRef    = useRef(null);

  useEffect(() => {
    // Load available datasets and any previously-saved models in parallel
    Promise.all([
      fetch(`${BACKEND}/molecule-finder/available-datasets`).then(r => r.json()),
      fetch(`${BACKEND}/molecule-finder/saved-models`).then(r => r.json()).catch(() => ({ models: {} })),
    ])
      .then(([datasetsData, savedData]) => {
        setDatasets(datasetsData);
        if (datasetsData.length > 0) setSelectedId(datasetsData[0].id);
        const saved = savedData.models ?? {};
        if (Object.keys(saved).length > 0) {
          Object.assign(_persistedResults, saved);
          for (const id of Object.keys(saved)) _persistedStatuses[id] = "done";
          setAllResults(prev => ({ ...prev, ...saved }));
          setStatuses(prev => {
            const next = { ...prev };
            for (const id of Object.keys(saved)) next[id] = "done";
            return next;
          });
        }
      })
      .catch(() => setErrors({ _global: "Backend unavailable — start uvicorn to enable live training." }));
  }, []);

  const handleClearModels = useCallback(async () => {
    await fetch(`${BACKEND}/molecule-finder/saved-models`, { method: "DELETE" }).catch(() => {});
    Object.keys(_persistedResults).forEach(k => delete _persistedResults[k]);
    Object.keys(_persistedStatuses).forEach(k => delete _persistedStatuses[k]);
    setAllResults({});
    setStatuses({});
    setElapseds({});
    setErrors({});
    queueRef.current = [];
    runningRef.current = false;
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // Run training for a single dataset ID
  const runTrain = useCallback(async (id) => {
    runningRef.current = true;
    setStatuses(prev => ({ ...prev, [id]: "loading" }));
    setElapseds(prev => ({ ...prev, [id]: 0 }));
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setElapseds(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 })),
      1000,
    );

    try {
      const res = await fetch(`${BACKEND}/molecule-finder/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Write to module cache first — persists even if component unmounts before
      // the state update is processed (React 18 drops setState on unmounted components).
      _persistedResults[id]  = data;
      _persistedStatuses[id] = "done";
      setAllResults(prev => ({ ...prev, [id]: data }));
      setStatuses(prev => ({ ...prev, [id]: "done" }));
    } catch (e) {
      setErrors(prev => ({ ...prev, [id]: e.message }));
      setStatuses(prev => ({ ...prev, [id]: "error" }));
    } finally {
      clearInterval(timerRef.current);
      runningRef.current = false;
      // Process next in queue
      const next = queueRef.current.shift();
      if (next) runTrain(next);
    }
  }, []);

  const handleTrain = (id) => {
    if (statuses[id] === "loading" || statuses[id] === "queued") return;
    if (runningRef.current) {
      // Another dataset is already training — add to queue
      if (!queueRef.current.includes(id)) {
        queueRef.current.push(id);
        setStatuses(prev => ({ ...prev, [id]: "queued" }));
      }
    } else {
      runTrain(id);
    }
  };

  const selected     = datasets.find(d => d.id === selectedId);
  const results      = allResults[selectedId] ?? null;
  const currentStatus = statuses[selectedId] ?? "idle";
  const isLoading    = currentStatus === "loading";
  const isQueued     = currentStatus === "queued";
  const isDone       = currentStatus === "done" && !!results;
  const elapsed      = elapseds[selectedId] ?? 0;
  const currentError = errors[selectedId];
  const globalError  = errors._global;
  const trainedMolCount = results?.n_valid ?? null;

  // How many datasets are queued or running (for queue badge)
  const activeCount = Object.values(statuses).filter(s => s === "loading" || s === "queued").length;

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar">
        <div
          className="min-h-full flex flex-col justify-center px-20"
          style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}
        >
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-4">

        {globalError && (
          <div className="px-4 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs">
            {globalError}
          </div>
        )}

        {/* ── Top row: dataset selector buttons ── */}
        <div className="flex items-center gap-1 flex-wrap">
          {datasets.map(d => {
            const active  = d.id === selectedId;
            const st      = statuses[d.id] ?? "idle";
            const trained = st === "done";
            const loading = st === "loading";
            const queued  = st === "queued";
            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg border text-xs font-semibold transition-all"
                style={active
                  ? { borderColor: d.color + "60", background: d.color + "12", color: d.color }
                  : { borderColor: "#1f2937", background: "#0a0a0a", color: "#6b7280" }
                }
              >
                <span
                  className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                  style={active
                    ? { background: d.color + "25", color: d.color }
                    : { background: "#1f2937", color: "#4b5563" }
                  }
                >
                  {d.tag}
                </span>
                {d.name}
                {loading && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                      style={{ borderColor: d.color + "80", borderTopColor: "transparent" }} />
                  </span>
                )}
                {queued && (
                  <span className="text-[9px] text-gray-600 border border-gray-800 rounded px-1">queue</span>
                )}
                {trained && !loading && !queued && (
                  <span className="text-emerald-500 text-[10px]">✓</span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-3">
            {activeCount > 0 && (
              <span className="text-[9px] text-gray-600 font-mono">
                {activeCount === 1
                  ? "1 training…"
                  : `${activeCount} in queue / training…`}
              </span>
            )}
            {Object.values(statuses).some(s => s === "done") && (
              <button
                onClick={handleClearModels}
                className="px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all hover:opacity-75 active:opacity-50"
                style={{ borderColor: "#374151", background: "#0a0a0a", color: "#6b7280" }}
              >
                Clear Models
              </button>
            )}
          </div>
        </div>

        {/* ── Main 4-column grid ── */}
        <div className="grid grid-cols-4 gap-3 items-stretch">

          {/* Col 1 — Train Model */}
          <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-widest text-gray-500">Train model</div>
              {isDone && !isLoading && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-800/50 bg-emerald-900/20 text-emerald-500 font-mono">
                  saved
                </span>
              )}
            </div>

            {currentError && (
              <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/40 text-red-400 text-[10px] leading-snug">
                {currentError}
              </div>
            )}

            {selected && !isLoading && (
              <>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                      style={{ background: selected.color + "20", color: selected.color }}
                    >
                      {selected.tag}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-gray-200">{selected.name}</div>
                  <p className="text-[12px] text-gray-500 leading-snug">{selected.description}</p>
                </div>

                <div className="flex flex-col gap-1 text-[9px] text-gray-700 font-mono border-t border-gray-800/60 pt-3">
                  <span><span className="text-gray-500">{trainedMolCount != null ? trainedMolCount.toLocaleString() : "—"}</span> molecules</span>
                  <span>target: <span className="text-gray-500">{selected.target_label}</span></span>
                  <span>task: <span className="text-gray-500">{selected.task_type}</span></span>
                  <span>model: <span className="text-gray-500">{selected.model_name ?? "Random Forest"}</span></span>
                </div>

                <button
                  onClick={() => handleTrain(selectedId)}
                  disabled={isQueued}
                  className="w-full py-2 rounded-lg text-xs font-semibold border transition-all mt-auto cursor-pointer hover:opacity-75 active:opacity-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: selected.color + "18", borderColor: selected.color + "55", color: selected.color }}
                >
                  {isQueued
                    ? "⏳  Queued"
                    : results
                    ? "↺  Re-train"
                    : "▶  Train Model"}
                </button>
              </>
            )}

            {isLoading && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: (selected?.color ?? "#a855f7") + "70", borderTopColor: "transparent" }} />
                <div className="text-[11px] text-gray-400 text-center">
                  Training{trainedMolCount != null ? <>{" "}on{" "}<span className="font-mono" style={{ color: selected?.color }}>{trainedMolCount.toLocaleString()}</span>{" "}molecules</> : null}…
                </div>
                <div className="text-[9px] text-gray-600 text-center">
                  {selected?.model_name ?? "Random Forest"} on ECFP4 + descriptors
                </div>
                <div className="text-[10px] font-mono text-gray-500">{elapsed}s</div>
                {queueRef.current.length > 0 && (
                  <div className="text-[9px] text-gray-700 text-center">
                    {queueRef.current.length} more queued
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Col 2 — OOB curve */}
          {isDone
            ? <OobCurvePanel
                data={results.oob_curve}
                targetLabel={results.target_label}
                taskType={results.task_type}
                modelName={results.model_name}
              />
            : <Placeholder label="Learning curve" loading={isLoading} queued={isQueued} />
          }

          {/* Col 3 — Feature importances */}
          {isDone
            ? <FeatureImportancePanel features={results.feature_importances} modelName={results.model_name} />
            : <Placeholder label="Top-10 feature importances" loading={isLoading} queued={isQueued} />
          }

          {/* Col 4 — Metrics 2×2 */}
          {isDone
            ? <MetricsGrid
                metrics={results.metrics}
                n_train={results.n_train}
                n_test={results.n_test}
                n_valid={results.n_valid}
                targetLabel={results.target_label}
                taskType={results.task_type}
              />
            : <Placeholder label="Metrics" loading={isLoading} queued={isQueued} />
          }

        </div>

      </div>
      </div>
    </div>
  );
};

export default PropertyPrediction;
