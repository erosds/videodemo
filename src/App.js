import React, { useState, useRef, useEffect } from 'react';
import Section from './components/Section';
import TitleDisplay from './components/TitleDisplay';
import NavigationDots from './components/NavigationDots';
import NavigationArrows from './components/NavigationArrows';
import { sectionsData } from './data/sectionsData';

function App() {
  const [activeSection, setActiveSection] = useState(0);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const sectionWidth = scrollContainerRef.current.offsetWidth;
        const currentSection = Math.round(scrollLeft / sectionWidth);
        setActiveSection(currentSection);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToSection = (index) => {
    if (scrollContainerRef.current) {
      const sectionWidth = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: sectionWidth * index,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden">
      {/* Titoli con transizione */}
      <TitleDisplay sections={sectionsData} activeSection={activeSection} />

      {/* Horizontal Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-x-scroll overflow-y-hidden scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex h-full" style={{ width: `${sectionsData.length * 100}vw` }}>
          {sectionsData.map((section) => (
            <Section
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
              totalSections={sectionsData.length}
            />
          ))}
        </div>
      </div>

      {/* Navigazione con pallini */}
      <NavigationDots
        sections={sectionsData}
        activeSection={activeSection}
        onNavigate={scrollToSection}
      />

      {/* Frecce di navigazione */}
      <NavigationArrows
        activeSection={activeSection}
        totalSections={sectionsData.length}
        onNavigate={scrollToSection}
      />

      {/* Nascondi scrollbar */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default App;