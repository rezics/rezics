import type React from "react";
import { useRef } from "react";

/**
 * Returns touch handlers that fire `callback` after a sustained press.
 * Cancels on move (so scrolling doesn't trigger the menu).
 */
export function useLongPress(
  callback: (e: React.TouchEvent) => void,
  ms = 500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedEvent = useRef<React.TouchEvent | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    savedEvent.current = e;
    timerRef.current = setTimeout(() => {
      if (savedEvent.current) callback(savedEvent.current);
    }, ms);
  };

  const onTouchEnd = () => {
    clearTimeout(timerRef.current);
    savedEvent.current = null;
  };

  const onTouchMove = () => {
    clearTimeout(timerRef.current);
    savedEvent.current = null;
  };

  return { onTouchStart, onTouchEnd, onTouchMove };
}
