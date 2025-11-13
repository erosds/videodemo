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
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      useCases: [
        "Lightweight alloys for fuel efficiency",
        "Battery materials for EVs",
        "High-temperature resistant polymers"
      ]
    },
    {
      title: "Energy",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      useCases: [
        "Solar cell materials optimization",
        "Catalyst design for hydrogen production",
        "Grid-scale energy storage materials"
      ]
    },
    {
      title: "Pharma",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      useCases: [
        "Drug formulation optimization",
        "Biocompatible polymers",
        "Active ingredient stability prediction"
      ]
    },
    {
      title: "Manufacturing",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl px-8">
        <div className="grid grid-cols-4 gap-8">
          {industries.map((industry, idx) => (
            <div
              key={idx}
              className="bg-[#1a1a1a] rounded-2xl p-8 border border-gray-900 flex flex-col items-center"
            >
              <div className="flex flex-col items-center mb-6">
                <div
                  className="bg-gradient-to-r from-slate-200 via-gray-300 to-gray-400 bg-clip-text mb-4"
                  style={{
                    WebkitBackgroundClip: "text",
                  }}
                >
                  {industry.icon}
                </div>
                <h3 className="text-4xl font-semibold text-white mb-4">
                  {industry.title}
                </h3>
              </div>

              <ul className="space-y-3 w-full">
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