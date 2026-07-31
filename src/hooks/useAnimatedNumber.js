import { useEffect, useState } from "react";

export function useAnimatedNumber(value, enabled, duration = 480) {
  const [displayValue, setDisplayValue] = useState(value || 0);

  useEffect(() => {
    const nextValue = Number(value);
    if (!enabled || !Number.isFinite(nextValue)) {
      setDisplayValue(Number.isFinite(nextValue) ? nextValue : 0);
      return undefined;
    }

    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(nextValue);
      return undefined;
    }

    const startedAt = performance.now();
    let frameId = 0;
    const update = (time) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(nextValue * eased));
      if (progress < 1) frameId = window.requestAnimationFrame(update);
    };
    frameId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frameId);
  }, [duration, enabled, value]);

  return displayValue;
}
