import {useEffect, useRef, useState} from 'react';

export function useFakeProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (active) {
      setProgress(0.05);

      const tick = () => {
        setProgress(prev => {
          if (prev < 0.8) return prev + Math.random() * 0.1; // 前段快
          if (prev < 0.95) return prev + Math.random() * 0.02; // 后段慢
          return prev;
        });
        timerRef.current = setTimeout(tick, 300);
      };

      tick();
    } else {
      // 延迟一点再收尾，避免闪一下就没了
      setProgress(1);
      timerRef.current = setTimeout(() => {
        setProgress(0);
      }, 400);
    }

    return () => clearTimeout(timerRef.current);
  }, [active]);

  return progress;
}
