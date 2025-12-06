import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Tabs, Tab, Box} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Navigation/Pagination';
import {ReviewListContainer} from '@/component/Review/ReviewList';
import type {ReviewDTO} from '@package/contract';
import {useSearchParams} from 'wouter';
import {SimpleSearchInput} from '@/component/Search/SimpleSearchInput';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {reactionApi} from '@/api/reaction/reaction.api';
import {UnitType} from '@package/contract/src/unit';
import {mapUnitListToReviewListResponse} from '@/api/meili/meili.api';

type Review = ReviewDTO;
export interface ReviewsPageProps {
  bookUnitId?: string;
}
export const ReviewsPage: React.FC<ReviewsPageProps> = ({bookUnitId}) => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();
  const targetUnitId = bookUnitId ?? '';

  const EXTERNAL_PAGE_SIZE = 50;
  const [startReview, setStartReview] = useState<number>(0);
  const [startRemark, setStartRemark] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tab, setTab] = useState<'review' | 'remark'>('review');
  const [keyword, setKeyword] = useState<string>('');
  const [searchParams, _setSearchParams] = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      if (tabParam === 'review' || tabParam === 'remark') {
        setTab(tabParam as 'review' | 'remark');
      }
    }
  }, [searchParams]);

  const reviewListQueryOpts = useQuery(
    buildMeiliUnitQuery(
      UnitType.REVIEW,
      startReview,
      targetUnitId,
      keyword,
      EXTERNAL_PAGE_SIZE,
      mapUnitListToReviewListResponse,
    ),
  );

  const remarkListQueryOpts = useQuery(
    buildMeiliUnitQuery(
      UnitType.REMARK,
      startRemark,
      targetUnitId,
      keyword,
      EXTERNAL_PAGE_SIZE,
      mapUnitListToReviewListResponse,
    ),
  );

  const {data: reviewData, isLoading: isLoadingReview} = reviewListQueryOpts;

  const {data: remarkData, isLoading: isLoadingRemark} = remarkListQueryOpts;

  function handleNeedMoreData(page: number) {
    if (tab === 'review') {
      setStartReview((page - 1) * EXTERNAL_PAGE_SIZE);
    } else {
      setStartRemark((page - 1) * EXTERNAL_PAGE_SIZE);
    }
  }

  async function handlePreRequestData(page: number) {
    const isReview = tab === 'review';
    const start = (page - 1) * EXTERNAL_PAGE_SIZE;
    const {queryKey, queryFn} = buildMeiliUnitQuery(
      isReview ? UnitType.REVIEW : UnitType.REMARK,
      start,
      targetUnitId,
      keyword,
      EXTERNAL_PAGE_SIZE,
      mapUnitListToReviewListResponse,
    );
    const nextData = await queryClient.fetchQuery({
      queryKey,
      queryFn,
    });
    return nextData?.reviews?.length ?? 0;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, [tab, keyword]);

  const activeData = tab === 'review' ? reviewData : remarkData;
  const isLoading = tab === 'review' ? isLoadingReview : isLoadingRemark;
  const baseReviews: Review[] = useMemo(
    () => activeData?.reviews ?? [],
    [activeData],
  );

  // Collect current visible review unitIds for reaction summary batch query
  const currentTargetIds = useMemo(
    () => baseReviews.map(r => r.unitId).filter(Boolean),
    [baseReviews],
  );

  const {data: reactionSummaryBatch} = useQuery({
    queryKey: ['reaction-summary-batch', tab, bookUnitId, currentTargetIds],
    queryFn: () => reactionApi.summaryBatch(currentTargetIds as string[]),
    enabled: currentTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const [reviews, setReviews] = useState<Review[]>([]);

  // Merge Meili review list data with accurate reaction summaries
  useEffect(() => {
    if (!baseReviews || baseReviews.length === 0) {
      setReviews([]);
      return;
    }

    if (!reactionSummaryBatch) {
      // Fallback: just use Meili data if batch summary not loaded yet
      setReviews(baseReviews);
      return;
    }

    const merged = baseReviews.map(review => {
      const summaryMap = reactionSummaryBatch.summaries[review.unitId];
      if (!summaryMap) return review;

      const reactionSummaries = Object.entries(summaryMap).map(
        ([reaction, count]) => ({
          reaction,
          count,
        }),
      );

      return {
        ...review,
        reactionSummaries,
      };
    });

    setReviews(merged);
  }, [baseReviews, reactionSummaryBatch]);

  const totalItems: number = activeData?.total ?? 10000;

  return (
    <div className="mx-auto max-w-7xl p-4 mt-4">
      <UniversalPaginator<Review>
        ref={ref}
        data={reviews}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && reviews.length === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        sortControl={
          <div>
            <SimpleSearchInput
              onSearch={info => {
                setKeyword(info ?? '');
                console.log('onSearch', info);
              }}
              defaultValue={{keyword: keyword ?? ''}}
              placeholder="Search readlists"
            />
            <Box sx={{borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2}}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                aria-label="review tabs"
              >
                <Tab label="REVIEW" value="review" />
                <Tab label="REMARK" value="remark" />
              </Tabs>
            </Box>
          </div>
        }
      >
        {(currentPageItems: Review[]) => (
          <ReviewListContainer reviews={currentPageItems} />
        )}
      </UniversalPaginator>
    </div>
  );
};

export default ReviewsPage;
