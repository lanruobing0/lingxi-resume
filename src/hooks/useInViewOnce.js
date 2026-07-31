import { useEffect, useRef, useState } from "react";

export function useInViewOnce() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || isVisible || typeof IntersectionObserver === "undefined") {
      if (node && typeof IntersectionObserver === "undefined") setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsVisible(true);
      observer.disconnect();
    }, { threshold: 0.14, rootMargin: "0px 0px -8%" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  return [ref, isVisible];
}
