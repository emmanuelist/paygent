import { useEffect, useRef, RefObject } from "react";

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeGesture(
  ref: RefObject<HTMLElement>,
  { onSwipeLeft, onSwipeRight, threshold = 50 }: UseSwipeGestureOptions
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      touchStart.current = null;

      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (Math.abs(deltaX) < threshold) return;

      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, onSwipeLeft, onSwipeRight, threshold]);
}
