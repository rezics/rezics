import type { PostDTO } from "@rezics/contract";
import { Separator } from "@rezics/ui/shadcn";
import type React from "react";
import { ReviewCard } from "./ReviewCard";

export interface ReviewCardPairProps {
  review1: PostDTO;
  review2: PostDTO;
}

export const ReviewCardPair: React.FC<ReviewCardPairProps> = ({
  review1,
  review2,
}) => {
  return (
    <div className="flex flex-col mb-2">
      <ReviewCard review={review1} />
      <Separator className="my-2" />
      <ReviewCard review={review2} />
    </div>
  );
};

export default ReviewCardPair;
