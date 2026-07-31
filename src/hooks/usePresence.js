import { useEffect, useState } from "react";

export function usePresence(isOpen, exitDuration = 180) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsExiting(false);
      return undefined;
    }

    if (!isMounted) return undefined;
    setIsExiting(true);
    const timeoutId = window.setTimeout(() => setIsMounted(false), exitDuration);
    return () => window.clearTimeout(timeoutId);
  }, [exitDuration, isMounted, isOpen]);

  return { isMounted, isExiting };
}
