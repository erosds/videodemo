import React from "react";
import { getAnimationProgress } from "../../utils/animationConfig";
import Overview from "./Overview";
import MolecularRepresentation from "./MolecularRepresentation";
import PropertyPrediction from "./PropertyPrediction";
import MultiObjectiveOptimizer from "./MultiObjectiveOptimizer";
import SolubilityDesign from "./SolubilityDesign";
import SweetnessEnhancer from "./SweetnessEnhancer";
import ColorantScaffold from "./ColorantScaffold";
import Regulatory from "./Regulatory";
import Impact from "./Impact";
import BeyondFood from "./BeyondFood";

const MoleculeFinderContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const sections = [
    <Overview />,
    <MolecularRepresentation />,
    <PropertyPrediction />,
    <MultiObjectiveOptimizer />,
    <SolubilityDesign />,
    <SweetnessEnhancer />,
    <ColorantScaffold />,
    <Regulatory />,
    <Impact />,
    <BeyondFood />,
  ];

  const content = sections[activeIndex] ?? null;

  if (currentOpacity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: currentOpacity, willChange: "opacity" }}
    >
      <div className="absolute inset-0 pointer-events-auto">
        {content}
      </div>
    </div>
  );
};

export default MoleculeFinderContent;
