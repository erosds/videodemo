import React, { useState } from "react";
import OverviewInput from "./OverviewInput";
import KnowledgeBaseExplorer from "./KnowledgeBaseExplorer";
import VectorizationEngine from "./VectorizationEngine";
import SpectralMatching from "./SpectralMatching";
import Spec2VecAnalysis from "./Spec2VecAnalysis";
import AnomalyDetection from "./AnomalyDetection";
import ComparativeResults from "./ComparativeResults";
import SummaryImpact from "./SummaryImpact";
import FuturePerspective from "./FuturePerspective";
import { getAnimationProgress } from "../../utils/animationConfig";

const NeuralSafetyContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const [selectedFile, setSelectedFile] = useState(() => localStorage.getItem("ns_file") ?? null);
  const [activeLib,    setActiveLib]    = useState(() => localStorage.getItem("ns_lib")  ?? null);

  const handleFileChange = (f) => { setSelectedFile(f); f ? localStorage.setItem("ns_file", f) : localStorage.removeItem("ns_file"); };
  const handleLibChange  = (l) => { setActiveLib(l);    l ? localStorage.setItem("ns_lib",  l) : localStorage.removeItem("ns_lib");  };

  let content = null;

  if (activeIndex === 0) {
    content = (
      <OverviewInput
        selectedFile={selectedFile}
        activeLib={activeLib}
        onFileChange={handleFileChange}
        onLibChange={handleLibChange}
      />
    );
  } else if (activeIndex === 1) {
    content = <AnomalyDetection selectedFile={selectedFile} />;
  } else if (activeIndex === 2) {
    content = <KnowledgeBaseExplorer activeLib={activeLib} />;
  } else if (activeIndex === 3) {
    content = <SpectralMatching selectedFile={selectedFile} activeLib={activeLib} />;
  } else if (activeIndex === 4) {
    content = <VectorizationEngine selectedFile={selectedFile} />;
  } else if (activeIndex === 5) {
    content = <Spec2VecAnalysis selectedFile={selectedFile} />;
  } else if (activeIndex === 6) {
    content = <ComparativeResults selectedFile={selectedFile} activeLib={activeLib} />;
  } else if (activeIndex === 7) {
    content = <SummaryImpact />;
  } else if (activeIndex === 8) {
    content = <FuturePerspective />;
  }

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

export default NeuralSafetyContent;
