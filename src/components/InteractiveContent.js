import React, { useState, useEffect, useCallback } from "react";
import { getAnimationProgress } from "../utils/animationConfig";
import { getRandomMolecules } from "../data/moleculesData";
import MoleculeRenderer from "./MoleculeRenderer";
import ImpactMetrics from "./ImpactMetrics";
import IndustriesContent from "./IndustriesContent";

// Definizioni delle sezioni per maggiore leggibilità
const SECTION_GENERATE = 1;
const SECTION_PREDICT = 2;
const SECTION_SELECT = 3;
const SECTION_VALIDATE = 4;
const SECTION_INDUSTRIES = 5;

// Larghezza fissa della griglia
const GRID_WIDTH_PX_8COL = 8 * 128 + 7 * 1; // 8 colonne * 128px + 7 gap * 1px = 1031px
const GRID_WIDTH_PX_5COL = 5 * 128 + 4 * 1; // 5 colonne * 128px + 4 gap * 1px = 648px

/**
 * Hook personalizzato per ottenere la larghezza del container
 */
const useContainerWidth = () => {
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      const titleContainer = document.getElementById("title-container");
      // Uso window.innerWidth come fallback, ma idealmente si usa un contenitore specifico
      setContainerWidth(
        titleContainer ? titleContainer.offsetWidth : window.innerWidth
      );
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    // Pulizia dell'event listener
    return () => window.removeEventListener("resize", updateWidth);
  }, []); // Esegue solo al mount e al unmount

  return containerWidth;
};

/**
 * Componente per il pulsante
 */
const InteractiveButton = ({
  children,
  onClick,
  disabled,
  style,
  className,
}) => (
  <div
    className="absolute top-1/2 -translate-y-1/2"
    style={{
      transform: style.transform,
      opacity: style.opacity,
      transition: "none",
      willChange: "transform, opacity",
      ...(style.left && { left: style.left }),
      ...(style.right && { right: style.right }),
    }}
  >
    {style.opacity > 0 && (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`px-8 py-4 rounded-xl text-white text-xl font-semibold hover:shadow-2xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto ${className}`}
      >
        {children}
      </button>
    )}
  </div>
);

/**
 * Logica di animazione per la griglia
 * @param {object} params - Parametri di animazione
 * @returns {{gridTranslateX: number, gridOpacity: number, gridAlign: string}}
 */
