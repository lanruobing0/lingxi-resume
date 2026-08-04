import { useEffect, useState } from "react";

export function useCountUp(value, shouldAnimate, duration = 420) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!shouldAnimate || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return undefined;
    }

    setDisplayValue(0);
    const startTime = performance.now();
    let frameId = 0;
    const update = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      setDisplayValue(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frameId = window.requestAnimationFrame(update);
    };
    frameId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frameId);
  }, [duration, shouldAnimate, value]);

  return displayValue;
}
