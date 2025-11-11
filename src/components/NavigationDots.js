import React from 'react';

const NavigationDots = ({ sections, activeSection, onNavigate }) => {
  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onNavigate(section.id)}
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
  );
};

export default NavigationDots;