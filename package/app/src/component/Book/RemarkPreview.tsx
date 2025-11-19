import {remarkQueries} from '@/api/review/review';
import {useQuery} from '@tanstack/react-query';
import React from 'react';
import {ShortReviewListShow} from '../Review/ShortReviewList.tsx';
interface ShortBookReviewsProps {
  bookId: string;
}

// 短评就是Post评论

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({bookId}) => {
  const {data, isLoading, error} = useQuery(
    remarkQueries.list({bookId, limit: 4}),
  );

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
      data={data ?? {reviews: [], total: 0}}
      onLike={handleLike}
      onDislike={handleDislike}
    />
  );
};
