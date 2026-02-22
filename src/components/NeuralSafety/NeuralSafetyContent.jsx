import React from "react";
import KnowledgeBaseExplorer from "./KnowledgeBaseExplorer";
import VectorizationEngine from "./VectorizationEngine";
import SpectralMatching from "./SpectralMatching";
import { getAnimationProgress } from "../../utils/animationConfig";
import { LuFlaskConical } from "react-icons/lu";

const OverviewTab = () => (
  <div className="absolute inset-0 flex items-center justify-center px-12"
    style={{ paddingTop: "200px", paddingBottom: "100px" }}>
    <div className="w-full max-w-2xl">
      
    </div>
  </div>
);

const ComingSoonTab = ({ title }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="text-center">
      <LuFlaskConical className="w-12 h-12 mx-auto mb-4 text-amber-500/30" />
      <div className="text-lg font-semibold text-gray-400 mb-1">{title}</div>
      <div className="text-sm text-gray-600">This analysis step is under development</div>
    </div>
  </div>
);

const NeuralSafetyContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  let content = null;

  if (activeIndex === 0) {
    content = <OverviewTab />;
  } else if (activeIndex === 1) {
    content = <KnowledgeBaseExplorer />;
  } else if (activeIndex === 2) {
    content = <VectorizationEngine />;
  } else if (activeIndex === 3) {
    content = <SpectralMatching />;
  } else if (activeIndex === 4) {
    content = <ComingSoonTab title="Spec2Vec Analysis" />;
  } else if (activeIndex === 5) {
    content = <ComingSoonTab title="Risk Assessment" />;
  } else if (activeIndex === 6) {
    content = <ComingSoonTab title="Compliance Report" />;
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
