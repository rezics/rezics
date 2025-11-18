import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Tabs, Tab, Box} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Pagination.tsx';
import {ReviewListContainer} from '@/component/Review/ReviewList';
import {reviewQueries, remarkQueries} from '@/api/review/review.queries';
import type {ReviewDTO} from '@package/contract';
import {Search} from '@/component/Search';
import {useSearchParams} from 'wouter';

type Review = ReviewDTO;
interface ReviewsPageProps {
  bookUnitId?: string;
}
export const ReviewsPage: React.FC<ReviewsPageProps> = ({bookUnitId}) => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

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
    reviewQueries.list({
      bookId: bookUnitId,
      start: startReview,
      limit: EXTERNAL_PAGE_SIZE,
      q: keyword || undefined,
    }),
  );

  const remarkListQueryOpts = useQuery(
    remarkQueries.list({
      bookId: bookUnitId,
      start: startRemark,
      limit: EXTERNAL_PAGE_SIZE,
      q: keyword || undefined,
    }),
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
    const common = {
      limit: EXTERNAL_PAGE_SIZE,
      q: keyword || undefined,
      bookId: bookUnitId,
    };

    const query =
      tab === 'review'
        ? reviewQueries.list({
            ...common,
            start: (page - 1) * EXTERNAL_PAGE_SIZE,
          })
        : remarkQueries.list({
            ...common,
            start: (page - 1) * EXTERNAL_PAGE_SIZE,
          });

    const nextData = await queryClient.fetchQuery(query);
    return nextData?.reviews?.length ?? 0;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, [tab, keyword]);

  const activeData = tab === 'review' ? reviewData : remarkData;
  const isLoading = tab === 'review' ? isLoadingReview : isLoadingRemark;
  const reviews: Review[] = useMemo(
    () => activeData?.reviews ?? [],
    [activeData],
  );
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
            <Search.Container
              onSearch={info => {
                setKeyword(info.keyword ?? '');
              }}
              defaultValue={{keyword, tags: []}}
              placeholder="Search reviews"
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
