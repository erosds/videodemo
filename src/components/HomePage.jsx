import { workflows as workflowsData } from '../data/workflowsData';

// Pull the "case:" sections dynamically from workflowsData so names stay in sync
const mfCaseSections = (workflowsData.moleculeFinder?.sections ?? [])
  .filter(s => /^case:/i.test(s.title));

const HomePage = ({ onSelectWorkflow }) => {
  const workflowsList = [
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
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto overflow-visible"
      style={{ paddingTop: 120 }}
    >
      <div className="flex flex-col gap-3 w-full max-w-xl px-8">
        {workflowsList.map((workflow) => {
          if (workflow.id !== 'moleculeFinder') {
            return (
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
            );
          }

          // MoleculeFinder: full-width button (same as others) + case shortcuts
          // floating to the right, outside the column
          return (
            <div key="moleculeFinder" className="relative">

              {/* Main button — same dimensions as every other workflow button */}
              <button
                onClick={() => onSelectWorkflow('moleculeFinder')}
                className={`w-full px-8 py-5 rounded-xl text-white
                  bg-gradient-to-r ${workflow.gradient}
                  hover:shadow-2xl hover:scale-[1.03] transition-all duration-300`}
              >
                <div className="text-lg font-semibold">{workflow.label}</div>
                <div className="text-xs font-normal opacity-70 mt-0.5">{workflow.tagline}</div>
              </button>

              {/* Case panel — absolutely positioned outside the column, to the right */}
              <div className="absolute top-0 bottom-0 left-full flex items-stretch pointer-events-auto">

                {/* Horizontal bridge */}
                <div className="w-5 flex items-center flex-shrink-0">
                  <div className="w-full h-px bg-gray-600/50" />
                </div>

                {/* Vertical bar with ticks */}
                <div className="relative w-2.5 self-stretch flex-shrink-0">
                  <div className="absolute left-0 top-[18%] bottom-[18%] w-px bg-gray-600/40" />
                  {mfCaseSections.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 w-2.5 h-px bg-gray-600/40"
                      style={{ top: `${18 + i * (64 / (mfCaseSections.length - 1 || 1))}%` }}
                    />
                  ))}
                </div>

                {/* Case buttons */}
                <div className="flex flex-col gap-1.5 justify-center w-44 pl-1.5">
                  {mfCaseSections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectWorkflow('moleculeFinder', c.id)}
                      className="px-3 py-[7px] rounded-lg text-left bg-black/50 border border-gray-700/50
                        text-gray-400/80 text-[10px] leading-tight
                        hover:bg-gray-800/60 hover:text-gray-200 hover:border-gray-500/60
                        transition-all duration-200"
                    >
                      {c.title.replace(/^case:\s*/i, '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
