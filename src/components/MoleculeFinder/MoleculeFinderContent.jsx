import React from "react";
import { getAnimationProgress } from "../../utils/animationConfig";
import Overview from "./Overview";
import MolecularRepresentation from "./MolecularRepresentation";
import PropertyPrediction from "./PropertyPrediction";
import MultiObjectiveOptimizer from "./MultiObjectiveOptimizer";
import AllergenReplacement from "./AllergenReplacement";
import ConstrainedDesign from "./ConstrainedDesign";
import SafetyAndCompliance from "./SafetyAndCompliance";
import Impact from "./Impact";
import UseCases from "./UseCases";

const MoleculeFinderContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const sections = [
    <Overview />,
    <MolecularRepresentation />,
    <PropertyPrediction />,
    <MultiObjectiveOptimizer />,
    <AllergenReplacement />,
    <ConstrainedDesign />,
    <SafetyAndCompliance />,
    <Impact />,
    <UseCases />,
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
