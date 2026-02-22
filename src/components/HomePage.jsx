const HomePage = ({ onSelectWorkflow }) => {
  const workflows = [
    {
      id: 'materialsInformatics',
      label: 'MaterialsAI',
      tagline: 'materials informatics workflow',
      gradient: 'from-purple-600 via-pink-600 to-red-600'
    },
    {
      id: 'digitalTwin',
      label: 'PredictLab',
      tagline: 'testing station for predictive models',
      gradient: 'from-cyan-600 via-blue-600 to-indigo-600'
    },
    {
      id: 'neuralSafety',
      label: 'DeepSpectrum',
      tagline: 'spectra matching with AI',
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
            className={`w-full px-12 py-6 rounded-xl text-white
              bg-gradient-to-r ${workflow.gradient}
              hover:shadow-2xl hover:scale-105 transition-all duration-300`}
          >
            <div className="text-2xl font-semibold">{workflow.label}</div>
            {workflow.tagline && (
              <div className="text-sm font-normal opacity-75 mt-1">{workflow.tagline}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;