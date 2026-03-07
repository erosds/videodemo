import { useState, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * MolImageButton — shows a 2D structure image from PubChem.
 *
 * Hover  → floating preview appears to the right of the button.
 * Click  → opens full image in a new browser tab.
 *
 * Props:
 *   cid        — PubChem CID (preferred, faster lookup)
 *   smiles     — SMILES string (fallback for in-silico compounds)
 *   hoverColor — Tailwind hover text-color class (e.g. "hover:text-rose-400")
 */
const MolImageButton = ({ cid, smiles, hoverColor = "hover:text-gray-300" }) => {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const imageUrl = cid
    ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=300x300`
    : smiles
      ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/PNG?record_type=2d&image_size=300x300`
      : null;

  if (!imageUrl) return null;

  const handleMouseEnter = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const TOOLTIP_W = 216; // 200px image + 2×8px padding
    const left = rect.right + 10 + TOOLTIP_W > window.innerWidth
      ? rect.left - TOOLTIP_W - 10
      : rect.right + 10;
    // Clamp vertically so the tooltip doesn't go below the viewport
    const top = Math.min(rect.top - 8, window.innerHeight - TOOLTIP_W - 20);
    setPos({ top, left });
  };

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setPos(null)}
        onClick={() => window.open(imageUrl, "_blank")}
        className={`flex-shrink-0 text-gray-600 ${hoverColor} transition-colors`}
        title="View 2D structure"
      >
        {/* image icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>

      {pos && createPortal(
        <div
          className="fixed z-[99999] bg-[#111111] border border-gray-700 rounded-xl p-2 shadow-2xl pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          <img
            src={imageUrl}
            alt="2D structure"
            width={200}
            height={200}
            className="rounded"
            style={{ background: "white" }}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default MolImageButton;
