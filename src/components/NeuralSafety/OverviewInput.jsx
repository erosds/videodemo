import { useState, useEffect, useRef } from "react";
import { LuDatabase, LuFlaskConical, LuChevronDown } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const LIBRARY_DISPLAY = {
  "ECRFS_library_final": "ECRFS / Wageningen PMT",
};

// ─── Minimal dropdown ─────────────────────────────────────────────────────────
const Dropdown = ({ icon: Icon, value, label, placeholder, items, renderItem, renderNone, renderLabel, open, onToggle, dropRef }) => (
  <div className="flex flex-col items-center gap-3" style={{ width: 280 }}>
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">{label}</div>
    </div>
    <div ref={dropRef} className="relative w-full">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#0e0e0e] border border-gray-800 rounded-lg text-sm transition-colors hover:border-gray-600"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 flex-shrink-0 ${value ? "text-gray-400" : "text-gray-700"}`} />
          <span className={`truncate ${value ? "text-gray-200" : "text-gray-600"}`}>
            {value ? renderLabel(value) : placeholder}
          </span>
        </div>
        <LuChevronDown className={`w-3.5 h-3.5 text-gray-700 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#0e0e0e] border border-gray-800 rounded-lg shadow-2xl max-h-52 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}>
          {renderNone && renderNone()}
          {items.length === 0 && (
            <div className="px-4 py-3 text-[10px] text-gray-600 italic">No items found</div>
          )}
          {items.map((item) => renderItem(item))}
        </div>
      )}
    </div>
    {value && (
      <div className="text-[10px] text-emerald-600/70 font-mono tracking-wide">ready</div>
    )}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const OverviewInput = ({ selectedFile, activeLib, onFileChange, onLibChange }) => {
  const [files,         setFiles]         = useState([]);
  const [libs,          setLibs]          = useState([]);
  const [fileDropOpen,  setFileDropOpen]  = useState(false);
  const [libDropOpen,   setLibDropOpen]   = useState(false);
  const fileRef = useRef(null);
  const libRef  = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND}/neural-safety/chromatograms`).then((r) => r.json()).then(setFiles).catch(() => {});
    fetch(`${BACKEND}/neural-safety/libraries`).then((r) => r.json()).then(setLibs).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (fileRef.current && !fileRef.current.contains(e.target)) setFileDropOpen(false);
      if (libRef.current  && !libRef.current.contains(e.target))  setLibDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const bothSelected = selectedFile && activeLib;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-12"
      style={{ paddingTop: "200px", paddingBottom: "100px" }}>

      {/* Instructions */}
      <div className="text-center max-w-lg">
        <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Configuration</div>
        <div className="text-xs text-gray-500 leading-relaxed">
          Select the LC-MS/MS chromatogram to screen and the reference spectral library to compare against.
          These selections will be used throughout the entire analysis pipeline.
        </div>
      </div>

      {/* Dropdowns */}
      <div className="flex items-start gap-12">

        <Dropdown
          icon={LuFlaskConical}
          label="LC-MS/MS input file"
          placeholder="Select a chromatogram…"
          value={selectedFile}
          renderLabel={(v) => v}
          items={files}
          renderNone={() => (
            <button
              onClick={() => { onFileChange(null); setFileDropOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs border-b border-gray-800/40 transition-colors ${
                !selectedFile ? "text-gray-400 bg-white/5" : "text-gray-600 hover:bg-white/[0.03]"
              }`}>—</button>
          )}
          renderItem={(f) => (
            <button key={f}
              onClick={() => { onFileChange(f); setFileDropOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs border-b border-gray-800/40 last:border-0 font-mono transition-colors ${
                f === selectedFile ? "text-gray-100 bg-white/5" : "text-gray-500 hover:bg-white/[0.03]"
              }`}>{f}</button>
          )}
          open={fileDropOpen}
          onToggle={() => setFileDropOpen((o) => !o)}
          dropRef={fileRef}
        />

        {/* Divider */}
        <div className="w-px bg-gray-800 self-stretch mt-8" />

        <Dropdown
          icon={LuDatabase}
          label="Reference spectral library"
          placeholder="Select a library…"
          value={activeLib}
          renderLabel={(v) => LIBRARY_DISPLAY[v] ?? v}
          items={libs}
          renderNone={() => (
            <button
              onClick={() => { onLibChange(null); setLibDropOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs border-b border-gray-800/40 transition-colors ${
                !activeLib ? "text-gray-400 bg-white/5" : "text-gray-600 hover:bg-white/[0.03]"
              }`}>—</button>
          )}
          renderItem={(lib) => (
            <button key={lib.id}
              onClick={() => { onLibChange(lib.id); setLibDropOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs border-b border-gray-800/40 last:border-0 transition-colors ${
                lib.id === activeLib ? "text-gray-100 bg-white/5" : "text-gray-500 hover:bg-white/[0.03]"
              }`}>
              <div>{LIBRARY_DISPLAY[lib.id] ?? lib.id}</div>
              <div className="text-[9px] text-gray-700 mt-0.5 font-mono">
                {lib.has_metadata ? "full metadata" : "spectra only"}
              </div>
            </button>
          )}
          open={libDropOpen}
          onToggle={() => setLibDropOpen((o) => !o)}
          dropRef={libRef}
        />
      </div>

      {/* Status line */}
      <div className="text-[10px] text-gray-700">
        {bothSelected
          ? "Inputs configured — navigate through the tabs to run the analysis pipeline."
          : "Select both inputs to proceed."}
      </div>
    </div>
  );
};

export default OverviewInput;
