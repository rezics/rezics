import type { ReadlistDTO } from "@rezics/contract";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@rezics/ui/shadcn/carousel.tsx";
import type * as React from "react";
import { useMemo } from "react";
import ReadListCard from "../item/ReadListCard";
import { VerticalTwoReadListCard } from "../item/VerticalTwoReadListCard";

export interface HorizontalReadListCarouselProps {
  readlistList: ReadlistDTO[];
  className?: string;
  variant?: "single-line" | "double-line";
}

const CarouselItemClassName =
  // 'pl-4 basis-[100%] xsm:basis-[60%] md:basis-[50%] lg:basis-[30%] xl:basis-[25%] 2xl:basis-[20%]';
  "pl-4 basis-[90%] @xs:basis-[60%] @sm:basis-[50%] @md:basis-[45%] @lg:basis-[30%] @xl:basis-[25%] @2xl:basis-[20%]";

export const HorizontalReadListCarousel: React.FC<
  HorizontalReadListCarouselProps
> = ({ readlistList, className, variant = "single-line" }) => {
  const readlistPairs = useMemo(() => {
    if (variant === "single-line") return;
    const pairs: { readlist1: ReadlistDTO; readlist2: ReadlistDTO }[] = [];
    for (let i = 0; i < readlistList.length - 1; i += 2) {
      pairs.push({
        readlist1: readlistList[i],
        readlist2: readlistList[i + 1],
      });
    }
    return pairs;
  }, [readlistList, variant]);

  return (
    <Carousel
      className={["w-full", className ?? ""].join(" ")}
      opts={{
        align: "start",
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-4">
        {variant === "single-line"
          ? readlistList.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <CarouselItem key={index} className={CarouselItemClassName}>
                <ReadListCard readlist={item} />
              </CarouselItem>
            ))
          : readlistPairs?.map((pair, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <CarouselItem key={index} className={CarouselItemClassName}>
                <VerticalTwoReadListCard
                  readlist1={pair.readlist1}
                  readlist2={pair.readlist2}
                />
              </CarouselItem>
            ))}
      </CarouselContent>

      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};
