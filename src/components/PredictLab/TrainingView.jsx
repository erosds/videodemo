import React, { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:8000";

const TrainingView = ({ dataset, selectedModels, selectedFeatures, onTrainingComplete }) => {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState({});
  const [completedModels, setCompletedModels] = useState([]);
  const [trainingStarted, setTrainingStarted] = useState(false);
  const [selectedModelForDetails, setSelectedModelForDetails] = useState(null);
  const [modelPredictions, setModelPredictions] = useState({});
  const wsRef = useRef(null);
  const tableRef = useRef(null);
  const trainingProgressRef = useRef({});
  const [tableHeight, setTableHeight] = useState(null);

  const canTrain = dataset && selectedModels.length > 0 && !isTraining && !trainingStarted;

  const startTraining = () => {
    if (!canTrain) return;

    setIsTraining(true);
    setTrainingStarted(true);
    setTrainingProgress({});
    setCompletedModels([]);

    // Inizializza il progresso a 0 per tutti i modelli
    const initialProgress = {};
    selectedModels.forEach(model => {
      initialProgress[model] = {
        progress: 0,
        metrics: null,
        status: "pending",
        trainingTime: null
      };
    });
    setTrainingProgress(initialProgress);

    // WebSocket connection
    const ws = new WebSocket(`ws://localhost:8000/ws/train`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Invia richiesta di training
      ws.send(JSON.stringify({
        dataset,
        models: selectedModels,
        test_size: 0.2,
        random_state: 42,
        selected_features: selectedFeatures
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === "training" || data.status === "completed") {
        const updated = {
          ...trainingProgressRef.current,
          [data.model]: {
            progress: data.progress,
            metrics: data.metrics || trainingProgressRef.current[data.model]?.metrics,
            status: data.status,
            trainingTime: data.metrics?.training_time_seconds || trainingProgressRef.current[data.model]?.trainingTime
          }
        };
        trainingProgressRef.current = updated;
        setTrainingProgress(updated);

        if (data.status === "completed") {
          setCompletedModels(prev => [...prev, data.model]);
        }
      }

      if (data.status === "model_error") {
        const updated = {
          ...trainingProgressRef.current,
          [data.model]: {
            progress: 0,
            metrics: null,
            status: "error",
            trainingTime: null,
            errorMessage: data.message
          }
        };
        trainingProgressRef.current = updated;
        setTrainingProgress(updated);
        setCompletedModels(prev => [...prev, data.model]);
      }

      if (data.status === "all_completed") {
        setIsTraining(false);
        onTrainingComplete(true, trainingProgressRef.current);
      }

      if (data.status === "error") {
        console.error("Training error:", data.message);
        setIsTraining(false);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsTraining(false);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };
  };

  const fetchPredictions = async (modelName) => {
    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          model_name: modelName
        })
      });

      const data = await response.json();
      setModelPredictions(prev => ({
        ...prev,
        [modelName]: {
          ...data,
          displayedRows: 5
        }
      }));
      setSelectedModelForDetails(modelName);
    } catch (error) {
      console.error("Error fetching predictions:", error);
    }
  };

  const handleModelClick = (modelName) => {
    const progress = trainingProgress[modelName];
    if (progress?.status === "completed") {
      if (modelPredictions[modelName]) {
        setSelectedModelForDetails(modelName);
      } else {
        fetchPredictions(modelName);
      }
    }
  };

  const closeDialog = () => {
    setSelectedModelForDetails(null);
    setTableHeight(null);
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const currentPredictions = selectedModelForDetails ? modelPredictions[selectedModelForDetails] : null;

  return (
    <div className="flex items-center justify-center h-full px-8 pt-32">
      {/* Container centrato */}
      <div
        className={`w-full flex flex-col items-center transition-all duration-700 ${trainingStarted ? 'max-w-7xl' : 'max-w-5xl'}`}
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        {/* Progress per ogni modello - Grid layout adattivo */}
        {selectedModels.length > 0 && (
          <div
            className="w-full overflow-y-auto training-scroll"
            style={{ maxHeight: 'calc(100vh - 340px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
          <style>{`.training-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div className={`grid ${selectedModels.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 w-full`}>
            {selectedModels.map((modelName) => {
              const progress = trainingProgress[modelName];
              const isCompleted = completedModels.includes(modelName);
              const isError = progress?.status === "error";
              const currentProgress = progress?.progress || 0;

              // Check se R² è disponibile (regressione) o null (classificazione)
              const hasR2 = progress?.metrics?.r2_score !== null && progress?.metrics?.r2_score !== undefined;

              return (
                <div
                  key={modelName}
                  onClick={() => handleModelClick(modelName)}
                  className={`rounded p-3 transition-all duration-300 ${
                    isError
                      ? 'bg-red-900/30 border border-red-800/50'
                      : 'bg-[#1a1a1a]'
                  } ${
                    isCompleted && !isError ? 'cursor-pointer hover:bg-[#252525] hover:scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{modelName}</h3>
                      <span className="text-xs text-gray-400 font-mono">
                        {currentProgress.toFixed(0)}%
                      </span>
                    </div>
                    
                    {isError ? (
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : isCompleted && (
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={`absolute top-0 left-0 h-full ${isError ? 'bg-red-600' : 'bg-gradient-to-r from-purple-600 to-pink-600'}`}
                      style={{
                        width: `${currentProgress}%`,
                        transition: isCompleted
                          ? 'width 0.3s ease-out'
                          : 'width 0.4s linear',
                      }}
                    />
                  </div>

                  {/* Error message */}
                  {isError && (
                    <div className="text-red-400 text-sm mt-2">
                      {progress.errorMessage || "Training failed"}
                    </div>
                  )}

                  {/* Metrics - Mostra 4 o 5 colonne in base a presenza R² */}
                  {progress?.metrics && !isError && (
                    <>
                      <div className={`grid ${hasR2 ? 'grid-cols-5' : 'grid-cols-4'} gap-1 mt-2`}>
                        <div className="text-center">
                          <div className="text-sm font-bold text-purple-400">
                            {(progress.metrics.accuracy * 100).toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-gray-500">Acc</div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm font-bold text-pink-400">
                            {(progress.metrics.precision * 100).toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-gray-500">Prec</div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm font-bold text-blue-400">
                            {(progress.metrics.recall * 100).toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-gray-500">Rec</div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm font-bold text-cyan-400">
                            {(progress.metrics.f1_score * 100).toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-gray-500">F1</div>
                        </div>

                        {/* Mostra R² solo se disponibile (regressione) */}
                        {hasR2 && (
                          <div className="text-center">
                            <div className="text-sm font-bold text-indigo-400">
                              {(progress.metrics.r2_score * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-gray-500">R²</div>
                          </div>
                        )}
                      </div>

                      {/* Training Time, Split, AUC-ROC, Overfit */}
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        <div className="text-center">
                          <div className="text-xs font-bold text-amber-400">
                            {progress.trainingTime ? `${progress.trainingTime.toFixed(2)}s` : '-'}
                          </div>
                          <div className="text-[10px] text-gray-500">Time</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-purple-400">
                            80/20%
                          </div>
                          <div className="text-[10px] text-gray-500">Split</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-teal-400">
                            {progress.metrics.auc_roc != null
                              ? (progress.metrics.auc_roc * 100).toFixed(1) + '%'
                              : '-'}
                          </div>
                          <div className="text-[10px] text-gray-500">AUC-ROC</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-xs font-bold ${
                            progress.metrics.overfit_gap != null
                              ? progress.metrics.overfit_gap > 0.1 ? 'text-red-400'
                              : progress.metrics.overfit_gap > 0.05 ? 'text-amber-400'
                              : 'text-emerald-400'
                              : 'text-gray-400'
                          }`}>
                            {progress.metrics.overfit_gap != null
                              ? (progress.metrics.overfit_gap * 100).toFixed(1) + '%'
                              : '-'}
                          </div>
                          <div className="text-[10px] text-gray-500">Overfit</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}

        {/* Pulsante Start Training - sotto i modelli */}
        {!trainingStarted && (
          <div className="flex justify-center mt-6 relative z-10">
            <button
              onClick={startTraining}
              disabled={!canTrain}
              className={`
                px-10 py-4 rounded text-white text-xl font-semibold
                bg-gradient-to-r from-purple-600 via-pink-600 to-red-600
                hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300
                ${!canTrain ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
              `}
            >
              Start Training
            </button>
          </div>
        )}

        {!dataset && (
          <div className="text-gray-500 text-center mt-8">
            Please select a dataset and models first
          </div>
        )}
      </div>

      {/* Dialog con risultati dettagliati */}
      {selectedModelForDetails && currentPredictions && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-8"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)'
          }}
          onClick={closeDialog}
        >
          <div 
            className="bg-[#1a1a1a] rounded p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header minimale */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-semibold text-lg">Predictions</h4>
              <button
                onClick={closeDialog}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabella risultati con scroll */}
            <div
              ref={(el) => {
                tableRef.current = el;
                if (el && !tableHeight) {
                  setTableHeight(el.offsetHeight);
                }
              }}
              className="overflow-auto rounded mb-4"
              style={tableHeight ? { height: tableHeight } : undefined}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-[#0a0a0a]">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-gray-400">
                      Sample ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-gray-400">
                      True Value
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-cyan-400 bg-cyan-600/10">
                      Predicted
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase whitespace-nowrap text-gray-400">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentPredictions.predictions.slice(0, (() => {
                    const modelKey = selectedModelForDetails;
                    return modelPredictions[modelKey]?.displayedRows || 5;
                  })()).map((pred, rowIdx) => (
                    <tr
                      key={pred.sample_id}
                      className={`${rowIdx % 2 === 0 ? "bg-[#1a1a1a]" : "bg-[#141414]"} transition-colors`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-300">
                        {pred.sample_id}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-white font-semibold">
                        {pred.true_value}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-cyan-300 font-semibold bg-cyan-600/5">
                        {pred.predicted_value}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        {pred.correct !== null ? (
                          pred.correct ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                              ✓ Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                              ✗ Wrong
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-500">
                            Error: {pred.error?.toFixed(3)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            {(() => {
              const displayedRows = modelPredictions[selectedModelForDetails]?.displayedRows || 5;
              return displayedRows < currentPredictions.predictions.length && (
                <div className="text-center mb-4">
                  <button
                    onClick={() => {
                      setModelPredictions(prev => ({
                        ...prev,
                        [selectedModelForDetails]: {
                          ...prev[selectedModelForDetails],
                          displayedRows: Math.min(
                            (prev[selectedModelForDetails]?.displayedRows || 5) + 10,
                            currentPredictions.predictions.length
                          )
                        }
                      }));
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    Load More ({currentPredictions.predictions.length - displayedRows} remaining)
                  </button>
                </div>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingView;