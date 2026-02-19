import React from "react";
import { getAnimationProgress } from "../utils/animationConfig";

export default function TitleDisplay({
  sections = [],
  scrollIndex = 0,
  activeIndex = 0,
  showBackButton = false,
}) {
  const { currentIndex, nextIndex, absP, currentOpacity, nextOpacity } =
    getAnimationProgress(scrollIndex, activeIndex, sections.length);

  const current = sections[currentIndex] || null;
  const next = sections[nextIndex] || null;

  return (
    <div className="fixed top-10 left-0 right-0 z-50 px-12 pointer-events-none">
      <div className="max-w-screen-2xl mx-auto relative h-28" style={{ minWidth: "800px" }}>

        {current && (
          <div
            className="absolute left-0 top-0 w-full"
            style={{ opacity: currentOpacity }}
          >
            <h1 className="text-6xl font-bold" style={{ margin: 0 }}>
              <span
                className={`bg-gradient-to-r ${current.gradient}`}
                style={{ backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                {current.title}
              </span>
            </h1>
            <p
              className="text-2xl text-gray-300 font-light"
              dangerouslySetInnerHTML={{ __html: current.subtitle }}
              style={{ margin: 0, marginTop: "0.5rem" }}
            />
          </div>
        )}

        {next && absP > 0 && (
          <div
            className="absolute left-0 top-0 w-full"
            style={{ opacity: nextOpacity }}
          >
            <h1 className="text-6xl font-bold" style={{ margin: 0 }}>
              <span
                className={`bg-gradient-to-r ${next.gradient}`}
                style={{ backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                {next.title}
              </span>
            </h1>
            <p
              className="text-2xl text-gray-300 font-light"
              dangerouslySetInnerHTML={{ __html: next.subtitle }}
              style={{ margin: 0, marginTop: "0.5rem" }}
            />
          </div>
        )}

      </div>
    </div>
  );
}
