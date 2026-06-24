import { useEffect, useRef } from "react";
import type { CarouselApi } from "#/shadcn/carousel";

type UseEmblaAutoplayOptions = {
  interval?: number;
  enabled?: boolean;
  stopOnInteraction?: boolean;
};

export function useEmblaAutoplay(
  api: CarouselApi | null,
  {
    interval = 3000,
    enabled = true,
    stopOnInteraction = true,
  }: UseEmblaAutoplayOptions = {},
) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!api || !enabled) return;

    const play = () => {
      if (intervalRef.current !== null) return;

      intervalRef.current = window.setInterval(() => {
        api.scrollNext();
      }, interval);
    };

    const stop = () => {
      if (intervalRef.current === null) return;

      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };

    play();

    if (stopOnInteraction) {
      api.on("pointerDown", stop);
      api.on("pointerUp", play);
    }

    return () => {
      stop();

      if (stopOnInteraction) {
        api.off("pointerDown", stop);
        api.off("pointerUp", play);
      }
    };
  }, [api, interval, enabled, stopOnInteraction]);
}
