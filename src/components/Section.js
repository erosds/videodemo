import React from 'react';

const Section = ({ section, isActive, totalSections }) => {
  return (
    <section className="w-screen h-full flex flex-col items-center justify-center snap-center px-8">
      <div className="max-w-4xl text-center space-y-6 mt-32">
        <div className="text-gray-500 text-lg">
          Sezione {section.id + 1} di {totalSections}
        </div>
      </div>
    </section>
  );
};

export default Section;