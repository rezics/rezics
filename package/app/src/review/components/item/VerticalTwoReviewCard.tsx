import { Divider } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { ReviewCard } from "./ReviewCard";

interface VerticalTwoReviewCardProps {
  review1: PostDTO;
  review2: PostDTO;
}

export const VerticalTwoReviewCard: React.FC<VerticalTwoReviewCardProps> = ({
  review1,
  review2,
}) => {
  return (
    <div className="flex flex-col mb-2">
      <ReviewCard review={review1} />
      <Divider sx={{ my: 1 }} />
      <ReviewCard review={review2} />
    </div>
  );
};

export default VerticalTwoReviewCard;
