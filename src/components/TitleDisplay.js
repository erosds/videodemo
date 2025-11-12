import React from "react";
import {
  getAnimationProgress,
  ANIMATION_CONFIG,
} from "../utils/animationConfig";

export default function TitleDisplay({
  sections = [],
  scrollIndex = 0,
  activeIndex = 0,
}) {
  const { clamp, easeInOutCubic, colorSwitchStart, colorSwitchEnd } =
    ANIMATION_CONFIG;

  const { currentIndex, nextIndex, absP, currentOpacity, nextOpacity } =
    getAnimationProgress(scrollIndex, activeIndex, sections.length);

  // PARAMETRI DI ANIMAZIONE SPECIFICI PER I TITOLI
  const enterOffsetVW = 60; // distanza iniziale del titolo entrante (vw)
  const exitDistanceVW = 60; // distanza a cui il current esce (vw)

  // Calcolo delle traslazioni per i titoli
  const { direction, eased, exitProgressEased } = getAnimationProgress(
    scrollIndex,
    activeIndex,
    sections.length
  );

  const nextTranslateVW = enterOffsetVW * (1 - eased) * direction;
  const currentTranslateVW = -exitDistanceVW * exitProgressEased * direction;

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

  const current = sections[currentIndex] || null;
  const next = sections[nextIndex] || null;

  return (
    <div className="fixed top-10 left-0 right-0 z-50 px-12 pointer-events-none">
      <div
        className="max-w-screen-2xl mx-auto relative h-28 overflow-visible"
        id="title-container"
      >
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
