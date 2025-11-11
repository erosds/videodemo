import React from 'react';

const TitleDisplay = ({ sections, activeSection }) => {
  return (
    <div className="fixed top-24 left-0 right-0 z-40 px-12 pointer-events-none">
      <div className="max-w-screen-2xl mx-auto flex items-start justify-between">
        {/* Titolo attivo - in alto a sinistra */}
        <div className="transition-all duration-700 ease-out">
          <h1 className={`
            text-6xl font-bold mb-2 bg-gradient-to-r ${sections[activeSection].gradient} 
            bg-clip-text text-transparent
            transition-all duration-700
          `}>
            {sections[activeSection].title}
          </h1>
          <p className="text-2xl text-gray-300 font-light transition-all duration-700">
            {sections[activeSection].subtitle}
          </p>
        </div>

        {/* Prossimo titolo - in alto a destra, opaco */}
        {activeSection < sections.length - 1 && (
          <div className="transition-all duration-700 ease-out text-right">
            <h1 className="text-6xl font-bold mb-2 text-gray-700 transition-all duration-700">
              {sections[activeSection + 1].title}
            </h1>
            <p className="text-2xl text-gray-700 font-light transition-all duration-700">
              {sections[activeSection + 1].subtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TitleDisplay;