import type { ReactNode } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../shadcn/carousel";

export type DomainCarouselArrowVariant = "default" | "ghost";

export interface DomainCarouselProps<TItem> {
  items: readonly TItem[];
  renderItem: (item: TItem, index: number) => ReactNode;
  itemKey?: (item: TItem, index: number) => string | number;
  itemClassName?: string;
  className?: string;
  showArrows?: boolean;
  /** @deprecated no-op since shadcn upgrade — ArrowButton has no variants */
  arrowVariant?: DomainCarouselArrowVariant;
  scrollSnap?: "start" | "center";
  dragFree?: boolean;
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
