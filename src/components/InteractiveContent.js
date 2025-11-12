import React, { useState, useEffect } from "react";

const InteractiveContent = ({ activeIndex }) => {
  const [molecules, setMolecules] = useState(Array(25).fill(null));
  const [showPredictions, setShowPredictions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset quando cambia sezione
  useEffect(() => {
    if (activeIndex !== 1 && activeIndex !== 2) {
      setMolecules(Array(25).fill(null));
      setShowPredictions(false);
      setIsGenerating(false);
    }
    if (activeIndex === 1) {
      setShowPredictions(false);
    }
  }, [activeIndex]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setMolecules(Array(25).fill("molecule"));
      setIsGenerating(false);
    }, 2000);
  };

  const handlePredict = () => {
    setShowPredictions(true);
  };

  // Non mostrare nulla se non siamo in generate o predict
  if (activeIndex !== 1 && activeIndex !== 2) {
    return null;
  }

  const isGenerate = activeIndex === 1;
  const isPredict = activeIndex === 2;

  return (
    <div className="absolute inset-0 flex items-center justify-center px-16 py-8 pointer-events-none">
      {" "}
      {/* Contenitore con animazione della griglia */}
      <div
        className="flex items-center justify-between w-full max-w-7xl transition-all duration-1000 ease-out"
        style={{
          transform: isPredict ? "translateX(0)" : "translateX(0)",
        }}
      >
        {/* Pulsante Generate - appare da sinistra */}
        <div
          className={`transition-all duration-700 ease-out pointer-events-auto ${
            isGenerate
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-20 pointer-events-none"
          }`}
        >
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 rounded-xl text-white text-xl font-semibold hover:shadow-2xl hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            generate
          </button>
        </div>

        {/* Griglia 5x5 - si sposta da destra a sinistra */}
        <div
          className={`grid grid-cols-5 gap-3 transition-all duration-1000 ease-out pointer-events-auto ${
            isPredict ? "order-first mr-auto" : "order-last ml-auto"
          }`}
          style={{
            transform: isPredict ? "translateX(-10%)" : "translateX(0)",
          }}
        >
          {molecules.map((mol, idx) => (
            <div
              key={idx}
              className="w-28 h-28 rounded-lg bg-gray-700 relative overflow-hidden flex items-center justify-center"
            >
              {/* Shimmer effect durante il caricamento */}
              {isGenerating && (
                <div className="absolute inset-0 shimmer-effect" />
              )}

              {/* Molecola generata */}
              {mol && !isGenerating && <div className="text-4xl">⬢</div>}

              {/* Predizioni */}
              {mol && showPredictions && !isGenerating && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-xs">
                  <div className="text-cyan-400 font-mono">
                    {(Math.random() * 10).toFixed(2)}
                  </div>
                  <div className="text-orange-400 font-mono">
                    {(Math.random() * 100).toFixed(1)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pulsante Predict - appare da destra */}
        <div
          className={`transition-all duration-700 ease-out pointer-events-auto ${
            isPredict
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-20 pointer-events-none"
          }`}
        >
          <button
            onClick={handlePredict}
            disabled={molecules[0] === null || showPredictions}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-xl text-white text-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            predict
          </button>
        </div>
      </div>
      {/* CSS per shimmer effect */}
      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .shimmer-effect {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 100%
          );
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default InteractiveContent;
