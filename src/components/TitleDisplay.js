import React from "react";

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) => 1 - Math.pow(1 - t, 3); // curva veloce → lenta

export default function TitleDisplay({
  sections = [],
  scrollIndex = 0,
  activeIndex = 0,
}) {
  // Anchor stabile: activeIndex (deve venire da App, es. Math.round(exactIndex))
  const currentIndex = Math.max(0, Math.min(sections.length - 1, activeIndex));

  // Progress signed e assoluto
  const signedProgress = scrollIndex - currentIndex; // negativo quando scendi
  const direction = signedProgress === 0 ? 0 : Math.sign(signedProgress); // 1 avanti, -1 indietro
  const absP = clamp(Math.abs(signedProgress), 0, 1);
  const eased = easeInOutCubic(absP);

  // Parametri di animazione (modificabili)
  const enterOffsetVW = 60; // distanza iniziale del titolo entrante (vw)
  const exitDistanceVW = 60; // distanza a cui il current esce (vw)
  const exitTrigger = 0.6; // quando inizia la fase di "exit"
  const colorSwitchStart = 0.1;
  const colorSwitchEnd = 0.95;

  const current = sections[currentIndex] || null;
  const nextIndex = direction >= 0 ? currentIndex + 1 : currentIndex - 1;
  const next = sections[nextIndex] || null;

  // Traslazioni X: tengono conto della direction
  const nextTranslateVW = enterOffsetVW * (1 - eased) * direction; // entra da destra (dir=1) o da sinistra (dir=-1)
  const exitProgress = clamp((absP - exitTrigger) / (1 - exitTrigger), 0, 1);
  const currentTranslateVW =
    -exitDistanceVW * easeInOutCubic(exitProgress) * direction; // esce nella direzione dello scroll

  // Opacità current
  const currentOpacity = clamp(1 - easeInOutCubic(exitProgress), 0, 1);

  // Opacità next: fade in graduale durante l'animazione
  const nextOpacity = easeInOutCubic(absP);

  // Color interpolation per next (crossfade)
  const colorSwitchProgress = clamp(
    (absP - colorSwitchStart) / (colorSwitchEnd - colorSwitchStart),
    0,
    1
  );
  const colorEased = easeInOutCubic(colorSwitchProgress);

  // Sottotitoli (usa absP per animazioni simmetriche)
  // Current subtitle (quello che sta uscendo): scompare nei primi 20% dell'animazione
  const currentSubtitleProgress = clamp(1 - absP / 0.2, 0, 1);
  const currentSubtitleEased = easeInOutCubic(currentSubtitleProgress);
  const currentSubtitleTranslateY = -20 * (1 - currentSubtitleEased);
  const currentSubtitleOpacity = currentSubtitleEased;

  // Entering subtitle: appare negli ultimi 20% dell'animazione
  const enteringSubtitleProgress = clamp((absP - 0.8) / 0.2, 0, 1);
  const enteringSubtitleEased = easeInOutCubic(enteringSubtitleProgress);
  const enteringSubtitleTranslateY = -20 * (1 - enteringSubtitleEased);
  const enteringSubtitleOpacity = enteringSubtitleEased;

  return (
    <div className="fixed top-24 left-0 right-0 z-50 px-12 pointer-events-none">
      <div className="max-w-screen-2xl mx-auto relative h-28 overflow-visible">
        {/* CURRENT title */}
        {current && (
          <div
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateX(${currentTranslateVW}vw)`,
              opacity: currentOpacity,
              willChange: "transform, opacity",
            }}
            aria-live="polite"
          >
            <h1
              role="heading"
              aria-level={1}
              className="text-6xl font-bold"
              style={{
                margin: 0,
              }}
            >
              <span
                className={`bg-gradient-to-r ${current.gradient}`}
                style={{
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {current.title}
              </span>
            </h1>

            {/* Sottotitolo del current */}
            <p
              className="text-2xl text-gray-300 font-light"
              style={{
                margin: 0,
                marginTop: "0.5rem",
                transform: `translateY(${currentSubtitleTranslateY}px)`,
                opacity: currentSubtitleOpacity,
                willChange: "transform, opacity",
              }}
            >
              {current.subtitle}
            </p>
          </div>
        )}

        {/* NEXT title */}
        {next && absP > 0 && (
          <div
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateX(${nextTranslateVW}vw)`,
              opacity: nextOpacity,
              willChange: "transform, opacity",
            }}
          >
            {/* Crossfade: layer grigio decorativo */}
            <h1
              aria-hidden="true"
              className="text-6xl font-bold text-gray-400 absolute top-0 left-0"
              style={{
                margin: 0,
                opacity: 1 - colorEased,
                transform: "translateZ(0)",
              }}
            >
              {next.title}
            </h1>

            {/* Layer colorato decorativo */}
            <h1
              aria-hidden="true"
              className="text-6xl font-bold absolute top-0 left-0"
              style={{
                margin: 0,
                opacity: colorEased,
                transform: "translateZ(0)",
              }}
            >
              <span
                className={`bg-gradient-to-r ${next.gradient}`}
                style={{
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {next.title}
              </span>
            </h1>

            {/* Sottotitolo entrante (semantico) */}
            <p
              className="text-2xl text-gray-300 font-light"
              style={{
                margin: 0,
                marginTop: "0.5rem",
                transform: `translateY(${enteringSubtitleTranslateY}px)`,
                opacity: enteringSubtitleOpacity,
                willChange: "transform, opacity",
              }}
            >
              {next.subtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
