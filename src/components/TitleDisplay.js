import React from 'react';

const TitleDisplay = ({ sections, activeSection, scrollProgress }) => {
  return (
    <div className="fixed top-24 left-0 right-0 z-40 px-12 pointer-events-none">
      <div className="max-w-screen-2xl mx-auto flex items-start justify-between">
        {/* Titolo attivo */}
        <div 
          style={{
            opacity: 1 - scrollProgress,
            transform: `translateX(-${scrollProgress * 50}px)`
          }}
        >
          <h1 className={`text-6xl font-bold mb-2 bg-gradient-to-r ${sections[activeSection].gradient} bg-clip-text text-transparent`}>
            {sections[activeSection].title}
          </h1>
          <p className="text-2xl text-gray-300 font-light">
            {sections[activeSection].subtitle}
          </p>
        </div>

        {/* Prossimo titolo */}
        {activeSection < sections.length - 1 && (
          <div 
            style={{
              opacity: scrollProgress * 0.7,
              transform: `translateX(${(1 - scrollProgress) * 50}px)`
            }}
          >
            <h1 className="text-6xl font-bold mb-2 text-gray-700">
              {sections[activeSection + 1].title}
            </h1>
            <p className="text-2xl text-gray-700 font-light">
              {sections[activeSection + 1].subtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TitleDisplay;