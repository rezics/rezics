import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SimpleProgress } from "./SimpleProgress";
import { useFakeProgress } from "./useFakeProgress";

interface GlobalProgressBarProps {
  durationMin?: number;
  durationMax?: number;
}

export function GlobalProgressBar({
  durationMin = 300,
  durationMax = 1000,
}: GlobalProgressBarProps) {
  const locationKey = useRouterState({
    select: (s) => `${s.location.pathname}${s.location.search ?? ""}`,
  });
  const [isLoading, setIsLoading] = useState(false);
  const progress = useFakeProgress(isLoading);

  useEffect(() => {
    console.log("progress location", locationKey);

    setIsLoading(true);

    const duration = Math.random() * (durationMax - durationMin) + durationMin;

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [locationKey, durationMin, durationMax]);

  return <SimpleProgress progress={progress} />;
}
