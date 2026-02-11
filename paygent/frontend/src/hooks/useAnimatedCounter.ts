import { useState, useEffect, useRef } from "react";

export function useAnimatedCounter(value: number, decimals = 2, duration = 500) {
  const [displayValue, setDisplayValue] = useState(value.toFixed(decimals));
  const prevValueRef = useRef(value);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;

    if (from === to) {
      setDisplayValue(to.toFixed(decimals));
      return;
    }

    const startTime = performance.now();
    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      const current = from + (to - from) * eased;
      setDisplayValue(current.toFixed(decimals));

      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, decimals, duration]);

  return displayValue;
}
