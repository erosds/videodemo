import React from "react";
import { getAnimationProgress } from "../../utils/animationConfig";
import Overview from "./Overview";
import MolecularRepresentation from "./MolecularRepresentation";
import PropertyPrediction from "./PropertyPrediction";
import MultiObjectiveOptimizer from "./MultiObjectiveOptimizer";
import PipelinePilot from "./PipelinePilot";
import CaseOne from "./CaseOne";
import CaseTwo from "./CaseTwo";
import CaseThree from "./CaseThree";
import Regulatory from "./Regulatory";
import Impact from "./Impact";
import Industries from "./Industries";

const MoleculeFinderContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const sections = [
    <Overview />,
    <MolecularRepresentation />,
    <PropertyPrediction />,
    <MultiObjectiveOptimizer />,
    <PipelinePilot />,
    <Impact />,
    <Industries />,
    <CaseOne />,
    <CaseTwo />,
    <CaseThree />,
    <Regulatory />,
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
