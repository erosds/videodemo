import React from "react";

const HomePage = ({ onSelectWorkflow }) => {
  const workflows = [
    {
      id: 'materialsInformatics',
      label: 'materials informatics workflow',
      gradient: 'from-purple-600 via-pink-600 to-red-600'
    },
    {
      id: 'digitalTwin',
      label: 'testing station for predictive models',
      gradient: 'from-cyan-600 via-blue-600 to-indigo-600'
    },
    {
      id: 'foodBeverage',
      label: 'testing station for...',
      gradient: 'from-amber-600 via-orange-600 to-red-600'
    },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
      <div className="flex flex-col gap-6 w-full max-w-2xl px-8">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            onClick={() => onSelectWorkflow(workflow.id)}
            className={`w-full px-12 py-6 rounded-xl text-white text-2xl font-semibold 
              bg-gradient-to-r ${workflow.gradient} 
              hover:shadow-2xl hover:scale-105 transition-all duration-300`}
          >
            {workflow.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;