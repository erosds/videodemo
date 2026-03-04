const MetricCard = ({ value, unit, label, sub, color }) => (
  <div className="rounded-xl border border-gray-800 bg-[#111111] p-5 text-center">
    <div className="text-3xl font-bold" style={{ color }}>{value}</div>
    <div className="text-xs text-gray-500 mt-0.5">{unit}</div>
    <div className="text-sm font-medium text-gray-300 mt-2">{label}</div>
    {sub && <div className="text-[10px] text-gray-600 mt-1 leading-snug">{sub}</div>}
  </div>
);

const TimelineItem = ({ phase, duration, desc, color, last }) => (
  <div className="flex items-start gap-3">
    <div className="flex flex-col items-center">
      <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
      {!last && <div className="w-px flex-1 mt-1" style={{ background: color + "40", minHeight: 32 }} />}
    </div>
    <div className="pb-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-gray-200">{phase}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: color + "22", color }}>
          {duration}
        </span>
      </div>
      <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{desc}</div>
    </div>
  </div>
);

const AppCard = ({ icon, title, desc }) => (
  <div className="rounded-lg border border-gray-800 bg-[#0e0e0e] p-3">
    <div className="text-lg mb-1">{icon}</div>
    <div className="text-xs font-semibold text-gray-200">{title}</div>
    <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{desc}</div>
  </div>
);

const Impact = () => (
  <div
    className="absolute inset-0 overflow-y-auto no-scrollbar px-20"
    style={{ paddingTop: 200, paddingBottom: 100 }}
  >
    <div className="max-w-6xl mx-auto w-full">

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard value="10×"  unit="faster"       label="Hit identification" sub="vs traditional empirical screening" color="#f43f5e" />
        <MetricCard value=">80%" unit="cost reduction" label="Wet-lab screening" sub="by pre-filtering with ML predictions" color="#ec4899" />
        <MetricCard value="4–8"  unit="weeks"         label="From ban to compliant reformulation" sub="vs 18–36 months legacy process" color="#a855f7" />
        <MetricCard value="63+"  unit="molecules"     label="Continuously monitored" sub="EU Annex II/III in real time" color="#6366f1" />
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Left — timeline */}
        <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-4">Reformulation Timeline</div>
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-3">Traditional</div>
              <TimelineItem phase="Regulatory ban announced" duration="Day 0" desc="Internal alert; product portfolio impact assessed manually" color="#6b7280" />
              <TimelineItem phase="Literature review" duration="2–4 wk" desc="Team surveys GoodScents, IFRA, patent literature" color="#6b7280" />
              <TimelineItem phase="Candidate selection" duration="4–8 wk" desc="Empirical shortlisting; odour panel first sniff" color="#6b7280" />
              <TimelineItem phase="Lab synthesis & testing" duration="3–6 mo" desc="Allergy patch tests, stability, sensory evaluation" color="#6b7280" />
              <TimelineItem phase="Reformulation validated" duration="12–18 mo" desc="Regulatory dossier, consumer panel, launch" color="#6b7280" last />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-3">AI-Guided</div>
              <TimelineItem phase="Regulatory ban announced" duration="Day 0" desc="Automated monitoring detects new entry in Annex II/III" color="#f43f5e" />
              <TimelineItem phase="NSGA-II optimisation" duration="< 1 h" desc="ML screening of 500k candidates → Pareto front in minutes" color="#ec4899" />
              <TimelineItem phase="Top-10 candidates" duration="Day 1" desc="Ranked by odour sim, allergenicity, SA score, cost" color="#a855f7" />
              <TimelineItem phase="Targeted wet-lab" duration="2–4 wk" desc="Only top candidates synthesised; ~90% fewer experiments" color="#7c3aed" />
              <TimelineItem phase="Reformulation validated" duration="6–10 wk" desc="Accelerated dossier with ML predictions as supporting data" color="#6366f1" last />
            </div>
          </div>
        </div>

        {/* Right — applications */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Industry Applications</div>
            <div className="grid grid-cols-2 gap-2">
              <AppCard icon="🧴" title="Personal Care" desc="Fragrance allergen replacement; skin-safe reformulation for leave-on products" />
              <AppCard icon="🍫" title="Food & Flavour" desc="Sodium/sugar reduction; bitter blocking in nutraceuticals and pharma" />
              <AppCard icon="🏠" title="Home Care" desc="Detergent fragrance compliance; VOC reduction in aerosol products" />
              <AppCard icon="💊" title="Pharma Excipients" desc="Flavour masking for paediatric formulations; excipient allergen screening" />
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">Technology Stack</div>
            <div className="flex flex-wrap gap-2">
              {[
                ["RDKit", "#f43f5e"],
                ["NSGA-II (pymoo)", "#ec4899"],
                ["Random Forest", "#a855f7"],
                ["ECFP4 Fingerprints", "#7c3aed"],
                ["GoodScents DB", "#6366f1"],
                ["IFRA 49th Amendment", "#8b5cf6"],
                ["EU Reg. 1223/2009", "#d946ef"],
                ["FastAPI", "#f97316"],
              ].map(([label, color]) => (
                <span
                  key={label}
                  className="px-2 py-1 rounded text-[10px] font-mono border"
                  style={{ borderColor: color + "40", color, background: color + "12" }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default Impact;
