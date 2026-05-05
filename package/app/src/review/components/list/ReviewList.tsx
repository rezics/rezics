import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { ReviewCard } from "../item/ReviewCard";

const SPACING_CLASS_BY_NUMBER: Record<number, string> = {
  0: "gap-0",
  1: "gap-2",
  2: "gap-4",
  3: "gap-6",
  4: "gap-8",
};

export interface ReviewListProps {
  reviews: PostDTO[];
  spacing?: number | string;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  spacing = 0,
}) => {
  const gapClass =
    typeof spacing === "number"
      ? (SPACING_CLASS_BY_NUMBER[spacing] ?? "gap-4")
      : "gap-4";
  return (
    <div className={`flex flex-col ${gapClass}`}>
      {reviews.map((review) => (
        <ReviewCard key={review.unitId} review={review} />
      ))}
    </div>
  );
};
