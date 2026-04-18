import type { UnitDTO } from "@rezics/contract";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@rezics/ui/shadcn/carousel.tsx";
import type * as React from "react";
import ExcerptCard from "../item/ExcerptCard";

export interface HorizontalExcerptCarouselProps {
  excerptList: UnitDTO[];
  className?: string;
}

export const HorizontalExcerptCarousel: React.FC<
  HorizontalExcerptCarouselProps
> = ({ excerptList, className }) => {
  if (!excerptList.length) {
    return null;
  }

  return (
    <Carousel
      className={["w-full", className ?? ""].join(" ")}
      opts={{
        align: "start",
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-4">
        {excerptList.map((item) => (
          <CarouselItem
            key={item.id}
            className="pl-4 basis-[100%] lg:basis-[50%] xl:basis-[40%]"
          >
            <ExcerptCard excerpt={item} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious variant="ghost" />
      <CarouselNext variant="ghost" />
    </Carousel>
  );
};

export default HorizontalExcerptCarousel;
