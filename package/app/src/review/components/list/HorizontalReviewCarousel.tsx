import type { PostDTO } from "@rezics/contract";
import type * as React from "react";
import { useMemo } from "react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import { ReviewCardPair } from "@/review/components/item/ReviewCardPair";

export interface HorizontalReviewCarouselProps {
  reviewList: PostDTO[];
  className?: string;
}

interface ReviewPair {
  review1: PostDTO;
  review2: PostDTO;
}

export const HorizontalReviewCarousel: React.FC<
  HorizontalReviewCarouselProps
> = ({ reviewList, className }) => {
  const reviewPairs = useMemo(() => {
    const pairs: ReviewPair[] = [];
    for (let i = 0; i < reviewList.length - 1; i += 2) {
      pairs.push({ review1: reviewList[i], review2: reviewList[i + 1] });
    }
    return pairs;
  }, [reviewList]);

  if (!reviewPairs.length) {
    return null;
  }

  return (
    <DomainCarousel
      items={reviewPairs}
      itemKey={(_pair, index) => index}
      itemClassName="pl-4 basis-[100%] lg:basis-[50%] xl:basis-[40%]"
      className={className}
      ariaLabel="Review pairs"
      renderItem={(pair) => (
        <ReviewCardPair review1={pair.review1} review2={pair.review2} />
      )}
    />
  );
};
