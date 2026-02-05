import React from "react";

const NavigationDots = ({ sections, activeSection, onNavigate }) => {
  return (
    /* Rimosse le classi fixed, bottom, left, transform ecc. */
    /* Ora il componente è un semplice contenitore flex che segue il flusso del padre */
    <div className="flex gap-2 items-center">
      {sections.map((section, index) => (
        <button
          key={section.id || index}
          onClick={() => onNavigate(index)}
          className={`
            h-2 rounded-full transition-all duration-300
            ${
              activeSection === index
                ? "bg-white w-8"
                : "bg-gray-600 hover:bg-gray-400 w-2"
            }
          `}
          aria-label={`Vai alla sezione ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default NavigationDots;
