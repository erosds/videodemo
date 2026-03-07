import { useState, useEffect, useRef } from "react";

const BACKEND = "http://localhost:8000";

// ── Molecule database — 3 industries, 7 molecules ─────────────────────────
const ALL_MOLECULES = [
  // ── Food & Flavour ────────────────────────────────────────────────────────
  {
    id: "vanillin",
    name: "Vanillin",
    category: "Food & Flavour",
    formula: "C₈H₈O₃",
    smiles: "COc1cc(C=O)ccc1O",
    cid: 1183,
    mw: 152.1, logp: 1.21, hbd: 1, hba: 3, tpsa: 46.5, rings: 1,
    notes: "Primary vanilla flavour compound — produced synthetically at >18,000 t/year from lignin or guaiacol. Also used as a fragrance building block.",
  },
  {
    id: "menthol",
    name: "Menthol",
    category: "Food & Flavour",
    formula: "C₁₀H₂₀O",
    smiles: "CC1CCC(C(C)C)CC1O",
    cid: 16666,
    mw: 156.3, logp: 3.38, hbd: 1, hba: 1, tpsa: 20.2, rings: 1,
    notes: "Mint cooling compound — activates TRPM8 (Transient Receptor Potential Melastatin 8) cold receptors without lowering temperature. Used in food, pharma, and cosmetics.",
  },
  {
    id: "capsaicin",
    name: "Capsaicin",
    category: "Food & Flavour",
    formula: "C₁₈H₂₇NO₃",
    smiles: "COc1cc(CNC(=O)CCCC/C=C/C(C)C)ccc1O",
    cid: 1548943,
    mw: 305.4, logp: 3.04, hbd: 2, hba: 3, tpsa: 58.6, rings: 1,
    notes: "Chilli heat compound — activates TRPV1 (Transient Receptor Potential Vanilloid 1) nociceptors. Also used in analgesic patches and cardiovascular research.",
  },
  // ── Fragrance ─────────────────────────────────────────────────────────────
  {
    id: "linalool",
    name: "Linalool",
    category: "Fragrance",
    formula: "C₁₀H₁₈O",
    smiles: "OC(C)(CCC=C(C)C)C=C",
    cid: 6549,
    mw: 154.3, logp: 2.97, hbd: 1, hba: 1, tpsa: 20.2, rings: 0,
    notes: "Floral-woody terpenoid alcohol — occurs in >200 plant species. One of the most frequently used fragrance ingredients globally; also studied for anxiolytic activity.",
  },
  {
    id: "limonene",
    name: "Limonene",
    category: "Fragrance",
    formula: "C₁₀H₁₆",
    smiles: "C=C(C)[C@@H]1CCC(=CC1)C",
    cid: 440917,
    mw: 136.2, logp: 4.57, hbd: 0, hba: 0, tpsa: 0.0, rings: 1,
    notes: "Citrus aroma terpenoid — D-limonene is GRAS (Generally Recognized As Safe) by the FDA. Used in cleaning products, cosmetics, and as a flavour enhancer.",
  },
  // ── Materials ─────────────────────────────────────────────────────────────
  {
    id: "styrene",
    name: "Styrene",
    category: "Materials",
    formula: "C₈H₈",
    smiles: "C=Cc1ccccc1",
    cid: 7501,
    mw: 104.2, logp: 2.95, hbd: 0, hba: 0, tpsa: 0.0, rings: 1,
    notes: "Vinyl aromatic monomer — precursor to polystyrene (PS) and ABS plastics. ~15 Mt produced annually. IARC (International Agency for Research on Cancer) Group 2A.",
  },
  {
    id: "bpa",
    name: "Bisphenol A",
    category: "Materials",
    formula: "C₁₅H₁₆O₂",
    smiles: "CC(c1ccc(O)cc1)(c1ccc(O)cc1)C",
    cid: 6623,
    mw: 228.3, logp: 3.32, hbd: 2, hba: 2, tpsa: 40.5, rings: 2,
    notes: "Polycarbonate and epoxy resin monomer — ~4 Mt/year production. Subject to regulatory review as endocrine disruptor under EU REACH and US EPA assessment.",
  },
];

const CATEGORIES = ["Food & Flavour", "Fragrance", "Materials"];

const CAT_COLOR = {
  "Food & Flavour": { text: "text-violet-300", bg: "bg-violet-900/30", border: "border-violet-800/40" },
  "Fragrance":      { text: "text-violet-300", bg: "bg-violet-900/30", border: "border-violet-800/40" },
  "Materials":      { text: "text-violet-300", bg: "bg-violet-900/30", border: "border-violet-800/40" },
};

