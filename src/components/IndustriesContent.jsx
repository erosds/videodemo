import React from "react";
import { getAnimationProgress } from "../utils/animationConfig";

const IndustriesContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const SECTION_INDUSTRIES = 5;

  const { currentIndex, nextIndex, currentOpacity, nextOpacity } =
    getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const isOnIndustries = activeIndex === SECTION_INDUSTRIES;
  const isEnteringIndustries = nextIndex === SECTION_INDUSTRIES;
  const shouldShow = isOnIndustries || isEnteringIndustries;

  let containerOpacity = 0;
  if (isOnIndustries) {
    containerOpacity = currentOpacity;
  } else if (isEnteringIndustries) {
    containerOpacity = nextOpacity;
  }

  if (!shouldShow) return null;

  const industries = [
    {
      title: "Automotive",
      gradient: "from-blue-600 to-cyan-600",
      useCases: [
        "Lightweight alloys for fuel efficiency",
        "Battery materials for EVs",
        "High-temperature resistant polymers"
      ]
    },
    {
      title: "Energy",
      gradient: "from-green-600 to-emerald-600",
      useCases: [
        "Solar cell materials optimization",
        "Catalyst design for hydrogen production",
        "Grid-scale energy storage materials"
      ]
    },
    {
      title: "Pharma",
      gradient: "from-purple-600 to-pink-600",
      useCases: [
        "Drug formulation optimization",
        "Biocompatible polymers",
        "Active ingredient stability prediction"
      ]
    },
    {
      title: "Manufacturing",
      gradient: "from-orange-600 to-red-600",
      useCases: [
        "Corrosion-resistant coatings",
        "3D printing materials",
        "Smart materials for IoT sensors"
      ]
    }
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: containerOpacity,
        transition: "none",
        willChange: "opacity",
      }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl px-8">
        <div className="grid grid-cols-2 gap-6">
          {industries.map((industry, idx) => (
            <div
              key={idx}
              className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-800"
            >
              <h3
                className={`text-4xl font-bold mb-6 bg-gradient-to-r ${industry.gradient} bg-clip-text`}
                style={{
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {industry.title}
              </h3>
              
              <ul className="space-y-3">
                {industry.useCases.map((useCase, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-gray-400 mr-3">•</span>
                    <span className="text-gray-300 text-sm leading-relaxed">
                      {useCase}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IndustriesContent;