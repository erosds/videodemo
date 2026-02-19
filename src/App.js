import React, { useRef, useState, useEffect, useCallback } from "react";
import SectionDem from "./components/SectionDem";
import TitleDisplay from "./components/TitleDisplay";
import NavigationDots from "./components/NavigationDots";
import NavigationArrows from "./components/NavigationArrows";
import HomePage from "./components/HomePage";
import InteractiveContent from "./components/MaterialsInformatics/InteractiveContent";
import DigitalTwinContent from "./components/DigitalTwin/DigitalTwinContent";
import { workflows } from "./data/workflowsData";

export default function App() {
  const [currentWorkflow, setCurrentWorkflow] = useState("home");
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollIndex, setScrollIndex] = useState(0);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  const currentSections = workflows[currentWorkflow]?.sections || [];

  const onScrollHandler = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 1;
    const x = container.scrollLeft;
    const exactIndex = x / w;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setScrollIndex(exactIndex);
      setActiveIndex(
        Math.round(
          Math.max(0, Math.min(currentSections.length - 1, exactIndex)),
        ),
      );
    });
  }, [currentSections.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    onScrollHandler();
    container.addEventListener("scroll", onScrollHandler, { passive: true });

    const onResize = () => {
      onScrollHandler();
    };
    window.addEventListener("resize", onResize);

    const onKey = (e) => {
      if (currentWorkflow === "home") return; // Disabilita navigazione keyboard su home

      if (e.key === "ArrowRight") {
        scrollToSection(Math.min(currentSections.length - 1, activeIndex + 1));
      } else if (e.key === "ArrowLeft") {
        scrollToSection(Math.max(0, activeIndex - 1));
      } else if (e.key === "Escape") {
        handleBackToHome();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      container.removeEventListener("scroll", onScrollHandler);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onScrollHandler, activeIndex, currentWorkflow, currentSections.length]);

  const scrollToSection = (idx) => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.offsetWidth || 1;
    const start = container.scrollLeft;
    const end = idx * w;
    const distance = end - start;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      container.scrollLeft = start + distance * progress;

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  const handleSelectWorkflow = (workflowId) => {
    setCurrentWorkflow(workflowId);
    setActiveIndex(0);
    setScrollIndex(0);
    // Reset scroll position
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  };

  const handleBackToHome = () => {
    setCurrentWorkflow("home");
    setActiveIndex(0);
    setScrollIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  };

  const isHome = currentWorkflow === "home";

  return (
    <div className="h-screen w-screen bg-[#111111] text-white overflow-hidden relative">
      <TitleDisplay
        sections={currentSections}
        scrollIndex={scrollIndex}
        activeIndex={activeIndex}
        showBackButton={!isHome}
      />

      <div
        ref={containerRef}
        className="h-full w-full overflow-x-scroll overflow-y-hidden snap-x snap-mandatory no-scrollbar"
      >
        <div
          className="flex h-full"
          style={{ width: `${currentSections.length * 100}vw` }}
        >
          {currentSections.map((s, i) => (
            <div
              key={`${currentWorkflow}-${s.id ?? i}`}
              className="w-screen snap-start h-full flex-shrink-0"
            >
              <SectionDem
                section={s}
                isActive={activeIndex === i}
                totalSections={currentSections.length}
                index={i}
              />
            </div>
          ))}
        </div>
      </div>

      {isHome && <HomePage onSelectWorkflow={handleSelectWorkflow} />}

      {currentWorkflow === "materialsInformatics" && (
        <InteractiveContent
          activeIndex={activeIndex}
          scrollIndex={scrollIndex}
          totalSections={currentSections.length}
        />
      )}

      {currentWorkflow === "digitalTwin" && (
        <DigitalTwinContent
          activeIndex={activeIndex}
          scrollIndex={scrollIndex}
          totalSections={currentSections.length}
        />
      )}

      {!isHome && (
        <>
          <NavigationArrows
            activeSection={activeIndex}
            totalSections={currentSections.length}
            onNavigate={scrollToSection}
          />

          {/* Barra di navigazione integrata: Home + Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 z-50">
            <button
              onClick={handleBackToHome}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <svg
                className="w-4 h-4 text-white/80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </button>

            <NavigationDots
              sections={currentSections}
              activeSection={activeIndex}
              onNavigate={scrollToSection}
            />
          </div>
        </>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
