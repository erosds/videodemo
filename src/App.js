import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [activeSection, setActiveSection] = useState(0);
  const [activeMenu, setActiveMenu] = useState('home');
  const scrollContainerRef = useRef(null);

  const menuItems = [
    { id: 'home', label: 'Home' },
    { id: 'features', label: 'Funzionalità' },
    { id: 'design', label: 'Design' },
    { id: 'tech', label: 'Tecnologia' },
    { id: 'contatti', label: 'Contatti' }
  ];

  const sections = [
    {
      id: 0,
      title: 'Il Futuro è Qui',
      subtitle: 'Innovazione senza compromessi',
      gradient: 'from-purple-600 via-pink-600 to-red-600'
    },
    {
      id: 1,
      title: 'Design Rivoluzionario',
      subtitle: 'Eleganza che incontra la funzionalità',
      gradient: 'from-blue-600 via-cyan-600 to-teal-600'
    },
    {
      id: 2,
      title: 'Prestazioni Eccezionali',
      subtitle: 'Potenza senza limiti',
      gradient: 'from-orange-600 via-red-600 to-pink-600'
    },
    {
      id: 3,
      title: 'Esperienza Unica',
      subtitle: 'Pensato per te',
      gradient: 'from-green-600 via-emerald-600 to-teal-600'
    },
    {
      id: 4,
      title: 'Sostenibilità',
      subtitle: 'Un impegno per il pianeta',
      gradient: 'from-indigo-600 via-purple-600 to-pink-600'
    }
  ];

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
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-screen-2xl mx-auto px-8 py-4 flex items-center justify-between">
          {/* Logo con gradiente */}
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            ProPresent
          </div>

          {/* Menu Items */}
          <div className="flex items-center gap-8">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`
                  text-lg font-medium transition-all duration-300 relative
                  ${activeMenu === item.id 
                    ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent' 
                    : 'text-gray-400 hover:text-white'
                  }
                `}
              >
                {item.label}
                {activeMenu === item.id && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Horizontal Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-x-scroll overflow-y-hidden scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex h-full" style={{ width: `${sections.length * 100}vw` }}>
          {sections.map((section) => (
            <section
              key={section.id}
              className="w-screen h-full flex flex-col items-center justify-center snap-center px-8"
            >
              <div className="max-w-4xl text-center space-y-6">
                <h1 className={`
                  text-7xl font-bold mb-4 bg-gradient-to-r ${section.gradient} 
                  bg-clip-text text-transparent animate-pulse
                `}>
                  {section.title}
                </h1>
                <p className="text-3xl text-gray-400 font-light">
                  {section.subtitle}
                </p>
                
                <div className="mt-12 text-gray-500 text-lg">
                  Sezione {section.id + 1} di {sections.length}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Indicatori di navigazione (pallini) */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${activeSection === section.id 
                ? 'bg-white w-8' 
                : 'bg-gray-600 hover:bg-gray-400'
              }
            `}
            aria-label={`Vai alla sezione ${section.id + 1}`}
          />
        ))}
      </div>

      {/* Freccia sinistra */}
      {activeSection > 0 && (
        <button
          onClick={() => scrollToSection(activeSection - 1)}
          className="fixed left-8 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      {/* Freccia destra */}
      {activeSection < sections.length - 1 && (
        <button
          onClick={() => scrollToSection(activeSection + 1)}
          className="fixed right-8 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

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