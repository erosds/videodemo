import React, { useState } from "react";
import ComplianceOverview from "./ComplianceOverview";
import DocumentUpload from "./DocumentUpload";
import ComplianceChat from "./ComplianceChat";
import BatchCompare from "./BatchCompare";
import AuditTrail from "./AuditTrail";
import IngredientCheck from "./IngredientCheck";
import { getAnimationProgress } from "../../utils/animationConfig";

const ChemicalComplianceContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const [docs, setDocs] = useState([]);

  let content = null;

  if (activeIndex === 0) {
    content = <ComplianceOverview />;
  } else if (activeIndex === 1) {
    content = <DocumentUpload onDocsChange={setDocs} />;
  } else if (activeIndex === 2) {
    content = <ComplianceChat docs={docs} />;
  } else if (activeIndex === 3) {
    content = <BatchCompare />;
  } else if (activeIndex === 4) {
    content = <AuditTrail />;
  } else if (activeIndex === 5) {
    content = <IngredientCheck />;
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

export default ChemicalComplianceContent;
