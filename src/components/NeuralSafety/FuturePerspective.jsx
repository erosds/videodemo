import {
  LuDatabase, LuClock, LuFlaskConical, LuFileText, LuServer,
  LuShapes, LuLayers, LuTrendingUp,
} from "react-icons/lu";

// ─── Capability card ──────────────────────────────────────────────────────────
const CapabilityCard = ({ icon: Icon, color, title, desc }) => (
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

// ─── Trend / roadmap card ─────────────────────────────────────────────────────
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
    style={{ paddingTop: "200px", paddingBottom: "100px" }}>
    <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800 bg-[#111111]"
      style={{ height: "min(calc(100vh - 300px), 780px)" }}>

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <LuLayers className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Future Perspectives
          </span>
        </div>
        <div className="text-[10px] text-gray-700 font-mono">
          From demo to production
        </div>
        <div className="w-32" />
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex min-h-0 bg-[#111111]">

        {/* LEFT — Platform extensions */}
        <div className="flex-1 flex flex-col px-5 py-4 border-r border-gray-800 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>

          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <LuFlaskConical className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Capabilities unlocked with proprietary data
            </span>
          </div>
          <div className="flex-shrink-0">
            <CapabilityCard icon={LuDatabase} color="#3b82f6"
              title="Custom spectral library"
              desc="Client reference standards on the target instrument — raises identification confidence from tentative to confirmed." />
            <CapabilityCard icon={LuClock} color="#06b6d4"
              title="Retention time modelling"
              desc="Method-specific RT model trained on client data — reduces false-positive spectral matches significantly." />
            <CapabilityCard icon={LuShapes} color="#8b5cf6"
              title="Matrix-specific novelty detection"
              desc="Retraining on the client's sample matrix (drinking water, food extract, soil) improves specificity for that application." />
            <CapabilityCard icon={LuTrendingUp} color="#10b981"
              title="Longitudinal trend analysis"
              desc="Results accumulated across campaigns enable temporal trend detection — emerging contaminants, seasonal patterns, source attribution." />
            <CapabilityCard icon={LuFileText} color="#f59e0b"
              title="Regulatory report automation"
              desc="Pre-configured templates for EU WFD, REACH/PMT, and EFSA submissions — output linked directly to pipeline results." />
            <CapabilityCard icon={LuServer} color="#6366f1"
              title="LIMS integration & batch processing"
              desc="API-first architecture for LIMS connection. Routine samples processed automatically with full audit trail." />
          </div>
        </div>

        {/* RIGHT — Scientific trends + roadmap */}
        <div className="flex-1 flex flex-col px-5 py-4 min-w-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>

          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 flex-shrink-0">
            Scientific landscape
          </div>
          <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
            {[
              {
                title: "Foundation models for MS2",
                desc: "Large transformer-based models pretrained on millions of spectra (MS2Mol, MIST, MassFormer) are starting to outperform Word2Vec embeddings on structure elucidation — the next natural upgrade to Spec2Vec.",
                tag: "Emerging",
                color: "#a855f7",
              },
              {
                title: "PFAS as a structural challenge",
                desc: "With 10,000+ PFAS variants and most lacking reference spectra, AI similarity search is currently the only viable first-pass approach — driving adoption of embedding-based methods in regulatory labs.",
                tag: "Regulatory",
                color: "#f59e0b",
              },
              {
                title: "EU non-target screening mandate",
                desc: "The revised EU Water Framework Directive (2027) and EFSA PMT criteria are pushing labs toward automated NTS pipelines — creating strong institutional demand for AI-assisted identification.",
                tag: "Policy",
                color: "#10b981",
              },
            ].map((d) => <Card key={d.title} {...d} />)}
          </div>

          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 flex-shrink-0">
            Development roadmap
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {[
              {
                title: "Fine-tuned embeddings on compound class",
                desc: "Transfer learning on a targeted corpus (PFAS, mycotoxins, veterinary drugs) — higher intra-class resolution than the general GNPS model.",
                tag: "ML",
                color: "#8b5cf6",
              },
              {
                title: "Dark-matter library accumulation",
                desc: "Reproducible unknowns across campaigns clustered into a client-specific library — prioritised candidates for reference standard acquisition.",
                tag: "Data",
                color: "#3b82f6",
              },
              {
                title: "Predictive toxicology integration",
                desc: "Spec2Vec analogues absent from tox databases routed to QSAR models (TEST, OPERA) for a provisional hazard estimate.",
                tag: "Risk",
                color: "#ef4444",
              },
            ].map((d) => <Card key={d.title} {...d} />)}
          </div>

        </div>
      </div>
    </div>
  </div>
);

export default FuturePerspective;