// ── Category dropdown ───────────────────────────────────────────────────────
const CategoryDropdown = ({ activeCat, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const c = CAT_COLOR[activeCat];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${c.bg} ${c.border} ${c.text}`}
      >
        {activeCat}
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[160px] shadow-xl">
          {CATEGORIES.map(cat => {
            const cc = CAT_COLOR[cat];
            return (
              <button
                key={cat}
                onClick={() => { onChange(cat); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-all ${
                  activeCat === cat ? `${cc.bg} ${cc.text}` : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Morgan fingerprint grid (2048 bits, 32 cols × 64 rows) ────────────────
const COLS = 42;

const FingerprintGrid = ({ bits, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-[10px] text-gray-500">Computing fingerprint…</span>
      </div>
    );
  }
  if (!bits) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-[10px] text-gray-500">Fingerprint unavailable</span>
      </div>
    );
  }

  const setBits = bits.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 justify-center items-align-center">
      <div
        className="inline-grid justify-center"
        style={{ gridTemplateColumns: `repeat(${COLS}, 6px)`, gap: "2px" }}
      >
        {bits.map((bit, i) => (
          <div
            key={i}
            style={{
              width: 6, height: 5,
              borderRadius: 1,
              background: bit ? "#60a5fa" : "#1f2937",
              opacity: bit ? 0.85 : 0.25,
            }}
          />
        ))}
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        <span className="text-blue-400">{setBits} bits set</span> out of 2,048.
        Each square is one bit of the full ECFP4 (Extended-Connectivity Fingerprint, 4 bonds) fingerprint —{" "}
        <span className="text-blue-400">blue</span> means the molecule contains that circular substructure fragment.
        Binary fingerprints are one of the most widely used for molecule comparison and similarity searching.
      </p>
    </div>
  );
};

// ── Descriptor row ─────────────────────────────────────────────────────────
const DescRow = ({ label, value, unit, note, color }) => (
  <div className="py-2 border-b border-gray-800/40 last:border-0">
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>
        {value} <span className="text-gray-500 font-normal text-[10px]">{unit}</span>
      </span>
    </div>
    {note && <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{note}</div>}
  </div>
);

// ── 2D structure image via backend proxy ───────────────────────────────────
const StructureImage = ({ cid, name }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);
  const url = `${BACKEND}/molecule-finder/structure/${cid}`;

  return (
    <div
      className="rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center h-full"
      style={{ minHeight: 100, maxHeight: 190 }}
    >
      {!error && (
        <img
          key={cid}
          src={url}
          alt={`2D structure of ${name}`}
          className="w-full object-contain"
          style={{ maxHeight: 190, display: loaded ? "block" : "none" }}
          onLoad={() => { setLoaded(true); setError(false); }}
          onError={() => setError(true)}
        />
      )}
      {!loaded && !error && (
        <div className="text-[10px] text-gray-400 py-6">Loading structure…</div>
      )}
      {error && (
        <div className="text-[10px] text-gray-500 py-6 px-3 text-center">
          Structure unavailable — check backend connection
        </div>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────
const MolecularRepresentation = () => {
  const [activeCat, setActiveCat] = useState("Food & Flavour");
  const [primaryId, setPrimaryId] = useState("vanillin");
  const [fpBits, setFpBits]       = useState(null);
  const [fpLoading, setFpLoading] = useState(false);

  const catMols   = ALL_MOLECULES.filter(m => m.category === activeCat);
  const primary   = ALL_MOLECULES.find(m => m.id === primaryId) ?? ALL_MOLECULES[0];
  const catColors = CAT_COLOR[activeCat];

  // Fetch real ECFP4 fingerprint from backend whenever molecule changes
  useEffect(() => {
    let cancelled = false;
    setFpBits(null);
    setFpLoading(true);
    fetch(`${BACKEND}/molecule-finder/fingerprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smiles: primary.smiles }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) { setFpBits(data.bits); setFpLoading(false); } })
      .catch(() => { if (!cancelled) setFpLoading(false); });
    return () => { cancelled = true; };
  }, [primary.smiles]);

  const handleCatChange = (cat) => {
    setActiveCat(cat);
    const first = ALL_MOLECULES.find(m => m.category === cat);
    if (first) setPrimaryId(first.id);
  };

  return (
    <div
      className="absolute inset-0 overflow-y-auto no-scrollbar px-20"
      style={{ paddingTop: 200, paddingBottom: 100 }}
    >
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-4">

        {/* Single row: dropdown + molecule buttons + ellipsis */}
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryDropdown activeCat={activeCat} onChange={handleCatChange} />

          {/* Divider */}
          <span className="text-gray-700 text-xs">|</span>

          {catMols.map(m => (
            <button key={m.id} onClick={() => setPrimaryId(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                primaryId === m.id
                  ? `${catColors.bg} ${catColors.border} ${catColors.text} font-medium`
                  : "bg-[#111111] border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300"
              }`}>
              {m.name}
              <span className="ml-1.5 font-mono text-[9px] opacity-60">{m.formula}</span>
            </button>
          ))}

          <span className="text-gray-700 text-xs font-mono tracking-widest px-1">···</span>
        </div>

        {/* Three-column detail */}
        <div className="grid grid-cols-3 gap-4">

          {/* Col 1 — SMILES + 2D structure */}
          <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-gray-300">
                SMILES / 2D Structure
              </span>
            </div>

            <div className="font-mono text-xs text-rose-300 break-all leading-relaxed bg-gray-900/50 rounded-lg p-3">
              {primary.smiles}
            </div>

            <p className="text-[11px] text-gray-500 leading-snug">
              SMILES (Simplified Molecular-Input Line-Entry System) encodes the full molecule as a linear ASCII string — atoms, bond types, ring closures, and stereochemistry included. 2D structure images can be generated from SMILES using specific chemical libraries. 
            </p>

            <StructureImage key={primary.cid} cid={primary.cid} name={primary.name} />
            <div className="text-[9px] text-gray-400 text-center">
              2D structure · source: PubChem CID {primary.cid}
            </div>

            <div className="mt-auto px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-800/60">
              <div className="text-[10px] text-gray-400 leading-snug">{primary.notes}</div>
            </div>
          </div>

          {/* Col 2 — Morgan fingerprint */}
          <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col gap-3">
            <span className="text-[11px] uppercase tracking-widest text-gray-300">
              Morgan Fingerprint (ECFP4 · 2048 bits)
            </span>
            <FingerprintGrid bits={fpBits} loading={fpLoading} />
          </div>

          {/* Col 3 — Physicochemical descriptors */}
          <div className="rounded-xl border border-gray-800 bg-[#111111] p-4 flex flex-col">
            <span className="text-[11px] uppercase tracking-widest text-gray-300 mb-3">
              Physicochemical Descriptors
            </span>

            <DescRow
              label="MW — Molecular Weight"
              value={primary.mw} unit="Da"
              color="#f43f5e"
              note="Mass of one mole (in g/mol = Da). Larger molecules are generally less membrane-permeable and harder to synthesise."
            />
            <DescRow
              label="logP — lipophilicity"
              value={primary.logp} unit=""
              color="#ec4899"
              note="log₁₀ of the octanol/water partition coefficient. Higher logP → more fat-soluble; lower → more water-soluble. Drives absorption, distribution, and toxicity."
            />
            <DescRow
              label="HBD — H-Bond Donors"
              value={primary.hbd} unit=""
              color="#a855f7"
              note="Count of N–H and O–H groups. Donors form hydrogen bonds with biological targets; too many reduce membrane permeability."
            />
            <DescRow
              label="HBA — H-Bond Acceptors"
              value={primary.hba} unit=""
              color="#7c3aed"
              note="Count of electronegative N and O atoms with lone pairs. Acceptors interact with protein binding sites and influence aqueous solubility."
            />
            <DescRow
              label="TPSA — Topological Polar Surface Area"
              value={primary.tpsa} unit="Å²"
              color="#6366f1"
              note="Sum of surfaces of all polar atoms. Key predictor of intestinal absorption (TPSA < 140 Å²) and blood-brain barrier crossing (< 90 Å²)."
            />
            <DescRow
              label="Ring count"
              value={primary.rings} unit=""
              color="#8b5cf6"
              note="Number of distinct ring systems. Rings increase conformational rigidity and 3D shape complexity; also affect metabolic stability."
            />

            <p className="text-[10px] text-gray-400 leading-snug mt-3 pt-3">
              All descriptors are computed directly from the SMILES string in &lt;1 ms using RDKit — no laboratory measurement required.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MolecularRepresentation;
