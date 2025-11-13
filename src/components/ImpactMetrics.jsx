import React, { useEffect, useState, useRef } from "react";
import { getAnimationProgress } from "../utils/animationConfig";

const ImpactMetrics = ({ activeIndex, scrollIndex, totalSections }) => {
  const SECTION_IMPACT = 6; // Aggiorna se la posizione cambia

  const [counters, setCounters] = useState({
    timeToMarket: 0,
    accuracy: 0,
    roi: 0,
  });

  // Manteniamo montato il componente fino a fine fade-out
  const [visible, setVisible] = useState(false);

  const animationStartedRef = useRef(false);
  const rafRef = useRef(null);
  const timeoutRef = useRef(null);

  const {
    currentIndex,
    nextIndex,
    currentOpacity,
    nextOpacity,
  } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  // Consideriamo la sezione "visibile" se è current o next (entra/è dentro/esce)
  const isCurrent = currentIndex === SECTION_IMPACT;
  const isNext = nextIndex === SECTION_IMPACT;
  const shouldShow = isCurrent || isNext;

  // Calcola opacità del container in base allo stato di animazione
  let containerOpacity = 0;
  if (isCurrent) containerOpacity = currentOpacity ?? 0;
  else if (isNext) containerOpacity = nextOpacity ?? 0;

  // Se shouldShow diventa true, montiamo subito; se diventa false, aspettiamo
  useEffect(() => {
    if (shouldShow) {
      // Cancel eventuale unmount timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVisible(true);
    } else if (visible) {
      // rimani visibile per il tempo della transizione prima di smontare
      // scegli un tempo leggermente maggiore della transizione CSS (qui 260ms)
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 160);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shouldShow, visible]);

  // Animazione contatori: parte quando il container diventa visibile (containerOpacity > 0)
  useEffect(() => {
    const duration = 2000; // durata animazione contatori (ms)
    const targetValues = {
      timeToMarket: 4.5,
      accuracy: 76,
      roi: 50,
    };

    // avvia l'animazione quando il container comincia ad apparire
    const shouldStartAnim = containerOpacity > 0.03 && visible; // soglia per iniziare
    if (shouldStartAnim && !animationStartedRef.current) {
      animationStartedRef.current = true;
      const startTime = performance.now();

      const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

      const animate = (t) => {
        const elapsed = t - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);

        setCounters({
          timeToMarket: Math.floor(targetValues.timeToMarket * eased),
          accuracy: Math.floor(targetValues.accuracy * eased),
          roi: Math.floor(targetValues.roi * eased),
        });

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }

    // quando il container scompare completamente (visible === false), resetta i contatori
    if (!visible) {
      animationStartedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCounters({ timeToMarket: 0, accuracy: 0, roi: 0 });
    }

    return () => {
      // cleanup se dipendenze cambiano
      if (!visible && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerOpacity, visible]); // dipendiamo da containerOpacity e visible

  // se non dobbiamo essere montati, non renderizziamo nulla
  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: containerOpacity,
        transition: "opacity 200ms ease-out",
        willChange: "opacity",
      }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl px-8">
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
