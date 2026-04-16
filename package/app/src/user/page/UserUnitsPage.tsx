import { Alert, Box, Tab, Tabs } from "@mui/material";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { meiliBookSearchQuery } from "@rezics/api/meili/meili.queries";
import { reactionApi } from "@rezics/api/reaction/reaction.api";
import type {
  BookDTO,
  PostDTO,
  ShelfDTO,
  UnitDTO,
} from "@rezics/contract";
import { UnitType } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { type FC, useCallback, useMemo, useRef, useState } from "react";
import { BookListView } from "@/book-library/component/BookList/BookListView";
import { QuoteExcerptListContainer } from "@/review/component/QuoteExcerptList.tsx";
import { ShelfCard } from "@/shelf/component/ShelfCard";
import { ReviewList } from "@/review/component/ReviewList.tsx";
import { TextSearchInputWithIcon } from "@/search/component/TextSearchInputWithIcon.tsx";

export interface UserUnitsPageProps {
  userId: string;
}

const ShelfListView: React.FC<{ shelves: ShelfDTO[] }> = ({ shelves }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {shelves.map((item) => (
        <ShelfCard key={item.unitId} shelf={item} />
      ))}
    </div>
  );
};

type TabKey = "shelf" | "review" | "remark" | "quote" | "book";

const EXTERNAL_PAGE_SIZE = 50;

function mergeReactionSummaries<T extends { id?: string; unitId?: string }>(
  items: T[],
  summaries: Record<string, Record<string, number>> | undefined,
  idField: "id" | "unitId",
): T[] {
  if (!summaries) return items;
  return items.map((item) => {
    const key = item[idField];
    if (!key) return item;
    const summaryMap = summaries[key];
    if (!summaryMap) return item;
    return {
      ...item,
      reactionSummaries: Object.entries(summaryMap).map(
        ([reaction, count]) => ({ reaction, count }),
      ),
    };
  });
}