const getGridAnimation = ({
  activeIndex,
  nextIndex,
  currentIndex,
  direction,
  eased,
  currentOpacity,
  nextOpacity,
  containerWidth,
}) => {
  let gridTranslateX = 0;
  let gridOpacity = 0;
  let gridAlign = "right"; // Default: generate e select

  const isTransitioningFromGenerateToPredict =
    currentIndex === SECTION_GENERATE && nextIndex === SECTION_PREDICT;
  const isTransitioningFromPredictToSelect =
    currentIndex === SECTION_PREDICT && nextIndex === SECTION_SELECT;
  const isTransitioningFromSelectToValidate =
    currentIndex === SECTION_SELECT && nextIndex === SECTION_VALIDATE;

  // Calcola la distanza totale di traslazione (per griglia 8 colonne)
  const totalDistance = containerWidth - GRID_WIDTH_PX_8COL;

  if (activeIndex === SECTION_GENERATE || activeIndex === SECTION_SELECT) {
    // Su generate o select: griglia a destra (posizione base)
    gridTranslateX = 0;
    gridOpacity = currentOpacity;
    gridAlign = "right";
  } else if (activeIndex === SECTION_PREDICT) {
    // Su predict: griglia a sinistra (traslata)
    gridTranslateX = -totalDistance; // Spostamento completo a sinistra
    gridOpacity = currentOpacity;
    gridAlign = "left";
  } else if (activeIndex === SECTION_VALIDATE) {
    // Su validate: griglia a sinistra (griglia 2x5)
    gridTranslateX = -totalDistance;
    gridOpacity = currentOpacity;
    gridAlign = "left";
  } else if (nextIndex === SECTION_GENERATE) {
    // Entrando in generate: appare a destra (posizione base)
    gridTranslateX = 0;
    gridOpacity = nextOpacity;
    gridAlign = "right";
  } else if (nextIndex === SECTION_PREDICT) {
    if (isTransitioningFromGenerateToPredict) {
      // Venendo da generate (right -> left): movimento da 0 a -totalDistance
      gridTranslateX = -totalDistance * eased;
      gridOpacity = 1; // Mantieni opacità alta durante lo slide
      gridAlign = "right"; // L'allineamento di partenza è a destra
    } else {
      // Arrivando da altra sezione: appare già spostata a sinistra
      gridTranslateX = -totalDistance;
      gridOpacity = nextOpacity;
      gridAlign = "left";
    }
  } else if (nextIndex === SECTION_SELECT) {
    if (isTransitioningFromPredictToSelect) {
      // Venendo da predict (left -> right): movimento da -totalDistance a 0
      // La posizione iniziale è -totalDistance (predict), la finale è 0 (select).
      // eased va da 0 a 1, quindi: -totalDistance + (totalDistance * eased)
      gridTranslateX = -totalDistance + totalDistance * eased;
      gridOpacity = 1; // Mantieni opacità alta durante lo slide
      gridAlign = "left"; // L'allineamento di partenza è a sinistra
    } else {
      // Arrivando da altra sezione: appare a destra (posizione base)
      gridTranslateX = 0;
      gridOpacity = nextOpacity;
      gridAlign = "right";
    }
  } else if (nextIndex === SECTION_VALIDATE) {
    if (isTransitioningFromSelectToValidate) {
      // Venendo da select (right -> left): movimento da 0 a -totalDistance
      gridTranslateX = -totalDistance * eased;
      gridOpacity = 1;
      gridAlign = "right";
    } else {
      gridTranslateX = -totalDistance;
      gridOpacity = nextOpacity;
      gridAlign = "left";
    }
  }

  return { gridTranslateX, gridOpacity, gridAlign };
};

// ------------------------------------------------------------------
// COMPONENTE PRINCIPALE
// ------------------------------------------------------------------

