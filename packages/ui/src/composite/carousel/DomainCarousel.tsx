import type { ReactNode } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../shadcn/carousel";

export interface DomainCarouselProps<TItem> {
  items: readonly TItem[];
  renderItem: (item: TItem, index: number) => ReactNode;
  itemKey?: (item: TItem, index: number) => string | number;
  itemClassName?: string;
  className?: string;
  showArrows?: boolean;
  scrollSnap?: "start" | "center";
  dragFree?: boolean;
  wheelScroll?: boolean;
  ariaLabel?: string;
  emptyFallback?: ReactNode;
}

export function DomainCarousel<TItem>({
  items,
  renderItem,
  itemKey,
  itemClassName,
  className,
  showArrows = true,
  scrollSnap = "start",
  dragFree = true,
  wheelScroll = false,
  ariaLabel,
  emptyFallback = null,
}: DomainCarouselProps<TItem>) {
  if (items.length === 0) {
    return <>{emptyFallback}</>;
  }
  return (
    <Carousel
      className={["w-full", className ?? ""].join(" ")}
      aria-label={ariaLabel}
      opts={{ align: scrollSnap, dragFree }}
      wheelScroll={wheelScroll}
    >
      <CarouselContent className="-ml-4">
        {items.map((item, index) => (
          <CarouselItem
            key={itemKey?.(item, index) ?? index}
            className={itemClassName}
          >
            {renderItem(item, index)}
          </CarouselItem>
        ))}
      </CarouselContent>
      {showArrows ? (
        <>
          <CarouselPrevious />
          <CarouselNext />
        </>
      ) : null}
    </Carousel>
  );
}
