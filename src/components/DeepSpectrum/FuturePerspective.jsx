import {
  LuZap, LuSettings2, LuMoveUpRight, LuSearch,
} from "react-icons/lu";

// ─── KPI strip ────────────────────────────────────────────────────────────────
const KPI = ({ value, label, source, href, color }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-3 py-3 border-r border-gray-800 last:border-0">
    <div className="text-2xl font-bold leading-none mb-1" style={{ color }}>{value}</div>
    <div className="text-[11px] text-gray-300 font-medium text-center leading-tight mb-1">{label}</div>
    <a href={href} target="_blank" rel="noreferrer"
      className="text-[9px] text-gray-600 text-center leading-tight hover:text-gray-400 underline underline-offset-2 transition-colors cursor-pointer">
      {source}
    </a>
  </div>
);

// ─── Impact card ──────────────────────────────────────────────────────────────
const ImpactCard = ({ icon: Icon, color, title, desc }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/50 last:border-0">
    <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ background: color + "18" }}>
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-gray-200 leading-tight">{title}</div>
      <div className="text-[12px] text-gray-500 mt-0.5 leading-snug">{desc}</div>
    </div>
  </div>
);

// ─── Small card ───────────────────────────────────────────────────────────────
const Card = ({ title, desc, tag, color }) => (
  <div className="bg-[#0e0e0e] rounded border border-gray-800/60 px-3 py-2.5">
    <div className="flex items-start justify-between gap-2 mb-1">
      <div className="text-[11px] font-semibold text-gray-200 leading-tight">{title}</div>
      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
        style={{ color, background: color + "20" }}>
        {tag}
      </span>
    </div>
    <div className="text-[10px] text-gray-500 leading-snug">{desc}</div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const FuturePerspective = () => (
  <div className="absolute inset-0 flex items-center justify-center px-12"
    style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}>
    <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800 bg-[#111111]"
      style={{ height: "min(calc(100vh - 300px), 820px)" }}>

      {/* KPI STRIP */}
      <div className="flex border-b border-gray-800 bg-[#0d0d0d] flex-shrink-0">
        <KPI
          value="~1%"
          label="of NTS features get identified"
          source="Anal. Bioanal. Chem., 2024"
          href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10951028/"
          color="#ef4444"
        />
        <KPI
          value="7.5×"
          label="faster than modified cosine"
          source="Huber et al., Nat. Commun. 2023"
          href="https://www.nature.com/articles/s41467-023-37446-4"
          color="#3b82f6"
        />
        <KPI
          value="+40%"
          label="structural similarity in analogue retrieval"
          source="Huber et al., Nat. Commun. 2023"
          href="https://www.nature.com/articles/s41467-023-37446-4"
          color="#10b981"
        />
        <KPI
          value="<6%"
          label="of known PFAS have reference standards"
          source="Martin et al., EHP 2025"
          href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11776493/"
          color="#f59e0b"
        />
        <KPI
          value="74"
          label="WFD priority substances (incl. 24-PFAS group)"
          source="EU Council, 2025"
          href="https://www.consilium.europa.eu/en/press/press-releases/2025/09/23/water-pollution-council-and-parliament-reach-provisional-deal-to-update-priority-substances-in-surface-and-ground-waters/"
          color="#8b5cf6"
        />
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex min-h-0 bg-[#111111]">

        {/* LEFT — Impact of the AI approach */}
        <div className="flex-1 flex flex-col px-5 py-4 border-r border-gray-800 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>

          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 flex-shrink-0">
            Impact of the AI approach
          </div>
          <div className="flex-shrink-0">
            <ImpactCard icon={LuSearch} color="#3b82f6"
              title="Coverage beyond reference libraries"
              desc="Spec2Vec reaches structural analogues even when no matching spectrum exists. Classical methods stop at exact fragment lists — AI-based search does not." />
            <ImpactCard icon={LuZap} color="#f59e0b"
              title="Speed & automation"
              desc="Full pipeline from upload to ranked results in minutes. Manual spectral interpretation of the same data takes hours and requires domain expertise." />
            <ImpactCard icon={LuSettings2} color="#8b5cf6"
              title="Customisation"
              desc="Interface, thresholds, reference libraries, and output format are all configurable. The workflow adapts to the use case — not the other way around." />
            <ImpactCard icon={LuMoveUpRight} color="#10b981"
              title="Scalability"
              desc="The same workflow logic runs locally for rapid turnaround or connects to heavier engines for high-throughput, regulatory-grade screening — no architectural change required." />
          </div>
        </div>

        {/* RIGHT — Future perspectives */}
        <div className="flex-1 flex flex-col px-5 py-4 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>

          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 flex-shrink-0">
            With proprietary data
          </div>
          <div className="flex flex-col gap-2 mb-3 flex-shrink-0">
            {[
              {
                title: "Custom spectral library",
                desc: "Client reference standards acquired on the target instrument — raises identification confidence from tentative to confirmed.",
                tag: "Data",
                color: "#3b82f6",
              },
              {
                title: "Retention time modelling",
                desc: "Method-specific RT model trained on historical campaigns — significantly reduces false-positive spectral matches.",
                tag: "Data",
                color: "#06b6d4",
              },
              {
                title: "Longitudinal trend analysis",
                desc: "Results accumulated across campaigns enable temporal trend detection — emerging contaminants, seasonal patterns, source attribution.",
                tag: "Analytics",
                color: "#10b981",
              },
            ].map((d) => <Card key={d.title} {...d} />)}
          </div>

          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 flex-shrink-0">
            Under the hood: scalable engines
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {[
              {
                title: "SIRIUS integration",
                desc: "Industry-standard formula and structure annotation (CSI:FingerID, CANOPUS, ZODIAC). Can replace or augment Spec2Vec for high-confidence structure elucidation. API access requires a commercial licence.",
                tag: "Engine",
                color: "#a855f7",
              },
              {
                title: "Foundation models for MS-MS",
                desc: "Large transformer-based models pretrained on millions of spectra (MS2Mol, MIST, MassFormer) as a natural next step beyond Spec2Vec — higher resolution on novel structure elucidation.",
                tag: "Emerging",
                color: "#f59e0b",
              },
            ].map((d) => <Card key={d.title} {...d} />)}
          </div>

        </div>
      </div>
    </div>
  </div>
);

export default FuturePerspective;
