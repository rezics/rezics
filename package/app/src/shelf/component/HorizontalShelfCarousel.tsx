import type { ShelfDTO } from "@rezics/contract";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@rezics/ui/shadcn/carousel.tsx";
import type * as React from "react";
import { ShelfCard } from "./ShelfCard";

export interface HorizontalShelfCarouselProps {
  shelves: ShelfDTO[];
  className?: string;
}

const CarouselItemClassName =
  "pl-4 basis-[90%] @xs:basis-[60%] @sm:basis-[50%] @md:basis-[45%] @lg:basis-[30%] @xl:basis-[25%] @2xl:basis-[20%]";

export const HorizontalShelfCarousel: React.FC<
  HorizontalShelfCarouselProps
> = ({ shelves, className }) => {
  return (
    <Carousel
      className={["w-full", className ?? ""].join(" ")}
      opts={{
        align: "start",
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-4">
        {shelves.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <CarouselItem key={index} className={CarouselItemClassName}>
            <ShelfCard shelf={item} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};
