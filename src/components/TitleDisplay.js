import React, { useMemo } from "react";

/*
  Comportamento e parametri:
  - scrollIndex: numero continuo (0..n-1) passato da App (scrollLeft / width)
  - currentIndex = floor(scrollIndex)
  - progress = scrollIndex - currentIndex   (0..1)
  - new/titleNext entra da destra a partire da enterOffsetVW (es. 60vw -> 0)
  - quando progress > exitTrigger (es. 0.45) il titolo corrente inizia a uscire verso sinistra
  - crossfade: currentOpacity decresce, nextGray -> nextColor inversione di opacità
*/

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function TitleDisplay({ sections = [], scrollIndex = 0 }) {
  // indice intero "corrente" e progressione 0..1
  const currentIndex = Math.floor(clamp(scrollIndex, 0, Math.max(0, sections.length - 1)));
  const rawProgress = clamp(scrollIndex - currentIndex, 0, 1);
  const p = rawProgress; // 0..1
  const eased = easeInOutCubic(p);

  // Parametri regolabili
  const enterOffsetVW = 60; // da quanti vw parte il nuovo titolo (a destra)
  const exitDistanceVW = 60; // di quanti vw esce il titolo corrente verso sinistra
  const exitTrigger = 0.45; // dopo quale progress il corrente inizia a spostarsi via
  const colorSwitchStart = 0.5; // quando inizia la transizione da opaco->colorato per il nuovo
  const colorSwitchEnd = 1.0; // fine transizione

  const current = sections[currentIndex] || null;
  const next = sections[currentIndex + 1] || null;

  // Calcoli posizioni in vw (translateX)
  // next starts at +enterOffsetVW, ends at 0 when p===1
  const nextTranslateVW = enterOffsetVW * (1 - eased); // p=0 -> enterOffsetVW; p=1 -> 0
  // current stays at 0 until progress > exitTrigger, poi si muove linearmente fino -exitDistanceVW
  const exitProgress = clamp((p - exitTrigger) / (1 - exitTrigger), 0, 1);
  const currentTranslateVW = -exitDistanceVW * easeInOutCubic(exitProgress);

  // opacities:
  // currentOpacity: from 1 -> 0 as exitProgress goes 0->1 (smoothed)
  const currentOpacity = clamp(1 - easeInOutCubic(exitProgress), 0, 1);

  // next has two layers:
  // - nextGray: starts at 1 and goes to 0 as colorSwitch progresses
  // - nextColor: starts at 0 and goes to 1
  const colorSwitchProgress = clamp((p - colorSwitchStart) / (colorSwitchEnd - colorSwitchStart), 0, 1);
  const colorEased = easeInOutCubic(colorSwitchProgress);
  const nextGrayOpacity = clamp(1 - colorEased, 0, 1) * 0.95; // rimane un filo opaco all'inizio
  const nextColorOpacity = clamp(colorEased, 0, 1);

  // styles inlined (usiamo vw per spostamenti indipendenti dalla larghezza del container)
  const currentStyle = {
    transform: `translateX(${currentTranslateVW}vw)`,
    opacity: currentOpacity,
    transition: "transform 0.08s linear, opacity 0.08s linear",
    willChange: "transform, opacity",
  };

  const nextStyleCommon = {
    transform: `translateX(${nextTranslateVW}vw)`,
    transition: "transform 0.08s linear, opacity 0.08s linear",
    willChange: "transform, opacity",
  };

  // Container con overflow hidden in modo che i titoli "escano" puliti
  return (
    <div className="fixed top-24 left-0 right-0 z-50 px-12 pointer-events-none">
      <div className="max-w-screen-2xl mx-auto relative h-28 overflow-hidden">
        {/* CURRENT title - sinistra (colorato) */}
        {current && (
          <div
            className="absolute left-0 top-0"
            style={{ ...currentStyle, width: "100%" }}
          >
            <h1
              className={`text-6xl font-bold mb-2 bg-gradient-to-r ${current.gradient} bg-clip-text text-transparent`}
              style={{ margin: 0 }}
            >
              {current.title}
            </h1>
            <p className="text-2xl text-gray-300 font-light" style={{ margin: 0 }}>
              {current.subtitle}
            </p>
          </div>
        )}

        {/* NEXT title - layer opaco (grigio) */}
        {next && (
          <div
            className="absolute left-0 top-0"
            style={{ ...nextStyleCommon, width: "100%", opacity: nextGrayOpacity }}
          >
            <h1 className="text-6xl font-bold mb-2 text-gray-400" style={{ margin: 0 }}>
              {next.title}
            </h1>
            <p className="text-2xl text-gray-400 font-light" style={{ margin: 0 }}>
              {next.subtitle}
            </p>
          </div>
        )}

        {/* NEXT title - layer colorato sopra, animato da opacità 0->1 */}
        {next && (
          <div
            className="absolute left-0 top-0"
            style={{ ...nextStyleCommon, width: "100%", opacity: nextColorOpacity }}
          >
            <h1
              className={`text-6xl font-bold mb-2 bg-gradient-to-r ${next.gradient} bg-clip-text text-transparent`}
              style={{ margin: 0 }}
            >
              {next.title}
            </h1>
            <p className="text-2xl text-gray-300 font-light" style={{ margin: 0 }}>
              {next.subtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
