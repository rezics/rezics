import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Tabs, Tab, Box} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Pagination.tsx';
import {ReviewListContainer} from '@/component/Review/ReviewList';
import type {ReviewDTO} from '@package/contract';
import {useSearchParams} from 'wouter';
import {SimpleSearchInput} from '@/component/Search/SimpleSearchInput';
import {
  meiliUnitApi,
  mapUnitListToReviewListResponse,
} from '@/api/meili/meili.api';

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
  const buildMeiliUnitQuery = (kind: 'review' | 'remark', start: number) => {
    const type = kind === 'review' ? 'REVIEW' : 'REMARK';
    const filters = {
      type,
      targetUnitId: bookUnitId,
      start,
      limit: EXTERNAL_PAGE_SIZE,
      q: keyword || undefined,
    };

    return {
      queryKey: ['meili-units', kind, bookUnitId, start, keyword],
      queryFn: async () => {
        const unitResp = await meiliUnitApi.unitSearch(filters);
        return mapUnitListToReviewListResponse(unitResp);
      },
      enabled: !!bookUnitId,
      staleTime: 1000 * 60 * 5,
    } as const;
  };

  const reviewListQueryOpts = useQuery(
    buildMeiliUnitQuery('review', startReview),
  );

  const remarkListQueryOpts = useQuery(
    buildMeiliUnitQuery('remark', startRemark),
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
      isReview ? 'review' : 'remark',
      start,
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
