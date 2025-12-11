import {useEffect, useState} from 'react';

type MasonryParams = {
  columns: number;
  spacing: number;
};

function calcMasonryParams(width: number): MasonryParams {
  if (width >= 2100) {
    return {columns: 6, spacing: 2.5};
  }
  if (width >= 1536) {
    return {columns: 5, spacing: 2.5};
  }
  if (width >= 1280) {
    return {columns: 4, spacing: 3};
  }
  if (width >= 1024) {
    return {columns: 3, spacing: 2.5};
  }
  if (width >= 768) {
    return {columns: 2, spacing: 2};
  }
  if (width >= 640) {
    return {columns: 2, spacing: 1.5};
  }

  // < 640
  return {columns: 1, spacing: 1};
}

export function useMasonryParameters(): MasonryParams {
  const [params, setParams] = useState<MasonryParams>(() => {
    // SSR / 初始渲染兜底
    if (typeof window === 'undefined') {
      return {columns: 4, spacing: 2};
    }
    return calcMasonryParams(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setParams(calcMasonryParams(window.innerWidth));
    };

    // 初始化再算一次，防止初始宽度变化
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return params;
}

// 轻量 throttle
function throttle<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let last = 0;
  let timer: any = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - last);

    if (remaining <= 0) {
      clearTimeout(timer);
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
}

export function useThrottleMasonryParameters(throttleMs = 1000): MasonryParams {
  const [params, setParams] = useState<MasonryParams>(() => {
    if (typeof window === 'undefined') {
      return {columns: 4, spacing: 2}; // SSR 兜底
    }
    return calcMasonryParams(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 包一层节流
    const throttledResize = throttle(() => {
      setParams(calcMasonryParams(window.innerWidth));
    }, throttleMs);

    // 立刻执行一次
    throttledResize();

    window.addEventListener('resize', throttledResize);
    return () => window.removeEventListener('resize', throttledResize);
  }, [throttleMs]);

  return params;
}
