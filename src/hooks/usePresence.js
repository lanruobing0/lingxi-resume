import { useEffect, useState } from "react";

const EXIT_DURATION = 180;

export function usePresence(open, onExited) {
  const [isMounted, setIsMounted] = useState(open);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      setIsLeaving(false);
      return undefined;
    }

    if (!isMounted) return undefined;
    setIsLeaving(true);
    const timer = window.setTimeout(() => {
      setIsMounted(false);
      setIsLeaving(false);
      onExited?.();
    }, EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [isMounted, onExited, open]);

  return { isMounted, isLeaving };
}
