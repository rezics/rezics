import {Stack} from '@mui/material';
import React from 'react';
import {SingleShortBookReviewShow} from './SingleShortBookReview';
import type {ReviewListResponse} from '@package/contract';

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
      {(Array.isArray(data.reviews) ? data.reviews : []).map(review => (
        <SingleShortBookReviewShow
          key={review.unitId}
          review={review}
          onLike={onLike}
          onDislike={onDislike}
        />
      ))}
    </Stack>
  );
};
