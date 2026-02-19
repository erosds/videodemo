import React, { useState, useEffect, useCallback, useRef } from "react";

const API_URL = "http://localhost:8000";

const FeatureImportanceView = ({ dataset, trainedModels, trainingResults = {} }) => {
  const [selectedModel, setSelectedModel] = useState("");
  const [featureImportances, setFeatureImportances] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const successfulModels = trainedModels.filter(
    (m) => trainingResults[m]?.status !== "error"
  );

  useEffect(() => {
    if (successfulModels.length > 0 && !selectedModel) {
      setSelectedModel(successfulModels[0]);
    }
  }, [successfulModels.length, selectedModel]);

  const fetchFeatureImportance = useCallback(async () => {
    // Cancella eventuale fetch precedente ancora in volo
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setFeatureImportances(null);
    try {
      const response = await fetch(`${API_URL}/feature-importance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, model_name: selectedModel }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${response.status}`);
      }

      const data = await response.json();
      setFeatureImportances(data.feature_importances);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Request failed");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedModel, dataset]);

  useEffect(() => {
    if (selectedModel && dataset) {
      fetchFeatureImportance();
    }
  }, [fetchFeatureImportance]);

  if (trainedModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-center">
          Please train at least one model first
        </div>
      </div>
    );
  }

  // Massimo valore per scalare le barre
  const maxImportance =
    featureImportances && featureImportances.length > 0
      ? featureImportances[0].importance
      : 1;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 pt-32">
      {/* Training Summary */}
      {Object.keys(trainingResults).length > 0 && (
        <div className="w-full max-w-4xl bg-[#1a1a1a] rounded p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Training Summary</h4>
          <div className="grid grid-cols-4 gap-2">
            {trainedModels.map((model) => {
              const result = trainingResults[model];
              const isError = result?.status === "error";
              const isActive = selectedModel === model;
              const isSelectable = !isError;
              return (
                <div
                  key={model}
                  onClick={() => isSelectable && setSelectedModel(model)}
                  className={`flex flex-col gap-1 px-3 py-2 rounded transition-all duration-150 ${
                    isError
                      ? 'bg-[#0a0a0a] opacity-60 cursor-default'
                      : isActive
                        ? 'bg-cyan-600/15 ring-1 ring-cyan-500/50 cursor-pointer'
                        : 'bg-[#0a0a0a] hover:bg-[#111] cursor-pointer'
                  }`}
                >
                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-cyan-400' : 'text-white'}`}>{model}</span>
                  {isError ? (
                    <span className="text-xs text-red-400 font-semibold">Failed</span>
                  ) : result?.metrics ? (
                    <div className="flex gap-3">
                      <div>
                        <span className="text-xs text-gray-500">Acc </span>
                        <span className="text-xs font-bold text-purple-400">
                          {(result.metrics.accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Overfit </span>
                        <span className={`text-xs font-bold ${
                          result.metrics.overfit_gap > 0.1 ? 'text-red-400'
                          : result.metrics.overfit_gap > 0.05 ? 'text-amber-400'
                          : 'text-emerald-400'
                        }`}>
                          {(result.metrics.overfit_gap * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">-</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature Importance card */}
      <div className="w-full max-w-4xl bg-[#1a1a1a] rounded p-8 flex flex-col" style={{ maxHeight: '400px' }}>
        {loading && (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-16 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && featureImportances && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="flex flex-col gap-3">
              {featureImportances.map((item, idx) => {
                const pct = maxImportance > 0 ? (item.importance / maxImportance) * 100 : 0;
                const importancePct = (item.importance * 100).toFixed(1);

                return (
                  <div key={item.feature} className="flex items-center gap-4">
                    {/* Feature name */}
                    <div className="w-40 shrink-0 text-right">
                      <span className="text-sm text-gray-300 font-mono truncate block">
                        {item.feature}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-7 bg-[#0a0a0a] rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, #06b6d4 0%, #8b5cf6 ${Math.max(pct, 30)}%, #ec4899 100%)`,
                          opacity: 1 - idx * 0.03,
                        }}
                      />
                    </div>

                    {/* Percentage value */}
                    <div className="w-16 shrink-0 text-right">
                      <span className="text-sm font-semibold text-white font-mono">
                        {importancePct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeatureImportanceView;
