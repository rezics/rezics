import type React from "react";
import { useEffect, useRef } from "react";

/**
 * Returns touch handlers that fire `callback` after a sustained press.
 * Cancels on move (so scrolling doesn't trigger the menu) and clears the
 * pending timer on unmount to prevent firing on a stale component.
 * 返回触摸处理器，在持续按压后触发 `callback`。
 * 移动时取消（避免滚动误触菜单），并在卸载时清除待执行的定时器以
 * 防止在已卸载组件上触发。
 */
export function useLongPress(
  callback: (e: React.TouchEvent) => void,
  ms = 500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedEvent = useRef<React.TouchEvent | null>(null);

  // Clear any pending timer on unmount.
  // 卸载时清除待执行的定时器。
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

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
