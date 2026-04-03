import React from 'react';
import type {ReviewMeiliDTO} from '@rezics/contract';
import ReviewCard from './ReviewCard';
import {Divider} from '@mui/material';

interface VerticalTwoReviewCardProps {
  review1: ReviewMeiliDTO;
  review2: ReviewMeiliDTO;
}

export const VerticalTwoReviewCard: React.FC<VerticalTwoReviewCardProps> = ({
  review1,
  review2,
}) => {
  return (
    <div className="flex flex-col mb-2">
      <ReviewCard review={review1} />
      <Divider sx={{my: 1}} />
      <ReviewCard review={review2} />
    </div>
  );
};

export default VerticalTwoReviewCard;
