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
        subtitle: "Load your LC-MS/MS chromatogram and configure your reference libraries. The platform then walks you through two phases: first, <strong>classical spectral matching</strong> against a large public database and a targeted local library; then, <strong>AI-powered embedding search</strong> that extends identification beyond fixed peak lists — reaching structural analogues and novel unknowns.",
        gradient: "from-emerald-600 via-green-600 to-teal-600",
      },
      {
        id: 1,
        title: "global screening",
        subtitle: "Each peak in your chromatogram is compared against <strong>MassBank Europe</strong> (20,000+ public MS2 spectra) using <strong>CosineGreedy</strong> fragment similarity. This fast, established approach gives you a first-pass identification against the broadest publicly available reference.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 2,
        title: "knowledge base",
        subtitle: "Load a curated, domain-specific reference collection. For example, the <strong>ECRFS/Wageningen library</strong> of 102 PMT (persistent, mobile, toxic) compounds is a regulatory-grade baseline — each entry annotated with MS/MS spectra, exact masses, and EFSA toxicological scores.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 3,
        title: "spectral matching",
        subtitle: "The same fragment-matching logic is now applied to your local dataset using <strong>ModifiedCosine</strong> — a more rigorous cosine variant that accounts for neutral losses. Searching a focused set can reduce false positives relative to a broad public search.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 4,
        title: "vectorization",
        subtitle: "<strong>Spec2Vec</strong> encodes each MS2 spectrum as a 300-dimensional vector, the same idea as Word2Vec for chemical language. Two spectra that share chemical structure will be close in this embedding space, even when they share few exact fragment peaks.",
        gradient: "from-purple-600 via-violet-600 to-indigo-600",
      },
      {
        id: 5,
        title: "AI similarity search",
        subtitle: "The same search over <strong>both</strong> the local curated dataset and the full MassBank catalogue now runs in vector space. Previously unmatched compounds now can become reachable because the comparison is no longer limited to shared fragment lists.",
        gradient: "from-purple-600 via-violet-600 to-indigo-600",
      },
      {
        id: 6,
        title: "comparative results",
        subtitle: "Side-by-side comparison of all methods: <strong>Global Screening</strong> (classical, public DB), <strong>Spectral Matching</strong> (classical, specific library), and <strong>AI Similarity Search</strong> (Spec2Vec, both databases). Consensus between independent approaches strengthens confidence.",
        gradient: "from-teal-600 via-cyan-600 to-sky-600",
      },
      {
        id: 7,
        title: "summary & impact",
        subtitle: "Platform pipeline recap, scientific foundation, and coverage metrics. Key performance indicators sourced from peer-reviewed literature and authoritative databases.",
        gradient: "from-fuchsia-600 via-purple-600 to-indigo-600",
      },
      {
        id: 8,
        title: "future perspective",
        subtitle: "With proprietary client data — custom spectral libraries, instrument-specific models, historical campaigns — the platform scales into a production-grade, regulatory-ready screening system.",
        gradient: "from-indigo-600 via-blue-600 to-cyan-600",
      },
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