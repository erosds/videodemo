import React, { useEffect, useState, useRef } from "react";
import { getAnimationProgress } from "../../utils/animationConfig";

const ImpactMetrics = ({ activeIndex, scrollIndex, totalSections }) => {
  const SECTION_IMPACT = 6; // Aggiorna se la posizione cambia
  const SECTION_INDUSTRIES = 5;

  const [counters, setCounters] = useState({
    timeToMarket: 0,
    accuracy: 0,
    roi: 0,
  });

  // Manteniamo montato il componente fino a fine fade-out
  const animationStartedRef = useRef(false);
  const rafRef = useRef(null);

  const {
    currentIndex,
    nextIndex,
    absP,
  } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const clamp = (v) => Math.max(0, Math.min(1, v));

  const isOnImpact = activeIndex === SECTION_IMPACT;
  const isEnteringFromIndustries = currentIndex === SECTION_INDUSTRIES && nextIndex === SECTION_IMPACT;
  const isExitingImpact = currentIndex === SECTION_IMPACT && nextIndex !== SECTION_IMPACT;

  let containerOpacity = 0;
  if (isOnImpact && !isExitingImpact) {
    containerOpacity = 1;
  } else if (isEnteringFromIndustries) {
    // Appare solo nell'ultimo 15% della transizione (dopo che Industries è sparito)
    containerOpacity = clamp((absP - 0.85) / 0.15);
  } else if (isExitingImpact) {
    // Scompare nel primo 15% della transizione
    containerOpacity = clamp(1 - absP / 0.15);
  }

  useEffect(() => {
    // Avvia l'animazione solo quando diventi visibile
    if (containerOpacity > 0.5 && !animationStartedRef.current) {
      animationStartedRef.current = true;

      const duration = 2000;
      const startTime = performance.now();

      const animate = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);

        setCounters({
          timeToMarket: parseFloat((4.5 * eased).toFixed(1)),
          accuracy: Math.floor(76 * eased),
          roi: Math.floor(50 * eased),
        });

        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }

    // Resetta quando esci completamente
    if (containerOpacity <= 0.01) {
      animationStartedRef.current = false;
      setCounters({ timeToMarket: 0, accuracy: 0, roi: 0 });
    }
  }, [containerOpacity]);

  // se non dobbiamo essere montati, non renderizziamo nulla
  if (containerOpacity <= 0.01) return null;
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: containerOpacity,
        willChange: "opacity",
      }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl px-24">
        {/* Grid 3 colonne */}
        <div className="grid grid-cols-3 gap-8">
          {/* Card 1: Time-to-Market */}
          <div
            className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-900 transform transition-all duration-300"
            style={{
              // piccoli offset per singola card in base all'opacità per "entrata" più naturale
              transform: `translateY(${(1 - containerOpacity) * 10}px)`,
              opacity: Math.max(0.85, containerOpacity),
            }}
          >
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

            <h3 className="text-2xl font-semibold text-white mb-4">
              Faster Time-to-Market
            </h3>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              AI-powered platforms compress drug discovery from 4.5 years to 12
              months, accelerating candidate identification and reducing
              synthesis cycles.
            </p>

            <div className="text-xs text-gray-500 font-mono pointer-events-auto">
              [<a
                href="https://www.ukri.org/who-we-are/how-we-are-doing/research-outcomes-and-impact/bbsrc/exscientia-a-clinical-pipeline-for-ai-designed-drug-candidates/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:text-indigo-400 underline transition-colors cursor-pointer"
              >
                Exscientia, UKRI 2023
              </a>; Insilico Medicine 2024]
            </div>
          </div>

          {/* Card 2: Accuracy */}
          <div
            className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-900 transform transition-all duration-300"
            style={{
              transform: `translateY(${(1 - containerOpacity) * 6}px)`,
              opacity: Math.max(0.85, containerOpacity),
            }}
          >
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

            <h3 className="text-2xl font-semibold text-white mb-4">
              Prediction Accuracy
            </h3>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Advanced ML models achieve 74-76% accuracy in protein-ligand
              binding predictions, significantly outperforming traditional
              computational methods.
            </p>

            <div className="text-xs text-gray-500 font-mono pointer-events-auto">
              [<a
                href="https://www.prescouter.com/2024/05/google-deepmind-alphafold-3/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:text-indigo-400 underline transition-colors cursor-pointer"
              >
                AlphaFold 3, DeepMind 2024
              </a>; Atomwise, 2024]
            </div>
          </div>

          {/* Card 3: ROI/Savings */}
          <div
            className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-900 transform transition-all duration-300"
            style={{
              transform: `translateY(${(1 - containerOpacity) * 2}px)`,
              opacity: Math.max(0.85, containerOpacity),
            }}
          >
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

            <h3 className="text-2xl font-semibold text-white mb-4">
              Cost Reduction
            </h3>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              High-Tech companies save millions of dollars annually through
              AI-optimized compound screening, automated synthesis, and
              predictive modeling.
            </p>

            <div className="text-xs text-gray-500 font-mono pointer-events-auto">
              [<a
                href="https://www.hitachi.com/New/cnews/month/2025/08/250819.html" target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:text-indigo-400 underline transition-colors"
              >
                Hitachi, 2025
              </a>; Dassault Systèmes, 2024]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpactMetrics;
