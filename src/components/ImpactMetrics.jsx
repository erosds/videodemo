import React, { useEffect, useState, useRef } from "react";
import { getAnimationProgress } from "../utils/animationConfig";

const ImpactMetrics = ({ activeIndex, scrollIndex, totalSections }) => {
  const SECTION_IMPACT = 4; // Aggiorna questo se la posizione cambia

  const [counters, setCounters] = useState({
    timeToMarket: 0,
    accuracy: 0,
    roi: 0,
  });

  const animationStartedRef = useRef(false);

  const {
    currentIndex,
    nextIndex,
    currentOpacity,
    nextOpacity,
  } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  // Determina se siamo sulla sezione impact o in transizione verso di essa
  const isOnImpact = activeIndex === SECTION_IMPACT;
  const isEnteringImpact = nextIndex === SECTION_IMPACT;
  const shouldShow = isOnImpact || isEnteringImpact;

  // Calcola l'opacità del container
  let containerOpacity = 0;
  if (isOnImpact) {
    containerOpacity = currentOpacity;
  } else if (isEnteringImpact) {
    containerOpacity = nextOpacity;
  }

  // Animazione contatori quando la sezione diventa visibile
  useEffect(() => {
    if (isOnImpact && !animationStartedRef.current) {
      animationStartedRef.current = true;

      const duration = 2000; // 2 secondi
      const startTime = performance.now();

      const targetValues = {
        timeToMarket: 5,
        accuracy: 76,
        roi: 90,
      };

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function per animazione più naturale
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
        const easedProgress = easeOutQuart(progress);

        setCounters({
          timeToMarket: Math.floor(targetValues.timeToMarket * easedProgress),
          accuracy: Math.floor(targetValues.accuracy * easedProgress),
          roi: Math.floor(targetValues.roi * easedProgress),
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }

    // Reset quando usciamo dalla sezione
    if (!isOnImpact && !isEnteringImpact) {
      animationStartedRef.current = false;
      setCounters({ timeToMarket: 0, accuracy: 0, roi: 0 });
    }
  }, [isOnImpact, isEnteringImpact]);

  if (!shouldShow) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: containerOpacity,
        transition: "none",
        willChange: "opacity",
      }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl px-8">
        {/* Grid 3 colonne */}
        <div className="grid grid-cols-3 gap-8">
          {/* Card 1: Time-to-Market */}
          <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-800">
            {/* Numero grande con gradiente */}
            <div className="mb-4">
              <span
                className="text-7xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text"
                style={{
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {counters.timeToMarket}x
              </span>
            </div>

            {/* Label */}
            <h3 className="text-2xl font-semibold text-white mb-4">
              Faster Time-to-Market
            </h3>

            {/* Descrizione */}
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              AI-powered platforms compress drug discovery from 4.5 years to 12
              months, accelerating candidate identification and reducing
              synthesis cycles.
            </p>

            {/* Reference */}
            <div className="text-xs text-gray-500 font-mono">
              [Exscientia, ITIF 2024; Insilico Medicine, 2024]
            </div>
          </div>

          {/* Card 2: Accuracy */}
          <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-800">
            {/* Numero grande con gradiente */}
            <div className="mb-4">
              <span
                className="text-7xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text"
                style={{
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {counters.accuracy}%
              </span>
            </div>

            {/* Label */}
            <h3 className="text-2xl font-semibold text-white mb-4">
              Prediction Accuracy
            </h3>

            {/* Descrizione */}
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Advanced ML models achieve 74-76% accuracy in protein-ligand
              binding predictions, significantly outperforming traditional
              computational methods.
            </p>

            {/* Reference */}
            <div className="text-xs text-gray-500 font-mono">
              [AlphaFold 3, DeepMind 2024; Atomwise, 2024]
            </div>
          </div>

          {/* Card 3: ROI/Savings */}
          <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-800">
            {/* Numero grande con gradiente */}
            <div className="mb-4">
              <span
                className="text-7xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text"
                style={{
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {counters.roi}%
              </span>
            </div>

            {/* Label */}
            <h3 className="text-2xl font-semibold text-white mb-4">
              Cost Reduction
            </h3>

            {/* Descrizione */}
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Pharmaceutical companies achieve 70-90% cost savings through
              AI-optimized compound screening, automated synthesis, and
              predictive modeling.
            </p>

            {/* Reference */}
            <div className="text-xs text-gray-500 font-mono">
              [Exscientia AWS, 2024; Insilico Medicine, 2021]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpactMetrics;