import React from "react";
import { getAnimationProgress } from "../../utils/animationConfig";
import { IoCarSportOutline } from "react-icons/io5";
import { HiOutlineBolt } from "react-icons/hi2";
import { GiMedicines } from "react-icons/gi";
import { LuFactory } from "react-icons/lu";

const IndustriesContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const SECTION_INDUSTRIES = 5;
  const SECTION_IMPACT = 6;
  const { currentIndex, nextIndex, absP } =
    getAnimationProgress(scrollIndex, activeIndex, totalSections);

  const clamp = (v) => Math.max(0, Math.min(1, v));

  const isOnIndustries = activeIndex === SECTION_INDUSTRIES;
  const isEnteringIndustries = nextIndex === SECTION_INDUSTRIES;
  const isExitingIndustries = currentIndex === SECTION_INDUSTRIES && nextIndex === SECTION_IMPACT;

  let containerOpacity = 0;
  if (isOnIndustries && !isExitingIndustries) {
    containerOpacity = 1;
  } else if (isEnteringIndustries) {
    // Appare solo nell'ultimo 15% della transizione (absP 0.85 → 1.0)
    containerOpacity = clamp((absP - 0.85) / 0.15);
  } else if (isExitingIndustries) {
    // Scompare nel primo 15% della transizione (absP 0 → 0.15)
    containerOpacity = clamp(1 - absP / 0.15);
  }

  // usa una soglia invece di confronto esatto a 0
  if (containerOpacity <= 0.01) return null;


  const industries = [
    {
      title: "Automotive",
      icon: <IoCarSportOutline className="w-10 h-10" />,
      useCases: [
        "Lightweight alloys for fuel efficiency",
        "Battery materials for EVs",
        "High-temperature resistant polymers"
      ]
    },
    {
      title: "Energy",
      icon: <HiOutlineBolt className="w-10 h-10" />,
      useCases: [
        "Solar cell materials optimization",
        "Catalyst design for hydrogen production",
        "Grid-scale energy storage materials"
      ]
    },
    {
      title: "Pharma",
      icon: <GiMedicines className="w-10 h-10" />,
      useCases: [
        "Drug formulation optimization",
        "Biocompatible polymers",
        "Active ingredient stability prediction"
      ]
    },
    {
      title: "Manufacturing",
      icon: <LuFactory className="w-10 h-10" />,
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
        willChange: "opacity",
      }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl px-24">
        <div className="grid grid-cols-2 gap-6">
          {industries.map((industry, idx) => (
            <div
              key={idx}
              className="bg-[#1a1a1a] rounded-2xl p-6 flex items-stretch gap-5"
            >
              {/* Icon a sinistra, altezza piena */}
              <div className="flex items-center justify-center shrink-0 w-14 text-gray-100">
                {industry.icon}
              </div>

              {/* Titolo + elenco a destra */}
              <div className="flex flex-col justify-center">
                <h3 className="text-2xl font-semibold text-white mb-2">
                  {industry.title}
                </h3>
                <ul className="space-y-1.2">
                  {industry.useCases.map((useCase, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-gray-500 mr-2">•</span>
                      <span className="text-gray-400 text-sm leading-relaxed">
                        {useCase}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IndustriesContent;
