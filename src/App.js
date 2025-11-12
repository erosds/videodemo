import React, { useRef, useState, useEffect, useCallback } from "react";
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
        Math.round(Math.max(0, Math.min(sectionsData.length - 1, exactIndex)))
      );
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Inizializza
    onScrollHandler();

    // Event listeners
    container.addEventListener("scroll", onScrollHandler, { passive: true });

    // Resize -> ricalcola (perché clientWidth cambia)
    const onResize = () => {
      // forziamo ricalcolo dello scrollIndex in base alla nuova width
      onScrollHandler();
    };
    window.addEventListener("resize", onResize);

    // Keyboard navigation (quando il container è a fuoco)
    const onKey = (e) => {
      if (e.key === "ArrowRight") {
        scrollTo(Math.min(sectionsData.length - 1, activeIndex + 1));
      } else if (e.key === "ArrowLeft") {
        scrollTo(Math.max(0, activeIndex - 1));
      }
    };
    // aggiunto al window così funziona anche se il container non ha focus; se preferisci limitare al container,
    // attacca l'handler solo quando container ha tabindex e focus.
    window.addEventListener("keydown", onKey);

    return () => {
      container.removeEventListener("scroll", onScrollHandler);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onScrollHandler, activeIndex]);

  const scrollTo = (idx) => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 1;
    container.scrollTo({ left: idx * w, behavior: "smooth" });
  };

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* TitleDisplay ora prende lo scrollIndex continuo */}
      <TitleDisplay
        sections={sectionsData}
        scrollIndex={scrollIndex}
        activeIndex={activeIndex}
      />

      {/* Horizontal Scroll */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-x-scroll overflow-y-hidden scroll-smooth snap-x snap-mandatory no-scrollbar"
        style={{ msOverflowStyle: "none" }}
        // per accessibilità se vuoi che il container prenda focus:
        // tabIndex={0}
        role="region"
        aria-label="Sezioni orizzontali"
      >
        <div
          className="flex h-full"
          style={{ width: `${sectionsData.length * 100}vw` }}
        >
          {sectionsData.map((s, i) => (
            // Assicuriamoci che il wrapper abbia snap-start; evita confusione con Section che potrebbe non averla
            <div
              key={s.id ?? i}
              className="w-screen snap-start h-full flex-shrink-0"
            >
              <Section
                section={s}
                isActive={activeIndex === i}
                totalSections={sectionsData.length}
                index={i}
              />
            </div>
          ))}
        </div>
      </div>

      <NavigationDots
        sections={sectionsData}
        activeSection={activeIndex}
        onNavigate={scrollTo}
      />
      <NavigationArrows
        activeSection={activeIndex}
        totalSections={sectionsData.length}
        onNavigate={scrollTo}
      />

      <style>{`
        /* Nascondi scrollbar solo per il container con classe .no-scrollbar */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
