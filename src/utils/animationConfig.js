export const ANIMATION_CONFIG = {
  clamp: (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
};

export function getAnimationProgress(scrollIndex, activeIndex, sectionsLength) {
  const { clamp } = ANIMATION_CONFIG;
  const currentIndex = Math.max(0, Math.min(sectionsLength - 1, activeIndex));
  const signedProgress = scrollIndex - currentIndex;
  const direction = signedProgress === 0 ? 0 : Math.sign(signedProgress);
  const absP = clamp(Math.abs(signedProgress));

  return {
    currentIndex,
    nextIndex: direction >= 0 ? currentIndex + 1 : currentIndex - 1,
    direction,
    absP,
    eased: absP,
    exitProgress: absP,
    exitProgressEased: absP,
    currentOpacity: 1 - absP,
    nextOpacity: absP
  };
}
