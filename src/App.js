import React, { useRef, useState, useEffect } from "react";
import Section from "./components/Section";
import TitleDisplay from "./components/TitleDisplay";
import NavigationDots from "./components/NavigationDots";
import NavigationArrows from "./components/NavigationArrows";
import { sectionsData } from "./data/sectionsData";

export default function App() {
  const [activeIndex, setActiveIndex] = useState(0); // indice intero "attuale"
  const [scrollIndex, setScrollIndex] = useState(0); // indice continuo, es. 1.23
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      // calcola indice continuo
      const w = container.offsetWidth || 1;
      const x = container.scrollLeft;
      const exactIndex = x / w;
      // throttle con requestAnimationFrame
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollIndex(exactIndex);
        // setto activeIndex come floor per tracking dell'intero
        setActiveIndex(Math.floor(Math.max(0, Math.min(sectionsData.length - 1, exactIndex))));
      });
    };

    // inizializza (caso se già scrollato)
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scrollTo = (idx) => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.offsetWidth || 1;
    container.scrollTo({ left: idx * w, behavior: "smooth" });
  };

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* TitleDisplay ora prende lo scrollIndex continuo */}
      <TitleDisplay sections={sectionsData} scrollIndex={scrollIndex} />

      {/* Horizontal Scroll */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-x-scroll overflow-y-hidden scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex h-full" style={{ width: `${sectionsData.length * 100}vw` }}>
          {sectionsData.map((s) => (
            <Section key={s.id} section={s} isActive={activeIndex === s.id} totalSections={sectionsData.length} />
          ))}
        </div>
      </div>

      <NavigationDots sections={sectionsData} activeSection={activeIndex} onNavigate={scrollTo} />
      <NavigationArrows activeSection={activeIndex} totalSections={sectionsData.length} onNavigate={scrollTo} />

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
