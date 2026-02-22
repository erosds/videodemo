import { LuActivity, LuSparkles, LuTrendingUp } from "react-icons/lu";

const P1 = "#f97316";   // Phase 1 — classical
const P2 = "#a855f7";   // Phase 2 — AI
const PI = "#6b7280";   // Input

// ─── Workflow step ─────────────────────────────────────────────────────────────
const Step = ({ phase, label, detail, color }) => (
  <div className="flex items-start gap-2.5 py-2.5 border-b border-gray-800/40 last:border-0">
    <span
      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 whitespace-nowrap"
      style={{ background: color + "22", color }}
    >
      {phase}
    </span>
    <div className="min-w-0">
      <div className="text-[12px] font-semibold text-gray-200 leading-tight">{label}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{detail}</div>
    </div>
  </div>
);

// ─── Dataset row ───────────────────────────────────────────────────────────────
const DataRow = ({ name, size, detail, href }) => (
  <div className="py-2 border-b border-gray-800/40 last:border-0">
    <div className="flex items-baseline gap-1.5 flex-wrap">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-[12px] font-semibold text-amber-300 hover:text-amber-200 hover:underline transition-colors leading-tight">
          {name}
        </a>
      ) : (
        <span className="text-[12px] font-semibold text-gray-300">{name}</span>
      )}
      {size && (
        <span className="text-[9px] font-mono text-gray-600">{size}</span>
      )}
    </div>
    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{detail}</div>
  </div>
);

// ─── Reference / tool row ──────────────────────────────────────────────────────
const Ref = ({ label, sub, href }) => (
  <div className="py-2 border-b border-gray-800/40 last:border-0">
    {href ? (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-[12px] font-semibold text-indigo-300 hover:text-indigo-200 hover:underline transition-colors">
        {label}
      </a>
    ) : (
      <span className="text-[12px] font-semibold text-gray-300">{label}</span>
    )}
    {sub && <div className="text-[11px] text-gray-600 font-mono mt-0.5 italic">{sub}</div>}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const SummaryImpact = () => (
  <div className="absolute inset-0 flex items-center justify-center px-12"
    style={{ paddingTop: "200px", paddingBottom: "100px" }}>
    <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800 bg-[#111111]"
      style={{ height: "min(calc(100vh - 300px), 780px)" }}>

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <LuTrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Summary
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded" style={{ background: P1 + "22", color: P1 }}>
            Phase 1 · Classical
          </span>
          <span className="px-2 py-0.5 rounded" style={{ background: P2 + "22", color: P2 }}>
            Phase 2 · AI
          </span>
        </div>
        <div className="w-32" />
      </div>

      {/* CONTENT — 3 columns */}
      <div className="flex-1 flex min-h-0 bg-[#111111]">

        {/* COL 1 — Workflow */}
        <div className="flex-1 flex flex-col px-5 py-4 border-r border-gray-800 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>
          <div className="flex items-center gap-2 mb-1 flex-shrink-0">
            <LuActivity className="w-3 h-3 text-gray-500" />
            <span className="text-[11px] uppercase tracking-widest text-gray-600">Workflow</span>
          </div>
          <Step phase="input" label="Load spectrum"
            detail="LC-MS/MS chromatogram · automatic peak detection · MS2 per peak"
            color={PI} />
          <Step phase="1 · A" label="Global screening"
            detail="CosineGreedy fragment matching vs MassBank Europe · 20,000+ public MS2 spectra · via REST API"
            color={P1} />
          <Step phase="1 · B" label="Load specific library"
            detail="ECRFS/Wageningen · 102 PMT reference compounds · EFSA toxicological scores"
            color={P1} />
          <Step phase="1 · C" label="Classical matching"
            detail="ModifiedCosine similarity vs PMT library · accounts for neutral losses · 102-compound targeted search"
            color={P1} />
          <Step phase="2 · A" label="AI vectorization"
            detail="Spec2Vec · each spectrum encoded as a 300-dimensional embedding vector"
            color={P2} />
          <Step phase="2 · B" label="AI similarity search"
            detail="Cosine k-NN in embedding space · runs against both PMT library and full MassBank (86,970 spectra)"
            color={P2} />
        </div>

        {/* COL 2 — Datasets */}
        <div className="flex-1 flex flex-col px-5 py-4 border-r border-gray-800 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>
          <div className="text-[11px] uppercase tracking-widest text-gray-600 mb-1">Datasets</div>

          <DataRow
            name="MassBank Europe"
            size="20,000+ spectra"
            detail="Public MS2 reference database · queried live via REST API for global screening · NORMAN network"
            href="https://massbank.eu"
          />
          <DataRow
            name="MassBank — bulk index"
            size="86,970 spectra"
            detail="MassBank_NISTformat.msp · downloaded from GitHub releases · filtered (positive mode, ≥3 peaks) · locally embedded with Spec2Vec"
            href="https://github.com/MassBank/MassBank-data"
          />
          <DataRow
            name="GNPS AllPositive dataset"
            size="500,000+ spectra"
            detail="Source dataset used to pre-train the Spec2Vec model · Global Natural Products Social Molecular Networking"
            href="https://gnps.ucsd.edu"
          />
          <DataRow
            name="Spec2Vec model weights"
            size="300 dimensions"
            detail="Pre-trained Word2Vec model on GNPS spectra · Huber et al. 2021 · Zenodo 4173596"
            href="https://zenodo.org/record/4173596"
          />
          <DataRow
            name="ECRFS / Wageningen PMT library"
            size="102 compounds"
            detail="Local reference collection of persistent, mobile, toxic compounds · MS/MS spectra + EFSA toxicological scores · used for classical matching and AI targeted search"
          />
        </div>

        {/* COL 3 — Tools & References */}
        <div className="flex-1 flex flex-col px-5 py-4 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>

          <div className="text-[11px] uppercase tracking-widest text-gray-600 mb-1">Tools</div>
          <Ref
            label="matchms"
            sub="CosineGreedy + ModifiedCosine · spectral processing library"
            href="https://github.com/matchms/matchms"
          />
          <Ref
            label="Spec2Vec"
            sub="MS2 embedding via Word2Vec · iomega / Netherlands eScience Center"
            href="https://github.com/iomega/spec2vec"
          />
          <Ref
            label="NORMAN network"
            sub="MassBank Europe curator · suspect list exchange · EU environmental screening"
            href="https://www.norman-network.com"
          />

          <div className="text-[11px] uppercase tracking-widest text-gray-600 mb-1 mt-4">
            Scientific foundation
          </div>
          <Ref
            label="Huber et al. 2021 — Spec2Vec"
            sub="PLOS Computational Biology · doi:10.1371/journal.pcbi.1008724"
            href="https://doi.org/10.1371/journal.pcbi.1008724"
          />
          <Ref
            label="de Jonge et al. 2023 — matchms"
            sub="Journal of Open Source Software · doi:10.21105/joss.02411"
            href="https://doi.org/10.21105/joss.02411"
          />
          <Ref
            label="EFSA CONTAM Panel 2022 — PMT classification"
            sub="EFSA Journal · persistent, mobile, toxic criteria"
            href="https://www.efsa.europa.eu/en/efsajournal/pub/7197"
          />
          <Ref
            label="Wang et al. 2016 — GNPS"
            sub="Nature Biotechnology · doi:10.1038/nbt.3597"
            href="https://doi.org/10.1038/nbt.3597"
          />
        </div>

      </div>
    </div>
  </div>
);

export default SummaryImpact;
