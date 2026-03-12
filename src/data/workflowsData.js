// Definizione di tutti i flussi disponibili
export const workflows = {
  home: {
    id: 'home',
    sections: [
      {
        id: 0,
        title: "materials informatics demo space",
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
  deepSpectrum: {
    id: 'deepSpectrum',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "Every analytical lab — food safety, cosmetics, pharmaceuticals — produces <strong>spectra</strong> that must be manually interpreted by expert chemists. What is a chromatogram? What is a mass spectrum? How are spectra read today — and can <strong>AI change this</strong>?",
        gradient: "from-emerald-600 via-green-600 to-teal-600",
      },
      {
        id: 1,
        title: "global screening",
        subtitle: "Load your LC-MS/MS file: each peak in your chromatogram is compared against <strong>MassBank Europe</strong> (20,000+ public mass spectra) using <strong>CosineGreedy</strong> fragment similarity — a fast, established first-pass identification against the broadest publicly available reference.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 2,
        title: "knowledge base",
        subtitle: "Load a curated, domain-specific reference collection. For example, the <strong>ECRFS/Wageningen library</strong> of 102 PMT (persistent, mobile, toxic) compounds is a regulatory-grade baseline — each entry annotated with spectra, exact masses, and toxicological scores.",
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
        subtitle: "<strong>Spec2Vec</strong> encodes each mass spectrum as a 300-dimensional vector, the same idea as Word2Vec, but for chemical language. Two spectra that share chemical structure will be close in this embedding space, even when they share few exact fragment peaks.",
        gradient: "from-purple-600 via-violet-600 to-indigo-600",
      },
      {
        id: 5,
        title: "AI similarity search",
        subtitle: "The same search over both the full MassBank catalogue and the pre-selected local dataset now runs in vector space. Previously unmatched compounds now can become reachable because the comparison is no longer limited to shared fragment lists.",
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
        title: "summary",
        subtitle: "Platform pipeline recap, scientific foundation, and coverage metrics. Key performance indicators sourced from peer-reviewed literature and authoritative databases.",
        gradient: "from-fuchsia-600 via-purple-600 to-indigo-600",
      },
      {
        id: 8,
        title: "impact & future perspective",
        subtitle: "AI-based identification extends coverage beyond fixed reference libraries. The architecture is designed to scale — from a fast local instance to production-grade systems powered by more sofisticated engines, without changing the workflow logic.",
        gradient: "from-indigo-600 via-blue-600 to-cyan-600",
      },
    ]
  },
  predictLab: {
    id: 'predictLab',
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
  },
  moleculeFinder: {
    id: 'moleculeFinder',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "Finding a molecule with the right properties — for a medicine, a material, a fragrance, or a food ingredient — means searching a space <strong>too vast to explore by hand</strong>. How do structures and properties connect? The challenges are cost, time and the curse of <strong>competing design constraints</strong>.",
        gradient: "from-rose-700 via-pink-600 to-fuchsia-600",
      },
      {
        id: 1,
        title: "molecular representation",
        subtitle: "Molecules are encoded as text strings or <strong>fingerprints</strong> — bit vectors that capture neighbourhood patterns at each atom. Combined with physicochemical descriptors (weight, surface area...), they form the feature space that a ML model has to connect to specific properties.",
        gradient: "from-fuchsia-700 via-purple-600 to-violet-600",
      },
      {
        id: 2,
        title: "property prediction models",
        subtitle: "After encoding molecules, we train <strong>property prediction models</strong> on the feature space to estimate their physicochemical properties. Searching for <strong>curated datasets</strong> is a critical step: the model's accuracy and generalizability depend on the quality and relevance of the training data.",
        gradient: "from-violet-700 via-indigo-600 to-purple-600",
      },
      {
        id: 3,
        title: "multi-objective optimization",
        subtitle: "<strong>NSGA-II</strong> (Non-dominated Sorting Genetic Algorithm II) evolves a population of new molecules over generations, predicts properties with the trained models and optimizes two or more conflicting objectives, producing a <strong>Pareto-optimal frontier</strong> of trade-off solutions.",
        gradient: "from-pink-700 via-rose-600 to-red-600",
      },
      {
        id: 4,
        title: "pipeline pilot",
        subtitle: "The entire workflow is orchestrated inside <strong>BIOVIA Pipeline Pilot</strong> — Dassault Systèmes' visual scientific workflow platform. Protocols are built as drag-and-drop pipelines of reusable components, making every step <strong>reproducible, auditable and shareable</strong>.",
        gradient: "from-blue-700 via-cyan-600 to-sky-600",
      },
      {
        id: 5,
        title: "impact",
        subtitle: "AI automates 57% of \"idea-generation\" tasks, reallocating researchers to the new task of guiding the design process. From candidate pool generation to multi-objective Pareto optimisation and safety filtering, the entire pipeline could discover 44% more materials.",
        gradient: "from-indigo-600 via-purple-600 to-pink-600",
      },
      {
        id: 6,
        title: "industries",
        subtitle: "The generative pipeline is <strong>domain-agnostic</strong>. Swap the candidate pool and training datasets and the same workflow addresses any multi-objective molecular design challenge — from oral drug candidates to crop-protection actives to next-generation UV filters.",
        gradient: "from-sky-600 via-indigo-600 to-violet-600",
      },
      {
        id: 7,
        title: "case: CNS lead optimization",
        subtitle: "Starting from a pool of <strong>drug-like CNS (Central Nervous System) compounds</strong>, seeded on known molecules, we are maximizing <strong>lipophilicity (logD) at pH 7.4</strong> while minimizing <strong>SA Score</strong> (synthetic accessibility). Pareto front reveals the trade-off between penetration potential and ease of synthesis.",
        gradient: "from-orange-600 via-rose-600 to-pink-600",
      },
      {
        id: 8,
        title: "case: sweetness enhancer discovery",
        subtitle: "3-objective NSGA-II on a pool of <strong>sweet compounds</strong> seeded on Glucose, Sucrose, Aspartame, Saccharin and Stevioside — spanning natural sugars, synthetic and semi-natural sweeteners. Simultaneously maximizing <strong>sweetness probability</strong> and <strong>logS</strong> (aqueous solubility) while minimizing <strong>MW</strong>.",
        gradient: "from-violet-600 via-purple-600 to-fuchsia-600",
      },
      {
        id: 9,
        title: "case: citrus aroma for beverages",
        subtitle: "3-objective NSGA-II starting from a pool of <strong>citrus terpenes</strong> seeded on known compounds. Maximizing <strong>citrus aroma probability</strong> and <strong>oxidation stability</strong> while minimizing <strong>MW</strong>. The Pareto front helps identify candidates that offer the best trade-offs for long-lasting citrus notes.",
        gradient: "from-teal-600 via-emerald-600 to-green-600",
      },
      {
        id: 10,
        title: "regulatory compliance",
        subtitle: "Cross-reference discovered candidates against <strong>FEMA GRAS</strong> (US) and <strong>EU Regulation EC 1334/2008</strong> — the Union List of approved flavouring substances. Known compounds are matched by PubChem CID; in silico candidates have no regulatory record yet.",
        gradient: "from-emerald-600 via-teal-600 to-green-600",
      },
    ]
  },
  chemicalCompliance: {
    id: 'chemicalCompliance',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "A fully <strong>local conversational assistant</strong> for industrial QA/QC laboratories. Upload SOPs, SDS sheets, regulatory documents, and Certificates of Analysis. Ask compliance questions and receive answers grounded in your own document corpus. All processing stays on your machine.",
        gradient: "from-green-700 via-emerald-600 to-teal-700",
      },
      {
        id: 1,
        title: "upload & ingest",
        subtitle: "Upload <strong>PDF, DOCX, or plain-text</strong> documents. Assign document type (SOP, SDS, REGULATION, METHOD, COA) and matrix type. Documents are chunked, embedded with <strong>nomic-embed-text</strong>, and stored in a local <strong>Qdrant</strong> vector database.",
        gradient: "from-emerald-600 via-teal-500 to-cyan-600",
      },
      {
        id: 2,
        title: "chemical assistant",
        subtitle: "Ask compliance questions in natural language. Choose between <strong>General Search</strong>, <strong>Regulatory</strong> (REACH/CLP grounding), or <strong>SDS Extract</strong> mode. Answers are generated by <strong>LLaMA 3</strong> and cite source documents with confidence scores.",
        gradient: "from-teal-600 via-emerald-500 to-green-600",
      },
      {
        id: 3,
        title: "batch CoA compare",
        subtitle: "Upload two <strong>Certificates of Analysis</strong> for the same product. The system aligns shared parameters, computes <strong>percent deviation</strong>, and flags values exceeding your threshold. Technical commentary only — no GMP release decisions.",
        gradient: "from-green-600 via-teal-600 to-emerald-700",
      },
      {
        id: 4,
        title: "audit trail",
        subtitle: "Every upload, query, SDS extraction, and CoA comparison is logged with timestamp and metadata. Export the full <strong>audit log as JSON</strong> for traceability and compliance record-keeping.",
        gradient: "from-emerald-700 via-green-600 to-teal-500",
      },
      {
        id: 5,
        title: "ingredient check",
        subtitle: "Verify single ingredients or entire formulas against the <strong>EU Cosmetics Regulation 1223/2009</strong>. Database of 100+ ingredients with concentration limits, Annex references, and plain-language explanations.",
        gradient: "from-teal-600 via-cyan-600 to-emerald-600",
      },
    ]
  }
};