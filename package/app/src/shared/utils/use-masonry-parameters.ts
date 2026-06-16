import { useEffect, useState } from "react";

type MasonryParams = {
  columns: number;
  spacing: number;
};

function calcMasonryParams(width: number): MasonryParams {
  if (width >= 2100) {
    return { columns: 6, spacing: 2.5 };
  }
  if (width >= 1536) {
    return { columns: 5, spacing: 2.5 };
  }
  if (width >= 1280) {
    return { columns: 4, spacing: 3 };
  }
  if (width >= 1024) {
    return { columns: 3, spacing: 2.5 };
  }
  if (width >= 768) {
    return { columns: 2, spacing: 2 };
  }
  if (width >= 640) {
    return { columns: 2, spacing: 1.5 };
  }

  // < 640
  return { columns: 1, spacing: 1 };
}

export function useMasonryParameters(): MasonryParams {
  const [params, setParams] = useState<MasonryParams>(() => {
    // SSR / initial-render fallback.
    // SSR / 初始渲染兜底。
    if (typeof window === "undefined") {
      return { columns: 4, spacing: 2 };
    }
    return calcMasonryParams(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setParams(calcMasonryParams(window.innerWidth));
    };

    // Recompute once on init to guard against an initial width change.
    // 初始化再算一次，防止初始宽度变化。
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return params;
}

// Lightweight throttle with cancel support.
// 支持取消的轻量 throttle。
function throttle<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - last);

    if (remaining <= 0) {
      clearTimeout(timer!);
      timer = null;
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };

  // Clear any pending trailing timer.
  // 清除待执行的尾部定时器。
  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return throttled;
}

export function useThrottleMasonryParameters(throttleMs = 1000): MasonryParams {
  const [params, setParams] = useState<MasonryParams>(() => {
    if (typeof window === "undefined") {
      return { columns: 4, spacing: 2 }; // SSR fallback — SSR 兜底
    }
    return calcMasonryParams(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Wrap with throttling.
    // 包一层节流。
    const throttledResize = throttle(() => {
      setParams(calcMasonryParams(window.innerWidth));
    }, throttleMs);

    // Run once immediately.
    // 立刻执行一次。
    throttledResize();

    window.addEventListener("resize", throttledResize);
    return () => {
      window.removeEventListener("resize", throttledResize);
      // Cancel any pending trailing timer to avoid setState after unmount.
      // 取消待执行的尾部定时器，避免卸载后 setState。
      throttledResize.cancel();
    };
  }, [throttleMs]);

  return params;
}
