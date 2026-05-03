import type React from "react";
import { useEffect, useState } from "react";
import type { CarouselApi } from "@/shadcn/carousel";
import { cn } from "@/shared/lib/utils";

export type CarouselIndicatorProps = {
  api: CarouselApi | null;
  position?: "overlay" | "bottom";
  align?: "center" | "left" | "right";
  variant?: "text" | "dots";
  clickable?: boolean;
  className?: string;
};

export const CarouselIndicator: React.FC<CarouselIndicatorProps> = ({
  api,
  position = "overlay",
  align = "center",
  variant = "dots",
  clickable = true,
  className,
}) => {
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const update = () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    };

    update();
    api.on("select", update);
    api.on("reInit", update);

    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  const alignClass =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "left"
        ? "left-4"
        : "right-4";

  const positionClass =
    position === "overlay" ? "absolute bottom-4" : "relative mt-3";

  const handleSelect = (index: number) => {
    if (!api || !clickable) return;
    api.scrollTo(index);
  };

  return (
    <div className={cn(positionClass, alignClass, "z-20", className)}>
      {variant === "text" ? (
        <span className="bg-black/50 text-white px-3 py-1 rounded-full backdrop-blur text-sm">
          {current + 1} / {count}
        </span>
      ) : (
        <div className="flex gap-2">
          {Array.from({ length: count }).map((_, i) => {
            const active = i === current;
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: static list
                key={i}
                type="button"
                onClick={() => handleSelect(i)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-200",
                  clickable && "cursor-pointer",
                  active
                    ? "bg-black scale-110 dark:bg-white"
                    : "bg-black/40 hover:bg-black/70 dark:bg-white/40 dark:hover:bg-white/70",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
