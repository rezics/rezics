import {useQuery} from '@tanstack/react-query';
import React from 'react';
import {ShortReviewListShow} from '../Review/ShortReviewList.tsx';
import {buildMeiliUnitQuery} from '@package/api/meili/meili.queries';
import {mapUnitListToReviewListResponse} from '@package/api/meili/meili.api';
import {UnitType} from '@package/contract';
import {useTranslation} from 'react-i18next';
interface ShortBookReviewsProps {
  bookId: string;
}

// 短评就是Post评论

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({bookId}) => {
  const {t} = useTranslation();
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
    return <div>{t('common.loading')}</div>;
  }
  if (error && error instanceof Error) {
    return (
      <div>
        {t('common.error')}: {error.message}
      </div>
    );
  }

  return (
    <ShortReviewListShow
      data={{reviews: data?.reviews?.slice(0, 4) || [], total: data?.total}}
      onLike={handleLike}
      onDislike={handleDislike}
    />
  );
};
