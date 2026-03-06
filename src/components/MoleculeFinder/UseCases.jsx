const Obj = ({ label }) => (
  <span className="inline-block text-[9px] text-gray-400 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono">
    {label}
  </span>
);

const UseCard = ({ accent, sector, title, tagline, audience, objectives, refLabel, refHref }) => (
  <div
    className="rounded-xl border border-gray-800 bg-[#0e0e0e] flex flex-col overflow-hidden"
  >
    <div className="px-5 pt-5 pb-4 flex flex-col gap-3 flex-1">
      {/* sector + title */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: accent }}>
          {sector}
        </div>
        <div className="text-sm font-semibold text-gray-100 leading-snug">{title}</div>
        <div className="text-[11px] text-gray-400 italic mt-0.5 leading-snug">{tagline}</div>
      </div>

      {/* audience-level explanation */}
      <p className="text-[11px] text-gray-300 leading-relaxed">{audience}</p>

      {/* divider */}
      <div className="border-t border-gray-800" />

      {/* objectives */}
      <div className="flex flex-wrap gap-1">
        {objectives.map((o) => <Obj key={o} label={o} />)}
      </div>
    </div>

    {/* reference footer */}
    <a
      href={refHref}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-5 py-2.5 border-t border-gray-800 hover:bg-gray-900 transition-colors group pointer-events-auto"
    >
      <svg className="w-3 h-3 flex-shrink-0 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors leading-snug">{refLabel}</span>
    </a>
  </div>
);

const USE_CASES = [
  {
    accent: "#818cf8",
    sector: "Pharmaceutical",
    title: "Lead Optimization for Drug Candidates",
    tagline: "Find molecules the body can absorb safely, without harming the heart.",
    audience:
      "A new drug candidate often fails not because it's inactive, but because the body can't absorb it or it causes cardiac side effects. This workflow lets chemists simultaneously optimize three critical properties to find the rare molecules that pass all three gates at once.",
    objectives: ["Intestinal absorption", "Cardiac safety", "Metabolic stability"],
    refLabel: "Therapeutic Data Commons — ADME benchmark tasks · tdcommons.ai",
    refHref: "https://tdcommons.ai/single_pred_tasks/adme/",
  },
  {
    accent: "#4ade80",
    sector: "Agrochemical",
    title: "Low-Toxicity Herbicide Design",
    tagline: "Design weedkillers that spare the farmer, the bee, and the soil.",
    audience:
      "Modern agriculture depends on herbicides, but many active ingredients accumulate in the environment or pose risks to mammals and pollinators. The goal is to find molecules that are effective against weeds while being rapidly degraded and minimally toxic to non-target species.",
    objectives: ["Optimal plant mobility", "Low mammalian toxicity", "Non-mutagenic"],
    refLabel: "Tox21 Data Challenge — EPA/NIH/FDA benchmark · tox21.gov",
    refHref: "https://tox21.gov/",
  },
  {
    accent: "#fb923c",
    sector: "Cosmetics",
    title: "Next-Generation UV Filter Design",
    tagline: "Discover sunscreen actives that protect skin without entering the bloodstream.",
    audience:
      "Only a limited number of UV filters are approved in the EU, and several are under scrutiny for systemic absorption or hormonal effects. There is real demand for novel UV-absorbing molecules that stay in the outer skin layers and pass modern safety screens — especially as regulations tighten.",
    objectives: ["No systemic absorption", "No hormonal activity", "Non-genotoxic"],
    refLabel: "EU Regulation 1223/2009, Annex VI — Permitted UV filters · eur-lex.europa.eu",
    refHref: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32009R1223",
  },
  {
    accent: "#f472b6",
    sector: "Infectious Disease",
    title: "Novel Antibiotic Scaffold Discovery",
    tagline: "Generate antibiotic candidates to fight bacteria that no existing drug can stop.",
    audience:
      "Antimicrobial resistance kills over a million people per year and the antibiotic pipeline is nearly empty. AI-guided generative design can explore structural space that classical medicinal chemistry has never reached, identifying candidates with the right balance of potency and safety.",
    objectives: ["Membrane permeability", "Selective vs. human cells", "Non-mutagenic"],
    refLabel: "WHO Priority Pathogens List — ESKAPE organisms · who.int",
    refHref: "https://www.who.int/publications/i/item/9789240093461",
  },
];

const UseCases = () => (
  <div
    className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
    style={{ paddingTop: 200, paddingBottom: 100 }}
  >
    <div className="max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-2 gap-5">
        {USE_CASES.map((uc) => (
          <UseCard key={uc.title} {...uc} />
        ))}
      </div>
    </div>
  </div>
);

export default UseCases;
