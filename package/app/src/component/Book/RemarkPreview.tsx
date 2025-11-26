import {useQuery} from '@tanstack/react-query';
import React from 'react';
import {ShortReviewListShow} from '../Review/ShortReviewList.tsx';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {mapUnitListToReviewListResponse} from '@/api/meili/meili.api';
import {UnitType} from '@package/contract/src/unit';
interface ShortBookReviewsProps {
  bookId: string;
}

// 短评就是Post评论

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({bookId}) => {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.REMARK,
      0,
      bookId,
      '',
      4,
      mapUnitListToReviewListResponse,
      {
        enabled: !!bookId,
      },
    ),
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
