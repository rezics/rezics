import {reviewQueries} from '@/api/review/review';
import {useQuery} from '@tanstack/react-query';
import React, {useEffect, useState} from 'react';
import {ShortReviewListShow} from '../Review/ShortReviewList.tsx';

type Review = {
  likes?: number;
  dislikes?: number;
};

interface ShortBookReviewsProps {
  bookId: string;
}

// 短评就是Post评论

export const ShortBookReviews: React.FC<ShortBookReviewsProps> = ({bookId}) => {
  const {data, isLoading, error} = useQuery(
    reviewQueries.byBook(bookId, {limit: 4}),
  );

  const reviews: any = data?.reviews || [];

  const handleLike = (reviewId: string) => {
    console.log('Like review:', reviewId);
  };

  const handleDislike = (reviewId: string) => {
    console.log('Dislike review:', reviewId);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error && error instanceof Error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <ShortReviewListShow
      reviews={reviews}
      onLike={handleLike}
      onDislike={handleDislike}
    />
  );
};
