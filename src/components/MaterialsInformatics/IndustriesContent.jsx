import React from "react";
import { getAnimationProgress } from "../../utils/animationConfig";
import { IoCarSportOutline } from "react-icons/io5";
import { HiOutlineBolt } from "react-icons/hi2";
import { GiMedicines } from "react-icons/gi";
import { LuFactory } from "react-icons/lu";

const GradientIcon = ({ icon: Icon, id, from, to }) => (
  <>
    <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
    </svg>
    <Icon className="w-10 h-10" style={{ fill: `url(#${id})`, stroke: `url(#${id})` }} />
  </>
);

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
      icon: <GradientIcon icon={IoCarSportOutline} id="grad-auto" from="#60a5fa" to="#22d3ee" />,
      useCases: [
        "Selecting the right alloy composition for a structural component based on target weight and strength.",
        "Comparing candidate battery materials on conductivity and stability before running lab experiments."
      ]
    },
    {
      title: "Energy",
      icon: <GradientIcon icon={HiOutlineBolt} id="grad-energy" from="#facc15" to="#f97316" />,
      useCases: [
        "Screening solar cell material formulations to find the best trade-off between efficiency and durability.",
        "Identifying which catalyst variants are worth testing for hydrogen production, reducing lab iterations."
      ]
    },
    {
      title: "Pharma",
      icon: <GradientIcon icon={GiMedicines} id="grad-pharma" from="#34d399" to="#059669" />,
      useCases: [
        "Predicting how a drug formulation will behave over time based on its ingredient composition.",
        "Selecting excipients that improve shelf life and dissolution without running extensive stability tests."
      ]
    },
    {
      title: "Manufacturing",
      icon: <GradientIcon icon={LuFactory} id="grad-mfg" from="#a78bfa" to="#ec4899" />,
      useCases: [
        "Choosing the right protective coating for a given environment based on properties and conditions.",
        "Evaluating new powder materials for 3D printing before committing to full production runs."
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl px-24">
        <div className="grid grid-cols-2 gap-6">
          {industries.map((industry, idx) => (
            <div
              key={idx}
              className="bg-[#1a1a1a] rounded p-6 flex items-stretch gap-5"
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
