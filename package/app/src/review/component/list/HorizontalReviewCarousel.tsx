import type { ReviewDTO } from "@rezics/contract";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@rezics/ui/shadcn/carousel.tsx";
import type * as React from "react";
import { useMemo } from "react";
import { VerticalTwoReviewCard } from "@/review/component/item/VerticalTwoReviewCard";

export interface HorizontalReviewCarouselProps {
  reviewList: ReviewDTO[];
  className?: string;
}

export const HorizontalReviewCarousel: React.FC<
  HorizontalReviewCarouselProps
> = ({ reviewList, className }) => {
  /**
   * 把 review 切成两两一组
   * [1,2,3,4,5] -> [[1,2], [3,4]]
   * 单数会自动丢弃最后一个
   */
  const reviewPairs = useMemo(() => {
    const pairs: { review1: ReviewDTO; review2: ReviewDTO }[] = [];

    for (let i = 0; i < reviewList.length - 1; i += 2) {
      pairs.push({
        review1: reviewList[i],
        review2: reviewList[i + 1],
      });
    }

    return pairs;
  }, [reviewList]);

  if (!reviewPairs.length) {
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
        {reviewPairs.map((pair, index) => (
          <CarouselItem
            key={index}
            className="pl-4 basis-[100%] lg:basis-[50%] xl:basis-[40%]"
          >
            <VerticalTwoReviewCard
              review1={pair.review1}
              review2={pair.review2}
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious variant="ghost" />
      <CarouselNext variant="ghost" />
    </Carousel>
  );
};
