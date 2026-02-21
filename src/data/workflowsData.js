// Definizione di tutti i flussi disponibili
export const workflows = {
  home: {
    id: 'home',
    sections: [
      {
        id: 0,
        title: "personal demo space",
        subtitle: "Select a workflow to explore",
        gradient: "from-slate-200 via-gray-300 to-gray-400",
      }
    ]
  },
  materialsInformatics: {
    id: 'materialsInformatics',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "Imagine you want to discover <strong>new materials</strong>. You would start from existing ones and change their structure one at a time, testing each variation to see if it has the desired properties. This is <strong>slow and expensive</strong>. Now, imagine if you had a tool that could optimize the entire process, accelerating the discovery of new materials with desired properties. This is where <strong>AI comes in</strong>.",
        gradient: "from-purple-600 via-pink-600 to-red-600",
      },
      {
        id: 1,
        title: "generate",
        subtitle: "Leverage <strong>combinatorial and data-driven techniques</strong> to explore vast chemical spaces and identify promising candidates based on desired structures. Use <strong>GenAI models</strong> to create novel material structures with desired properties.",
        gradient: "from-blue-600 via-cyan-600 to-teal-600",
      },
      {
        id: 2,
        title: "predict",
        subtitle: "Trained on <strong>extensive and modern datasets</strong>, advanced Machine Learning and Deep Learning models can <strong>accurately predict material properties</strong>, enabling rapid screening of candidates.",
        gradient: "from-orange-600 via-red-600 to-pink-600",
      },
      {
        id: 3,
        title: "select",
        subtitle: "Select top candidates based on <strong>target criteria</strong> such as conductivity, stability, toxicity, or binding affinity. Focus resources on <strong>high-potential molecules</strong> that meet specific requirements.",
        gradient: "from-yellow-600 via-amber-600 to-orange-600",
      },
      {
        id: 4,
        title: "validate",
        subtitle: "Scientists validate candidates through <strong>computational chemistry and laboratory experiments</strong>. The advantage: testing only a <strong>reduced number of high-potential candidates</strong> instead of thousands of compounds.",
        gradient: "from-green-600 via-emerald-600 to-teal-600",
      },
      {
        id: 5,
        title: "industries",
        subtitle: "Materials informatics is transforming <strong>multiple sectors</strong>, from automotive to pharmaceuticals, enabling <strong>targeted innovation</strong> and competitive advantages.",
        gradient: "from-blue-600 via-cyan-600 to-teal-600",
      },
      {
        id: 6,
        title: "impact",
        subtitle: "<strong>Accelerate the innovation</strong> and reduce time and cost of material discovery; enable the development of <strong>targeted materials</strong> for various applications such as <strong>energy storage, pharmaceutics, catalysis, and electronics</strong>.",
        gradient: "from-indigo-600 via-purple-600 to-pink-600",
      },
    ]
  },
  neuralSafety: {
    id: 'neuralSafety',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "Food & Beverage workflow overview - <strong>Content coming soon</strong>",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      }
    ]
  },
  digitalTwin: {
    id: 'digitalTwin',
    sections: [
      {
        id: 0,
        title: "select dataset",
        subtitle: "Choose a <strong>dataset</strong> to begin your machine learning workflow",
        gradient: "from-cyan-600 via-blue-600 to-indigo-600",
      },
      {
        id: 1,
        title: "choose models",
        subtitle: "Select one or more <strong>classification models</strong> to train on your dataset",
        gradient: "from-blue-600 via-indigo-600 to-purple-600",
      },
      {
        id: 2,
        title: "train models",
        subtitle: "Watch your models <strong>train</strong>, evaluate their performance, and visualize predictions",
        gradient: "from-purple-600 via-pink-600 to-red-600",
      },
      {
        id: 3,
        title: "feature importance",
        subtitle: "Discover which <strong>sensors and variables</strong> influence model predictions the most",
        gradient: "from-green-600 via-emerald-600 to-teal-600",
      }
    ]
  }
};