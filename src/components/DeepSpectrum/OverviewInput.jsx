import { LuActivity, LuAtom, LuBrain } from "react-icons/lu";

// ── Illustrative chromatogram (gaussian peaks, not real data) ─────────────────
const FakeChromatogram = () => {
  const W = 260, H = 72, baseline = 62;
  const peaks = [
    { cx: 40,  amp: 32, w: 10 },
    { cx: 100, amp: 52, w: 13 },
    { cx: 175, amp: 46, w: 12 },
    { cx: 220, amp: 28, w:  9 },
  ];
  const pts = [];
  for (let x = 0; x <= W; x += 1.5) {
    let y = 0;
    for (const p of peaks) y += p.amp * Math.exp(-((x - p.cx) ** 2) / (2 * p.w ** 2));
    pts.push(`${x.toFixed(1)},${(baseline - y).toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.75} />
      <line x1={0} y1={baseline} x2={W} y2={baseline} stroke="#374151" strokeWidth={0.5} />
      {[{ x: 40, y: baseline - 35, t: "2.1 min" }, { x: 100, y: baseline - 55, t: "5.3 min" }, { x: 175, y: baseline - 49, t: "7.8 min" }].map((l) => (
        <text key={l.t} x={l.x} y={l.y} textAnchor="middle" fontSize={8} fill="#6b7280" fontFamily="monospace">{l.t}</text>
      ))}
      <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={7} fill="#4b5563">Retention time (min)</text>
    </svg>
  );
};

// ── Illustrative MS/MS stick spectrum (not real data) ─────────────────────────
const FakeSpectrum = () => {
  const W = 260, H = 72, baseline = 62;
  const sticks = [
    { x: 28,  h: 12, label: null },
    { x: 58,  h: 26, label: null },
    { x: 88,  h: 34, label: null },
    { x: 118, h: 20, label: null },
    { x: 152, h: 48, label: "base peak" },
    { x: 185, h: 32, label: null },
    { x: 210, h: 16, label: null },
    { x: 235, h:  8, label: null },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {sticks.map((s, i) => (
        <g key={i}>
          <line x1={s.x} y1={baseline} x2={s.x} y2={baseline - s.h}
            stroke={s.h > 50 ? "#f97316" : s.h > 35 ? "#fb923c" : "#92400e"}
            strokeWidth={s.h > 50 ? 2 : 1.5} opacity={0.85} />
          {s.label && (
            <text x={s.x} y={baseline - s.h - 3} textAnchor="middle" fontSize={7} fill="#f97316">{s.label}</text>
          )}
        </g>
      ))}
      <line x1={0} y1={baseline} x2={W} y2={baseline} stroke="#374151" strokeWidth={0.5} />
      <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={7} fill="#4b5563">m/z (mass-to-charge ratio)</text>
    </svg>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const OverviewInput = () => {
  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: 200, paddingBottom: 100 }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* Intro */}
        <p className="text-base text-gray-400 leading-relaxed">
          The core question is always: <em>what molecules are in this sample?</em> One of the principal tools is <strong className="text-gray-300">LC–MS/MS</strong> (Liquid Chromatography–Tandem Mass Spectrometry). But it doesn't hand back a list of names: it produces raw signals that a trained expert must decode:
        </p>

        {/* Two concept cards */}
        <div className="grid grid-cols-2 gap-4">

          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <LuActivity className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-300">Chromatogram</span>
            </div>
            <FakeChromatogram />
            <p className="text-sm text-gray-400 leading-relaxed">
              Compounds separate as they travel through the instrument and arrive at different <strong className="text-gray-400">retention times (RT)</strong> — how long each molecule takes to reach the detector.
            </p>
            <p className="text-xs text-gray-500 italic leading-relaxed">
              Think of a marathon: each compound runs at its own pace and crosses the finish line at a different time. The chromatogram shows when each partecipant arrived — but not who they are.
            </p>
          </div>

          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <LuAtom className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-300">Mass Spectrum</span>
            </div>
            <FakeSpectrum />
            <p className="text-sm text-gray-400 leading-relaxed">
              For each chromatographic peak, the instrument isolates the molecule and shatters it. Fragments are detected by their <strong className="text-gray-400">m/z</strong> (mass-to-charge ratio). This pattern of fragments is the structural fingerprint of the compound.
            </p>
            <p className="text-xs text-gray-500 italic leading-relaxed">
              Like smashing a vase and cataloguing the pieces: every molecule breaks in its own way, and the fragment pattern reveals what the original structure was.
            </p>
          </div>

        </div>

        {/* Today + AI question — merged block */}
        <div className="border border-emerald-900/30 rounded-lg px-5 py-5 bg-emerald-950/10 flex flex-col gap-4">
          <p className="text-sm text-gray-400 leading-relaxed">
            Labs use vendor software (Compound Discoverer, UNIFI, MassHunter) that searches each spectrum against reference databases (NIST, mzCloud, MassBank) and ranks candidates by match score. This works for <strong className="text-gray-400">target analysis</strong> — known compounds, known list. The bottleneck is <strong className="text-gray-400">non-target screening</strong>: unknowns require expert judgement, and similarity scoring is prone to <strong className="text-gray-400">false positives</strong> — a few shared high-intensity fragments can produce a high match score even when the actual structure is wrong.
          </p>
          <div className="flex items-center gap-3 border-t border-emerald-900/20 pt-4">
            <LuBrain className="w-4 h-4 text-emerald-500/60 flex-shrink-0" />
            <p className="text-base text-gray-300 leading-relaxed">
              Could AI support analysts in identifying compounds in LC-MS/MS data that traditional workflows might overlook?
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OverviewInput;