const InteractiveContent = ({
  activeIndex,
  scrollIndex = 0,
  totalSections = 7,
}) => {
  const [molecules, setMolecules] = useState(Array(24).fill(null));
  const [showPredictions, setShowPredictions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showTop10, setShowTop10] = useState(false);
  // Riga ~133, dopo gli altri useState:
  const [validationResults, setValidationResults] = useState([]); // Array di indici validati con successo
  const [isValidating, setIsValidating] = useState(false);
  const [lastVisitedSection, setLastVisitedSection] =
    useState(SECTION_GENERATE);

  const containerWidth = useContainerWidth();

  // Ottieni valori di progressione
  const {
    currentIndex,
    nextIndex,
    direction,
    absP,
    eased,
    currentOpacity,
    nextOpacity,
  } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  useEffect(() => {
    // Resetta tutto se non siamo in una delle sezioni interattive
    if (
      activeIndex !== SECTION_GENERATE &&
      activeIndex !== SECTION_PREDICT &&
      activeIndex !== SECTION_SELECT &&
      activeIndex !== SECTION_VALIDATE
    ) {
      setMolecules(Array(24).fill(null));
      setShowPredictions(false);
      setIsGenerating(false);
      setIsPredicting(false);
      setShowTop10(false);
      setValidationResults([]);
      setIsValidating(false);
      setLastVisitedSection(SECTION_GENERATE);
      return;
    }

    // Logica per tornare indietro: annulla solo l'azione della tab corrente precedente
    if (activeIndex < lastVisitedSection) {
      // Tornando indietro, annulla l'azione della sezione da cui veniamo
      switch (lastVisitedSection) {
        case SECTION_PREDICT:
          setShowPredictions(false);
          setIsPredicting(false);
          break;
        case SECTION_SELECT:
          setShowTop10(false); // AGGIUNGI QUESTA RIGA
          break;
        case SECTION_VALIDATE:
          setValidationResults([]);
          setIsValidating(false);
          break;
      }
    }

    // Aggiorna l'ultima sezione visitata
    setLastVisitedSection(activeIndex);
  }, [activeIndex, lastVisitedSection]);

  const handleTop10 = useCallback(() => {
    setShowTop10(true);
  }, []);

  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    // Resetta prediction e select state
    setShowPredictions(false);
    setShowTop10(false);

    // AGGIUNTO: Pulisci i valori precedenti dal localStorage
    for (let i = 0; i < 24; i++) {
      localStorage.removeItem(`mol-${i}`);
      localStorage.removeItem(`mol-${i}-orange`);
    }

    setTimeout(() => {
      setMolecules(getRandomMolecules(24));
      setIsGenerating(false);
    }, 1500);
  }, []);

  const handlePredict = useCallback(() => {
    setIsPredicting(true);
    setTimeout(() => {
      setShowPredictions(true);
      setIsPredicting(false);
    }, 1500);
  }, []);

  // ------------------------------------------
  // Logica per Top 10
  // ------------------------------------------
  const moleculesWithScores = molecules.map((mol, idx) => ({
    idx,
    // La logica di score è contenuta nella MoleculeRenderer, qui recuperiamo
    // i valori per l'ordinamento e la marcatura (ring-2)
    score: mol ? parseFloat(localStorage.getItem(`mol-${idx}`) || 0) : -1,
  }));
  const top10Indices = moleculesWithScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((m) => m.idx);

  const handleValidate = useCallback(() => {
    setIsValidating(true);

    setTimeout(() => {
      // Seleziona 8 molecole random dalle top 10
      const shuffled = [...top10Indices].sort(() => Math.random() - 0.5);
      const validated = shuffled.slice(0, 8);
      setValidationResults(validated);
      setIsValidating(false);
    }, 1500);
  }, [top10Indices]);

  // Non mostrare la UI interattiva se non siamo in generate/predict/select/validate o in transizione verso di esse.
  if (
    ![
      SECTION_GENERATE,
      SECTION_PREDICT,
      SECTION_SELECT,
      SECTION_VALIDATE,
    ].includes(activeIndex) &&
    ![
      SECTION_GENERATE,
      SECTION_PREDICT,
      SECTION_SELECT,
      SECTION_VALIDATE,
    ].includes(nextIndex)
  ) {
    return (
      <>
        <IndustriesContent
          activeIndex={activeIndex}
          scrollIndex={scrollIndex}
          totalSections={totalSections}
        />
        <ImpactMetrics
          activeIndex={activeIndex}
          scrollIndex={scrollIndex}
          totalSections={totalSections}
        />
      </>
    );
  }

  // Costanti per la logica di animazione
  const buttonEnterDistance = 50; // vw - distanza da cui entrano i pulsanti

  // ------------------------------------------
  // Logica di Animazione
  // ------------------------------------------

  // === GRIGLIA ===
  const { gridTranslateX, gridOpacity, gridAlign } = getGridAnimation({
    activeIndex,
    nextIndex,
    currentIndex,
    direction,
    eased,
    currentOpacity,
    nextOpacity,
    containerWidth,
  });

  // === PULSANTE GENERATE (a sinistra) ===
  let generateTranslateX = 0;
  let generateOpacity = 0;
  if (activeIndex === SECTION_GENERATE) {
    generateOpacity = currentOpacity;
  } else if (nextIndex === SECTION_GENERATE) {
    generateTranslateX = -buttonEnterDistance * (1 - eased); // Slide in da sinistra
    generateOpacity = nextOpacity;
  }

  // === PULSANTE PREDICT (a destra) ===
  let predictTranslateX = 0;
  let predictOpacity = 0;
  if (activeIndex === SECTION_PREDICT) {
    predictOpacity = currentOpacity;
  } else if (nextIndex === SECTION_PREDICT) {
    predictTranslateX = buttonEnterDistance * (1 - eased); // Slide in da destra
    predictOpacity = nextOpacity;
  }

  // === PULSANTE SELECT (a sinistra, solo su select) ===
  let top10TranslateX = 0;
  let top10Opacity = 0;
  if (activeIndex === SECTION_SELECT) {
    top10Opacity = currentOpacity;
  } else if (nextIndex === SECTION_SELECT) {
    top10TranslateX = -buttonEnterDistance * (1 - eased); // Slide in da sinistra
    top10Opacity = nextOpacity;
  }

  // === PULSANTE VALIDATE (a destra, solo su validate) ===
  let validateTranslateX = 0;
  let validateOpacity = 0;
  if (activeIndex === SECTION_VALIDATE) {
    validateOpacity = currentOpacity;
  } else if (nextIndex === SECTION_VALIDATE) {
    validateTranslateX = buttonEnterDistance * (1 - eased); // Slide in da destra
    validateOpacity = nextOpacity;
  }

  // Determina se mostrare griglia 5 colonne (validate) o 8 colonne
  const isValidateGrid = activeIndex === SECTION_VALIDATE;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: containerWidth || "100%",
          height: "60vh",
          maxWidth: "1536px", // match con max-w-screen-2xl
        }}
      >
        {/* Pulsante GENERATE */}
        <InteractiveButton
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            left: "8rem", // left-16
            transform: `translateX(${generateTranslateX}vw) translateY(-50%)`,
            opacity: generateOpacity,
          }}
          className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:shadow-cyan-500/50"
        >
          generate
        </InteractiveButton>

        {/* Pulsante PREDICT */}
        <InteractiveButton
          onClick={handlePredict}
          disabled={molecules[0] === null || showPredictions || isPredicting}
          style={{
            right: "8rem", // right-16
            transform: `translateX(${predictTranslateX}vw) translateY(-50%)`,
            opacity: predictOpacity,
          }}
          className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:shadow-purple-500/50"
        >
          predict
        </InteractiveButton>

        <InteractiveButton
          onClick={handleTop10}
          disabled={!showPredictions || showTop10} // AGGIUNGI || showTop10
          style={{
            left: "8rem",
            transform: `translateX(${top10TranslateX}vw) translateY(-50%)`,
            opacity: top10Opacity,
          }}
          className="bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 hover:shadow-yellow-500/50"
        >
          select
        </InteractiveButton>

        {/* Pulsante VALIDATE */}
        <InteractiveButton
          onClick={handleValidate}
          disabled={!showTop10}
          style={{
            right: "8rem",
            transform: `translateX(${validateTranslateX}vw) translateY(-50%)`,
            opacity: validateOpacity,
          }}
          className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:shadow-green-500/50"
        >
          validate
        </InteractiveButton>

        {/* Griglia - posizione assoluta al CENTRO, si sposta */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            right: 0, // CAMBIA DA 64 A 0
            transform: `translateX(${gridTranslateX}px) translateY(-50%)`,
            opacity: gridOpacity,
            transition: "none",
            willChange: "transform, opacity",
          }}
        >
          {/* Contenitore relativo per posizionamento assoluto delle celle */}
          <div
            className="relative"
            style={{
              width: isValidateGrid ? GRID_WIDTH_PX_5COL : GRID_WIDTH_PX_8COL,
              height: isValidateGrid
                ? `${2 * 128 + 1 * 12}px`
                : `${3 * 128 + 2 * 12}px`,
            }}
          >
            {molecules.map((mol, idx) => {
              const isTop10 = top10Indices.includes(idx);
              const shouldShow = !isValidateGrid || isTop10;

              if (!shouldShow && isValidateGrid) return null;

              // Calcola posizione nella griglia 8x3
              const col8 = idx % 8;
              const row8 = Math.floor(idx / 8);
              const x8 = col8 * (128 + 1);
              const y8 = row8 * (128 + 1);

              // Calcola posizione nella griglia 5x2 (solo per top10)
              const top10Position = top10Indices.indexOf(idx);
              const col5 = top10Position % 5;
              const row5 = Math.floor(top10Position / 5);
              const x5 = col5 * (128 + 1);
              const y5 = row5 * (128 + 1);

              // Interpola tra le due posizioni
              const isTransitioningToValidate =
                currentIndex === SECTION_SELECT &&
                nextIndex === SECTION_VALIDATE;
              const isTransitioningFromValidate =
                currentIndex === SECTION_VALIDATE &&
                nextIndex === SECTION_SELECT;

              let finalX = x8;
              let finalY = y8;
              let cellOpacity = 1;

              if (activeIndex === SECTION_VALIDATE) {
                finalX = x5;
                finalY = y5;
              } else if (isTransitioningToValidate) {
                if (isTop10) {
                  finalX = x8 + (x5 - x8) * eased;
                  finalY = y8 + (y5 - y8) * eased;
                } else {
                  cellOpacity = 1 - eased;
                }
              } else if (isTransitioningFromValidate && isTop10) {
                finalX = x5 + (x8 - x5) * eased;
                finalY = y5 + (y8 - y5) * eased;
              }

              // Fade out non-top10 quando si transita verso validate
              if (!isTop10 && isTransitioningToValidate) {
                cellOpacity = 1 - eased;
              } else if (!isTop10 && isTransitioningFromValidate) {
                cellOpacity = eased;
              }

              return (
                <div
                  key={idx}
                  className={`absolute w-28 h-28 rounded-lg bg-[#1a1a1a] overflow-hidden flex items-center justify-center ${
                    showTop10 && isTop10 && !isValidateGrid
                      ? "ring-2 ring-orange-500"
                      : ""
                  } ${
                    isValidateGrid && isTop10 && validationResults.length === 0
                      ? "ring-2 ring-orange-500"
                      : ""
                  } ${
                    validationResults.includes(idx)
                      ? "ring-2 ring-green-500"
                      : ""
                  }`}
                  style={{
                    left: `${finalX}px`,
                    top: `${finalY}px`,
                    opacity: cellOpacity,
                    transition: "none",
                    willChange: "left, top, opacity",
                  }}
                >
                  {/* Shimmer effect durante generate */}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/80">
                      <div className="absolute inset-0 shimmer-effect" />
                    </div>
                  )}

                  {/* Molecola generata */}
                  {mol && !isGenerating && (
                    <MoleculeRenderer smiles={mol} size={120} />
                  )}

                  {/* Shimmer durante predict */}
                  {mol && isPredicting && !isGenerating && (
                    <div className="absolute inset-0 bg-black/80">
                      <div className="absolute inset-0 shimmer-effect" />
                    </div>
                  )}

                  {/* Shimmer durante validate */}
                  {mol && isValidating && isValidateGrid && isTop10 && (
                    <div className="absolute inset-0 bg-black/80">
                      <div className="absolute inset-0 shimmer-effect" />
                    </div>
                  )}

                  {/* Predizioni */}
                  {mol && showPredictions && !isGenerating && !isPredicting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 text-xs">
                      <div className="flex items-center justify-between w-full px-2">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CSS per shimmer effect (rimane invariato) */}
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

        .shimmer-effect-green {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(34, 197, 94, 0.3) 50%,
            transparent 100%
          );
          animation: shimmer 1.0s infinite;
        }
      `}</style>

      <ImpactMetrics
        activeIndex={activeIndex}
        scrollIndex={scrollIndex}
        totalSections={totalSections}
      />
    </div>
  );
};

export default InteractiveContent;
