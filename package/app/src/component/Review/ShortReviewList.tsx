import type {ReviewDTO} from '@package/contract';
import {Stack} from '@mui/material';
import React from 'react';
import {SingleShortBookReviewShow} from './SingleShortBookReview';

export type ShortReviewListShowProps = {
  reviews: ReviewDTO[];
  onLike?: (reviewId: string) => void;
  onDislike?: (reviewId: string) => void;
  spacing?: number | string;
};

export const ShortReviewListShow: React.FC<ShortReviewListShowProps> = ({
  reviews,
  onLike,
  onDislike,
  spacing = 2,
}) => {
  // TODO Support useState
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null);

  return (
    <Stack spacing={spacing}>
      {reviews.map(review => (
        <SingleShortBookReviewShow
          key={review.id}
          review={review}
          onLike={onLike}
          onDislike={onDislike}
        />
      ))}
    </Stack>
  );
};
