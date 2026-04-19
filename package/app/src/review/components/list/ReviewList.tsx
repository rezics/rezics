import { Stack } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { ReviewCard } from "../item/ReviewCard";

export interface ReviewListProps {
  reviews: PostDTO[];
  spacing?: number | string;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  spacing = 2,
}) => {
  return (
    <Stack spacing={spacing}>
      {reviews.map((review) => (
        <ReviewCard key={review.unitId} review={review} />
      ))}
    </Stack>
  );
};