export const UserUnitsPage: FC<UserUnitsPageProps> = ({ userId }) => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>("shelf");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [keyword, setKeyword] = useState<string>("");

  const [startShelf, setStartShelf] = useState<number>(0);
  const [startReview, setStartReview] = useState<number>(0);
  const [startBook, setStartBook] = useState<number>(0);
  const [startRemark, setStartRemark] = useState<number>(0);
  const [startQuote, setStartQuote] = useState<number>(0);

  // ======= Shelves =======

  const {
    data: shelfDataRaw,
    isLoading: isLoadingShelf,
    error: errorShelf,
  } = useQuery(
    contentSearchQueryOptions({
      type: "SHELF",
      keyword: keyword || undefined,
      offset: startShelf,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  const shelfTargetIds = useMemo(
    () =>
      (shelfDataRaw?.items ?? [])
        .map((r) => r.id)
        .filter(Boolean) as string[],
    [shelfDataRaw],
  );

  const { data: shelfReactionBatch } = useQuery({
    queryKey: ["reaction-summary-batch", "user", userId, "shelves", shelfTargetIds],
    queryFn: () => reactionApi.summary(shelfTargetIds),
    enabled: shelfTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const shelves = useMemo(
    () =>
      mergeReactionSummaries(
        (shelfDataRaw?.items ?? []) as unknown as ShelfDTO[],
        shelfReactionBatch?.summaries,
        "id",
      ),
    [shelfDataRaw, shelfReactionBatch],
  );

  const totalShelves: number = shelfDataRaw?.total ?? 0;

  // ======= Books =======

  const {
    data: bookData,
    isLoading: isLoadingBook,
    error: errorBook,
  } = useQuery(
    meiliBookSearchQuery({
      authorIds: [userId],
      start: startBook,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  // ======= Reviews / Remarks =======

  const {
    data: reviewData,
    isLoading: isLoadingReview,
    error: errorReview,
  } = useQuery(
    contentSearchQueryOptions({
      type: UnitType.POST,
      keyword: keyword || undefined,
      offset: startReview,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  const {
    data: remarkData,
    isLoading: isLoadingRemark,
    error: errorRemark,
  } = useQuery(
    contentSearchQueryOptions({
      type: UnitType.POST,
      keyword: keyword || undefined,
      offset: startRemark,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  const activeReviewLikeData = tab === "review" ? reviewData : remarkData;
  const isLoadingReviewLike =
    tab === "review" ? isLoadingReview : isLoadingRemark;

  const reviewTargetIds = useMemo(
    () =>
      ((activeReviewLikeData?.items ?? []) as unknown as PostDTO[])
        .map((r) => r.unitId)
        .filter(Boolean) as string[],
    [activeReviewLikeData],
  );

  const { data: reviewReactionBatch } = useQuery({
    queryKey: ["reaction-summary-batch", "user", userId, tab, reviewTargetIds],
    queryFn: () => reactionApi.summary(reviewTargetIds),
    enabled: reviewTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const reviews = useMemo(
    () =>
      mergeReactionSummaries(
        (activeReviewLikeData?.items ?? []) as unknown as PostDTO[],
        reviewReactionBatch?.summaries,
        "unitId",
      ),
    [activeReviewLikeData, reviewReactionBatch],
  );

  const totalReviews: number =
    (tab === "review" ? reviewData?.total : remarkData?.total) ?? 0;

  // ======= Quotes =======

  const {
    data: quoteData,
    isLoading: isLoadingQuote,
    error: errorQuote,
  } = useQuery(
    contentSearchQueryOptions({
      type: UnitType.QUOTE,
      keyword: keyword || undefined,
      offset: startQuote,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  const quoteUnits: UnitDTO[] = useMemo(
    () => (quoteData?.items ?? []) as unknown as UnitDTO[],
    [quoteData],
  );

  // ======= Pagination control =======

  const handleNeedMoreData = useCallback(
    (page: number) => {
      const start = (page - 1) * EXTERNAL_PAGE_SIZE;
      if (tab === "shelf") {
        setStartShelf(start);
      } else if (tab === "review") {
        setStartReview(start);
      } else if (tab === "remark") {
        setStartRemark(start);
      } else if (tab === "book") {
        setStartBook(start);
      } else if (tab === "quote") {
        setStartQuote(start);
      }
    },
    [tab],
  );

  const handlePreRequestData = useCallback(
    async (page: number) => {
      const start = (page - 1) * EXTERNAL_PAGE_SIZE;

      if (tab === "shelf") {
        const result = await queryClient.fetchQuery(
          contentSearchQueryOptions({
            type: "SHELF",
            keyword: keyword || undefined,
            offset: start,
            limit: EXTERNAL_PAGE_SIZE,
          }),
        );
        return result?.items?.length ?? 0;
      }

      if (tab === "review" || tab === "remark") {
        const result = await queryClient.fetchQuery(
          contentSearchQueryOptions({
            type: UnitType.POST,
            keyword: keyword || undefined,
            offset: start,
            limit: EXTERNAL_PAGE_SIZE,
          }),
        );
        return result?.items?.length ?? 0;
      }

      if (tab === "book") {
        const result = await queryClient.fetchQuery(
          meiliBookSearchQuery({
            authorIds: [userId],
            start,
            limit: EXTERNAL_PAGE_SIZE,
          }),
        );
        return (result as any)?.books?.length ?? 0;
      }

      const result = await queryClient.fetchQuery(
        contentSearchQueryOptions({
          type: UnitType.QUOTE,
          keyword: keyword || undefined,
          offset: start,
          limit: EXTERNAL_PAGE_SIZE,
        }),
      );
      return result?.items?.length ?? 0;
    },
    [tab, keyword, userId, queryClient],
  );

  // Select data source by current tab
  let isLoading: boolean;
  let items: (ShelfDTO | PostDTO | UnitDTO | BookDTO)[];
  let totalItems: number;
  let activeError: Error | null = null;

  if (tab === "shelf") {
    isLoading = isLoadingShelf;
    items = shelves;
    totalItems = totalShelves;
    activeError = errorShelf as Error | null;
  } else if (tab === "review" || tab === "remark") {
    isLoading = isLoadingReviewLike;
    items = reviews;
    totalItems = totalReviews;
    activeError = (errorReview ?? errorRemark) as Error | null;
  } else if (tab === "book") {
    isLoading = isLoadingBook;
    items = bookData?.books ?? [];
    totalItems = bookData?.total ?? 0;
    activeError = errorBook as Error | null;
  } else {
    isLoading = isLoadingQuote;
    items = quoteUnits;
    totalItems = quoteData?.total ?? 0;
    activeError = errorQuote as Error | null;
  }

  return (
    <div className="mx-auto p-2 mt-4">
      <div className="mb-4">
        <TextSearchInputWithIcon
          onSearch={(info) => {
            setKeyword(info ?? "");
          }}
          defaultValue={{ keyword: keyword ?? "" }}
          placeholder="Search user's content"
        />
        <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 2, mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            aria-label="user unit tabs"
          >
            <Tab label="SHELF" value="shelf" />
            <Tab label="REVIEW" value="review" />
            <Tab label="BOOK" value="book" />
            <Tab label="REMARK" value="remark" />
            <Tab label="QUOTE" value="quote" />
          </Tabs>
        </Box>
      </div>

      {activeError && (
        <Alert severity="error" className="mb-4">
          {String(activeError)}
        </Alert>
      )}

      <UniversalPaginator<ShelfDTO | PostDTO | UnitDTO | BookDTO>
        ref={ref}
        data={items}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && items.length === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        disableSortControl={true}
      >
        {(currentPageItems: (ShelfDTO | PostDTO | UnitDTO | BookDTO)[]) => {
          if (tab === "shelf") {
            return (
              <ShelfListView shelves={currentPageItems as ShelfDTO[]} />
            );
          }
          if (tab === "review" || tab === "remark") {
            return <ReviewList reviews={currentPageItems as PostDTO[]} />;
          }
          if (tab === "book") {
            return <BookListView books={currentPageItems as BookDTO[]} />;
          }
          if (tab === "quote") {
            return (
              <QuoteExcerptListContainer
                data={{
                  units: currentPageItems as UnitDTO[],
                  total: totalItems,
                }}
              />
            );
          }
          return null;
        }}
      </UniversalPaginator>
    </div>
  );
};
