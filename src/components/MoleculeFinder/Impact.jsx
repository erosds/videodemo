const MetricCard = ({ value, unit, label, sub, color }) => (
  <div className="rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 flex items-center gap-3">
    <div className="flex-shrink-0 text-right min-w-[3rem]">
      <div className="text-xl font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">{unit}</div>
    </div>
    <div className="border-l border-gray-800 pl-3">
      <div className="text-[11px] font-medium text-gray-300 leading-snug">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5 leading-snug">{sub}</div>}
    </div>
  </div>
);

const TimelineItem = ({ phase, duration, desc, color, last }) => (
  <div className="flex items-start gap-2">
    <div className="flex flex-col items-center">
      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
      {!last && <div className="w-px flex-1 mt-1" style={{ background: color + "40", minHeight: 20 }} />}
    </div>
    <div className="pb-2.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-gray-200">{phase}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: color + "22", color }}>
          {duration}
        </span>
      </div>
      <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{desc}</div>
    </div>
  </div>
);

const STACK_GROUPS = [
  {
    label: "Molecular Tools",
    desc: "Software to read, encode and compare chemical structures",
    color: "#f43f5e",
    items: ["RDKit — open-source molecular toolkit", "Molecular fingerprints — digital encoding of atom connectivity"],
  },
  {
    label: "AI & Optimization",
    desc: "Machine learning models and multi-objective search",
    color: "#a855f7",
    items: ["Random Forest — ensemble classifier for property prediction", "Multi-objective optimizer — finds Pareto-optimal trade-offs across competing goals"],
  },
  {
    label: "Flavour & Fragrance Databases",
    desc: "Curated collections of aroma and odour compounds",
    color: "#6366f1",
    items: ["GoodScents DB — industry flavour & fragrance reference", "IFRA 49th Amendment — international fragrance allergen standards", "FooDB — University of Alberta food composition database"],
  },
  {
    label: "Regulatory Lists",
    desc: "Official approved substance registers used for compliance checks",
    color: "#10b981",
    items: ["EU Regulation 1223/2009 — Cosmetics Regulation, Annex II/III", "EU Regulation 1334/2008 — Union List of Flavouring Substances"],
  },
];

const Impact = () => (
  <div
    className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
    style={{ paddingTop: 200, paddingBottom: 100 }}
  >
    <div className="max-w-6xl mx-auto w-full">

      {/* Metrics — compact horizontal */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MetricCard value="10×"  unit="faster"          label="Candidate identification"   sub="vs traditional empirical screening"    color="#f43f5e" />
        <MetricCard value=">80%" unit="fewer lab tests"  label="Wet-lab experiments saved"  sub="by pre-filtering with ML predictions"  color="#ec4899" />
        <MetricCard value="4–8"  unit="weeks"            label="From ban to compliant formula" sub="vs 18–36 months in legacy projects"  color="#a855f7" />
        <MetricCard value="63+"  unit="substances"       label="Monitored for restrictions" sub="EU Annex II/III + IFRA, live"          color="#6366f1" />
      </div>

      <div className="grid grid-cols-2 gap-3">

        {/* Left — timeline */}
        <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-4">Reformulation Timeline</div>
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-3">Traditional</div>
              <TimelineItem phase="Regulatory change"       duration="Day 0"    desc="Internal alert; product portfolio impact assessed manually" color="#6b7280" />
              <TimelineItem phase="Literature review"       duration="2–4 wk"   desc="Team surveys GoodScents, IFRA bulletins, patent literature" color="#6b7280" />
              <TimelineItem phase="Candidate selection"     duration="4–8 wk"   desc="Empirical shortlisting; first sensory panel organised" color="#6b7280" />
              <TimelineItem phase="Lab synthesis & testing" duration="3–6 mo"   desc="Allergy patch tests, stability, full sensory evaluation" color="#6b7280" />
              <TimelineItem phase="Reformulation validated" duration="12–18 mo" desc="Regulatory dossier, consumer panel sign-off, relaunch" color="#6b7280" last />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-3">AI-Guided</div>
              <TimelineItem phase="Regulatory change"           duration="Day 0"   desc="Automated monitoring flags new restriction (e.g. Lyral under IFRA 49th Amendment)" color="#f43f5e" />
              <TimelineItem phase="Multi-objective screening"   duration="< 1 h"   desc="Candidates ranked by predicted odour similarity, allergenicity and cost — shortlist in minutes" color="#ec4899" />
              <TimelineItem phase="Top candidates"              duration="Day 1"   desc="Ranked by odour profile match, safety score and synthetic accessibility" color="#a855f7" />
              <TimelineItem phase="Targeted wet-lab"            duration="2–4 wk"  desc="Only top candidates synthesised and sent to sensory panel; ~90% fewer experiments" color="#7c3aed" />
              <TimelineItem phase="Reformulation validated"     duration="6–10 wk" desc="Dossier compiled with AI predictions as supporting evidence (EFSA/SCCS guidance)" color="#6366f1" last />
            </div>
          </div>
        </div>

        {/* Right — stack */}
        <div className="flex flex-col">
          {/* Technology Stack — categorised */}
          <div className="rounded-xl border border-gray-800 bg-[#111111] p-5 flex-1">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Technology Stack</div>
            <div className="flex flex-col gap-3">
              {STACK_GROUPS.map(({ label, desc, color, items }) => (
                <div key={label}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[10px] font-semibold">{label}</span>
                    <span className="text-[9px] text-gray-600">{desc}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {items.map(item => (
                      <span key={item}
                        className="px-2 py-0.5 rounded text-[10px] border"
                        style={{ borderColor: color + "30", color: color + "cc", background: color + "0e" }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default Impact;
