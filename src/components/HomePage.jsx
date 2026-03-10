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

          // MoleculeFinder row: main button + vertical connector + 3 case shortcuts
          return (
            <div key="moleculeFinder" className="flex items-stretch">

              {/* Main button */}
              <button
                onClick={() => onSelectWorkflow('moleculeFinder')}
                className={`flex-1 px-8 py-5 rounded-xl text-white
                  bg-gradient-to-r ${workflow.gradient}
                  hover:shadow-2xl hover:scale-[1.03] transition-all duration-300`}
              >
                <div className="text-lg font-semibold">{workflow.label}</div>
                <div className="text-xs font-normal opacity-70 mt-0.5">{workflow.tagline}</div>
              </button>

              {/* Horizontal bridge */}
              <div className="w-4 self-stretch flex items-center flex-shrink-0">
                <div className="w-full h-px bg-rose-800/40" />
              </div>

              {/* Vertical connector + case buttons */}
              <div className="flex items-stretch flex-shrink-0">
                {/* Vertical bar with horizontal ticks */}
                <div className="relative w-2.5 self-stretch flex-shrink-0">
                  {/* Vertical line */}
                  <div className="absolute left-0 top-[18%] bottom-[18%] w-px bg-rose-800/35" />
                  {/* One tick per case, evenly distributed */}
                  {mfCaseSections.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 w-2.5 h-px bg-rose-800/35"
                      style={{ top: `${18 + i * (64 / (mfCaseSections.length - 1 || 1))}%` }}
                    />
                  ))}
                </div>

                {/* Case buttons */}
                <div className="flex flex-col gap-1.5 justify-center w-44">
                  {mfCaseSections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectWorkflow('moleculeFinder', c.id)}
                      className="px-3 py-[7px] rounded-lg text-left bg-black/50 border border-rose-900/40
                        text-rose-300/75 text-[10px] leading-tight
                        hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-700/50
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
