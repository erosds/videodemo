import React, { useState } from "react";
import DatasetSelector from "./DatasetSelector";
import ModelSelector from "./ModelSelector";
import TrainingView from "./TrainingView";
import FeatureImportanceView from "./FeatureImportanceView";
import { getAnimationProgress } from "../../utils/animationConfig";

const PredictLabContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState(null);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const [trainingResults, setTrainingResults] = useState({});

  const { currentOpacity } = getAnimationProgress(
    scrollIndex,
    activeIndex,
    totalSections
  );

  const toggleModel = (modelName) => {
    setSelectedModels(prev =>
      prev.includes(modelName)
        ? prev.filter(m => m !== modelName)
        : [...prev, modelName]
    );
    setIsTrainingComplete(false); // Reset training quando cambi modelli
  };

  // Determina quale contenuto mostrare
  let content = null;
  let contentOpacity = 0;

  if (activeIndex === 0) {
    content = (
      <DatasetSelector
        onSelect={setSelectedDataset}
        selectedDataset={selectedDataset}
        onColumnsChange={setSelectedFeatures}
      />
    );
    contentOpacity = currentOpacity;
  } else if (activeIndex === 1) {
    content = (
      <ModelSelector
        selectedModels={selectedModels}
        onToggle={toggleModel}
        canProceed={!!selectedDataset}
      />
    );
    contentOpacity = currentOpacity;
  } else if (activeIndex === 2) {
    content = (
      <TrainingView
        dataset={selectedDataset}
        selectedModels={selectedModels}
        selectedFeatures={selectedFeatures}
        onTrainingComplete={(complete, results) => {
          setIsTrainingComplete(complete);
          if (results) setTrainingResults(results);
        }}
      />
    );
    contentOpacity = currentOpacity;
  } else if (activeIndex === 3) {
    content = (
      <FeatureImportanceView
        dataset={selectedDataset}
        trainedModels={isTrainingComplete ? selectedModels : []}
        trainingResults={trainingResults}
      />
    );
    contentOpacity = currentOpacity;
  }

  if (contentOpacity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: contentOpacity,
        willChange: "opacity",
      }}
    >
      <div className="absolute inset-0 pointer-events-auto">
        {content}
      </div>
    </div>
  );
};

export default PredictLabContent;