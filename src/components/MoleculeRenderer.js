import React, { useEffect, useRef } from 'react';
import SmilesDrawer from 'smiles-drawer';

const MoleculeRenderer = ({ smiles, size = 128 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !smiles) return;

    const drawer = new SmilesDrawer.Drawer({
      width: size,
      height: size,
      bondThickness: 2,
      bondColor: '#FFFFFF',
      atomColor: '#61DAFB',
    });

    SmilesDrawer.parse(smiles, (tree) => {
      drawer.draw(tree, canvasRef.current, 'light', false);
    });
  }, [smiles, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
};

export default MoleculeRenderer;