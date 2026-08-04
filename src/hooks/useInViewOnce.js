import { useEffect, useRef, useState } from "react";

export function useInViewOnce({ threshold = 0.14, rootMargin = "0px 0px -7%" } = {}) {
  const ref = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    setIsReady(true);
    if (typeof IntersectionObserver === "undefined") {
      setHasEntered(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHasEntered(true);
      observer.unobserve(entry.target);
    }, { threshold, rootMargin });

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return { ref, isReady, hasEntered };
}
