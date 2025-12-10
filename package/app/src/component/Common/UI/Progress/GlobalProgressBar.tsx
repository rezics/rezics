import {useEffect, useState} from 'react';
import {useLocation} from 'wouter';
import {useFakeProgress} from './useFakeProgress';
import {SimpleProgress} from './SimpleProgress';

interface GlobalProgressBarProps {
  durationMin?: number;
  durationMax?: number;
}

export function GlobalProgressBar({
  durationMin = 300,
  durationMax = 1000,
}: GlobalProgressBarProps) {
  const [location, _navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const progress = useFakeProgress(isLoading);

  useEffect(() => {
    console.log('progress location', location);

    setIsLoading(true);

    const duration = Math.random() * (durationMax - durationMin) + durationMin;

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [location]);

  return <SimpleProgress progress={progress} />;
}
