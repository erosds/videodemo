const PipelinePilot = () => (
  <div className="absolute inset-0 overflow-y-auto no-scrollbar">
      <div
        className="min-h-full flex flex-col justify-center px-12"
        style={{ paddingTop: "clamp(60px, 10vh, 160px)", paddingBottom: "clamp(40px, 8vh, 120px)" }}
      >
    <div className="max-w-6xl mx-auto w-full">

      {/* Header */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Under the hood</div>
        <div className="flex items-center gap-6">
          <h2 className="text-[22px] font-semibold text-gray-100 leading-tight whitespace-nowrap">
            BIOVIA Pipeline Pilot
          </h2>
          <img src="/images/dassault-logo.png" alt="Dassault Systèmes" style={{ height: 32, width: "auto", opacity: 0.85 }} />
          <img src="/images/biovia-logo.png" alt="BIOVIA" style={{ height: 32, width: "auto", opacity: 0.9 }} />
        </div>
      </div>

      {/* Videos — flex-grow proporzionale all'aspect ratio → stessa altezza + larghezza massima */}
      <div className="flex gap-4 items-start">
        {/* trainmodel — landscape 760×482  AR≈1.577 */}
        <div
          className="rounded-xl overflow-hidden border border-gray-800 bg-[#0a0a0a]"
          style={{ flex: "1577 1 0", aspectRatio: "760 / 482" }}
        >
          <video
            src="/video/trainmodel.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
          />
        </div>

        {/* paretofront — portrait 690×808  AR≈0.854 */}
        <div
          className="rounded-xl overflow-hidden border border-gray-800 bg-[#0a0a0a]"
          style={{ flex: "854 1 0", aspectRatio: "690 / 808" }}
        >
          <video
            src="/video/paretofront.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
          />
        </div>

      </div>

    </div>
    </div>
  </div>
);

export default PipelinePilot;
