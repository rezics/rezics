import { Stack } from "@mui/material";
import type { ReviewListResponse } from "@rezics/contract";
import type React from "react";
import { SingleRemarkShow } from "./SingleRemark";

export type ShortReviewListShowProps = {
  data: ReviewListResponse;
  onLike?: (reviewId: string) => void;
  onDislike?: (reviewId: string) => void;
  spacing?: number | string;
};

export const ShortReviewListShow: React.FC<ShortReviewListShowProps> = ({
  data,
  onLike,
  onDislike,
  spacing = 2,
}) => {
  // TODO Support useState
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null);

  return (
    <Stack spacing={spacing}>
      {(Array.isArray(data.reviews) ? data.reviews : []).map((review) => (
        <SingleRemarkShow
          key={review.unitId}
          review={review}
          onLike={onLike}
          onDislike={onDislike}
        />
      ))}
    </Stack>
  );
};
