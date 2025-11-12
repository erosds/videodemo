import React, { useState, useEffect } from "react";
import { getAnimationProgress } from "../utils/animationConfig";
import { getRandomMolecules } from "../data/moleculesData";
import MoleculeRenderer from "./MoleculeRenderer";

const InteractiveContent = ({
  activeIndex,
  scrollIndex = 0,
  totalSections = 5,
}) => {
  const [molecules, setMolecules] = useState(Array(24).fill(null));
  const [showPredictions, setShowPredictions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [containerWidth, setContainerWidth] = useState(0);

  const [showTop10, setShowTop10] = useState(false);

  useEffect(() => {
    const updateWidth = () => {
      const titleContainer = document.getElementById("title-container");
      if (titleContainer) {
        setContainerWidth(titleContainer.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [containerWidth]);

  // Ottieni solo i valori di progressione base
  const {
    currentIndex,
    nextIndex,
    direction,
    absP,
    eased,
    currentOpacity,
    nextOpacity,
  } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  // Reset quando cambia sezione
  useEffect(() => {
    if (activeIndex !== 1 && activeIndex !== 2 && activeIndex !== 3) {
      setMolecules(Array(24).fill(null));
      setShowPredictions(false);
      setIsGenerating(false);
      setShowTop10(false); // AGGIUNGI QUESTA RIGA
    }
    if (activeIndex === 1) {
      setShowPredictions(false);
    }
    if (activeIndex === 1 || activeIndex === 2) {
      // AGGIUNGI QUESTE RIGHE
      setShowTop10(false);
    }
  }, [activeIndex]);

  const handleTop10 = () => {
    setShowTop10(!showTop10);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      // Genera molecole casuali diverse ogni volta
      setMolecules(getRandomMolecules(24));
      setIsGenerating(false);
    }, 2000);
  };

  const handlePredict = () => {
    setShowPredictions(true);
  };

  // Non mostrare nulla se non siamo in generate, predict o in transizione verso di esse
  if (
    activeIndex !== 1 &&
    activeIndex !== 2 &&
    activeIndex !== 3 && // AGGIUNGI
    nextIndex !== 1 &&
    nextIndex !== 2 &&
    nextIndex !== 3 // AGGIUNGI
  ) {
    return null;
  }

  const isGenerate = activeIndex === 1;
  const isPredict = activeIndex === 2;
  const isTransitioningToGenerate = nextIndex === 1;
  const isTransitioningToPredict = nextIndex === 2;
  const isTransitioningFromGenerate = currentIndex === 1 && direction !== 0;

  const isSelect = activeIndex === 3;
  const isTransitioningToSelect = nextIndex === 3;
  const isTransitioningFromPredict = currentIndex === 2 && direction !== 0;

  // PARAMETRI DI ANIMAZIONE SPECIFICI PER QUESTO COMPONENTE
  const buttonEnterDistance = 50; // vw - distanza da cui entrano i pulsanti

  // === PULSANTE GENERATE (entra/esce da SINISTRA, posizione fissa a sinistra) ===
  let generateTranslateX = 0;
  let generateOpacity = 0;

  if (isGenerate) {
    // Siamo su generate: il pulsante è fisso a sinistra, fade out quando si esce
    generateTranslateX = 0;
    generateOpacity = currentOpacity;
  } else if (isTransitioningToGenerate) {
    // Stiamo entrando in generate: slide in da sinistra
    generateTranslateX = -buttonEnterDistance * (1 - eased);
    generateOpacity = nextOpacity;
  }

  // === GRIGLIA (posizionata a DESTRA in generate, a SINISTRA in predict) ===
  let gridTranslateX = 0;
  let gridOpacity = 0;
  let gridAlign = "right"; // 'right' in generate, 'left' in predict

  if (isGenerate) {
    // Su generate: griglia a destra, nessun offset
    gridTranslateX = 0;
    gridOpacity = currentOpacity;
    gridAlign = "right";
  } else if (isPredict) {
    // Su predict: griglia a sinistra, nessun offset
    gridTranslateX = 0;
    gridOpacity = currentOpacity;
    gridAlign = "left";
  } else if (isTransitioningToGenerate) {
    // Entrando in generate: appare a destra
    gridTranslateX = 0;
    gridOpacity = nextOpacity;
    gridAlign = "right";
  } else if (isTransitioningToPredict) {
    if (isTransitioningFromGenerate) {
      // Veniamo da generate: slide da destra a sinistra
      // Calcola la larghezza della griglia (8 colonne * 128px + 7 gap * 12px)
      const gridWidth = 8 * 128 + 7 * 12; // 1040px
      const containerWidthPx = containerWidth || window.innerWidth;
      // Distanza da percorrere: dalla posizione right a left
      const totalDistance = containerWidthPx - gridWidth;
      gridTranslateX = -totalDistance * eased; // movimento progressivo
      gridOpacity = 1;
      gridAlign = "right"; // mantieni allineamento a destra durante transizione
    } else {
      // Arriviamo da altra sezione: appare già spostata a sinistra
      gridTranslateX = 0;
      gridOpacity = nextOpacity;
      gridAlign = "left";
    }
  } else if (isSelect) {
    // Su select: griglia torna a destra
    gridTranslateX = 0;
    gridOpacity = currentOpacity;
    gridAlign = "right";
  } else if (isTransitioningToSelect) {
    if (isTransitioningFromPredict) {
      // Veniamo da predict: slide da sinistra a destra
      const gridWidth = 8 * 128 + 7 * 12;
      const containerWidthPx = containerWidth || window.innerWidth;
      const totalDistance = containerWidthPx - gridWidth;
      gridTranslateX = totalDistance * eased; // movimento verso destra
      gridOpacity = 1;
      gridAlign = "left";
    } else {
      gridTranslateX = 0;
      gridOpacity = nextOpacity;
      gridAlign = "right";
    }
  }

  // === PULSANTE PREDICT (entra/esce da DESTRA, posizione fissa a destra) ===
  let predictTranslateX = 0;
  let predictOpacity = 0;

  // === PULSANTE TOP 10 (entra/esce da SINISTRA in select) ===
  let top10TranslateX = 0;
  let top10Opacity = 0;

  if (isSelect) {
    top10TranslateX = 0;
    top10Opacity = currentOpacity;
  } else if (isTransitioningToSelect) {
    top10TranslateX = -buttonEnterDistance * (1 - eased);
    top10Opacity = nextOpacity;
  }
  if (isPredict) {
    // Siamo su predict: il pulsante è fisso a destra, fade out quando si esce
    predictTranslateX = 0;
    predictOpacity = currentOpacity;
  } else if (isTransitioningToPredict) {
    // Stiamo entrando in predict: slide in da destra
    predictTranslateX = buttonEnterDistance * (1 - eased);
    predictOpacity = nextOpacity;
  }

  // Calcola le top 10 molecole in base al primo valore (cyan)
  const moleculesWithScores = molecules.map((mol, idx) => ({
    idx,
    score: mol
      ? parseFloat(localStorage.getItem(`mol-${idx}`) || Math.random() * 10)
      : -1,
  }));
  const top10Indices = moleculesWithScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((m) => m.idx);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: containerWidth || "100%", height: "60vh" }}
      >
        <div
          className="absolute left-16 top-1/2 -translate-y-1/2"
          style={{
            transform: `translateX(${generateTranslateX}vw) translateY(-50%)`,
            opacity: generateOpacity,
            transition: "none",
            willChange: "transform, opacity",
          }}
        >
          {generateOpacity > 0 && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 rounded-xl text-white text-xl font-semibold hover:shadow-2xl hover:shadow-cyan-500/50 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
            >
              generate
            </button>
          )}
        </div>

        {/* Griglia - posizione assoluta al CENTRO, si sposta */}
        <div
          className="absolute top-2/3 -translate-y-1/2"
          style={{
            left: gridAlign === "left" ? 64 : undefined,
            right: gridAlign === "right" ? 64 : undefined,
            transform: `translateX(${gridTranslateX}px) translateY(-50%)`,
            opacity: gridOpacity,
            transition: "none",
            willChange: "transform, opacity",
          }}
        >
          <div className="grid grid-cols-8 gap-3">
            {molecules.map((mol, idx) => (
              <div
                key={idx}
                className={`w-28 h-28 rounded-lg bg-[#1a1a1a] relative overflow-hidden flex items-center justify-center ${
                  showTop10 && top10Indices.includes(idx)
                    ? "ring-2 ring-green-500"
                    : ""
                }`}
              >
                {/* Shimmer effect durante il caricamento */}
                {isGenerating && (
                  <div className="absolute inset-0 shimmer-effect" />
                )}

                {/* Molecola generata */}
                {mol && !isGenerating && (
                  <MoleculeRenderer smiles={mol} size={120} />
                )}

                {/* Predizioni */}
                {mol && showPredictions && !isGenerating && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-xs">
                    <div className="text-cyan-400 font-mono">
                      {(() => {
                        const key = `mol-${idx}`;
                        let value = localStorage.getItem(key);
                        if (!value) {
                          value = (Math.random() * 10).toFixed(2);
                          localStorage.setItem(key, value);
                        }
                        return value;
                      })()}
                    </div>
                    <div className="text-orange-400 font-mono">
                      {(() => {
                        const key = `mol-${idx}-orange`;
                        let value = localStorage.getItem(key);
                        if (!value) {
                          value = (Math.random() * 100).toFixed(1);
                          localStorage.setItem(key, value);
                        }
                        return value;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pulsante Predict - posizione assoluta a DESTRA */}
        <div
          className="absolute right-16 top-1/2 -translate-y-1/2"
          style={{
            transform: `translateX(${predictTranslateX}vw) translateY(-50%)`,
            opacity: predictOpacity,
            transition: "none",
            willChange: "transform, opacity",
          }}
        >
          {predictOpacity > 0 && (
            <button
              onClick={handlePredict}
              disabled={molecules[0] === null || showPredictions}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-xl text-white text-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
            >
              predict
            </button>
          )}
        </div>

        {/* Pulsante Top 10 - posizione assoluta a SINISTRA in select */}
        <div
          className="absolute left-16 top-1/2 -translate-y-1/2"
          style={{
            transform: `translateX(${top10TranslateX}vw) translateY(-50%)`,
            opacity: top10Opacity,
            transition: "none",
            willChange: "transform, opacity",
          }}
        >
          {top10Opacity > 0 && (
            <button
              onClick={handleTop10}
              disabled={!showPredictions}
              className="px-8 py-4 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-xl text-white text-xl font-semibold hover:shadow-2xl hover:shadow-green-500/50 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
            >
              select
            </button>
          )}
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
          animation: shimmer 1.0s infinite;
        }
      `}</style>
    </div>
  );
};

export default InteractiveContent;
