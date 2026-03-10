const HomePage = ({ onSelectWorkflow }) => {
  const workflows = [
    {
      id: 'materialsInformatics',
      label: 'MaterialsFlow',
      tagline: 'materials informatics workflow',
      gradient: 'from-purple-600 via-pink-600 to-red-600'
    },
    {
      id: 'predictLab',
      label: 'PredictLab',
      tagline: 'testing station for predictive models',
      gradient: 'from-cyan-600 via-blue-600 to-indigo-600'
    },
    {
      id: 'deepSpectrum',
      label: 'DeepSpectrum',
      tagline: 'spectra matching with AI',
      gradient: 'from-amber-600 via-orange-600 to-red-600'
    },
    {
      id: 'moleculeFinder',
      label: 'MoleculeFinder',
      tagline: 'AI-driven molecular design & optimization',
      gradient: 'from-rose-600 via-pink-500 to-fuchsia-600'
    },
    {
      id: 'chemicalCompliance',
      label: 'ChemAssistant',
      tagline: 'local RAG for chemical QA/QC compliance',
      gradient: 'from-green-600 via-emerald-500 to-teal-600'
    },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto"
      style={{ paddingTop: 120 }}>
      <div className="flex flex-col gap-3 w-full max-w-xl px-8">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            onClick={() => onSelectWorkflow(workflow.id)}
            className={`w-full px-8 py-5 rounded-xl text-white
              bg-gradient-to-r ${workflow.gradient}
              hover:shadow-2xl hover:scale-[1.03] transition-all duration-300`}
          >
            <div className="text-lg font-semibold">{workflow.label}</div>
            {workflow.tagline && (
              <div className="text-xs font-normal opacity-70 mt-0.5">{workflow.tagline}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;