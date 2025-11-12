import React, { useEffect, useRef } from "react";

const MoleculeRenderer = ({ smiles, size = 128 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !smiles) return;

    if (typeof window.SmilesDrawer === "undefined") {
      console.error("SmilesDrawer non caricato");
      return;
    }

    try {
      // API corretta per smiles-drawer 2.x
      const drawer = new window.SmilesDrawer.Drawer({
        width: size,
        height: size,
        bondThickness: 2,
        bondColor: "#FFFFFF",
        atomColor: "#61DAFB",
        padding: 30, // aggiungi questa riga
      });

      window.SmilesDrawer.parse(smiles, (tree) => {
        drawer.draw(tree, canvasRef.current, "dark", false);
      });
    } catch (error) {
      console.error("Errore rendering:", error);
    }
  }, [smiles, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
};

export default MoleculeRenderer;
