import { useEffect, useState } from "react";
import { SimpleProgress } from "./SimpleProgress";
import { useFakeProgress } from "./useFakeProgress";

interface GlobalProgressBarProps {
  loadingKey?: string | number;
  durationMin?: number;
  durationMax?: number;
}

export function GlobalProgressBar({
  loadingKey,
  durationMin = 300,
  durationMax = 1000,
}: GlobalProgressBarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const progress = useFakeProgress(isLoading);

  useEffect(() => {
    if (loadingKey === undefined) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const duration = Math.random() * (durationMax - durationMin) + durationMin;

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [loadingKey, durationMin, durationMax]);

  return <SimpleProgress progress={progress} />;
}
