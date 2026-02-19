import React from 'react';
import type {ReviewMeiliDTO} from '@package/contract';
import ReviewCard from './ReviewCard';

interface VerticalTwoReviewCardProps {
  review1: ReviewMeiliDTO;
  review2: ReviewMeiliDTO;
}

export const VerticalTwoReviewCard: React.FC<VerticalTwoReviewCardProps> = ({
  review1,
  review2,
}) => {
  return (
    <div className="flex flex-col gap-4 mb-2">
      <ReviewCard review={review1} />
      <ReviewCard review={review2} />
    </div>
  );
};

export default VerticalTwoReviewCard;
