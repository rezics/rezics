import { Alert, Box, Tab, Tabs } from "@mui/material";
import { mapUnitListToReviewListResponse } from "@rezics/api/meili/meili.api";
import {
  buildMeiliReadlistQuery,
  buildMeiliUnitQuery,
  meiliBookSearchQuery,
} from "@rezics/api/meili/meili.queries";
import { reactionApi } from "@rezics/api/reaction/reaction.api";
import type {
  BookDTO,
  ReadlistDTO,
  ReviewDTO,
  UnitDTO,
} from "@rezics/contract";
import { UnitType } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { type FC, useEffect, useMemo, useRef, useState } from "react";
import { BookListView } from "@/book-library/component/BookList/BookListView";
import { SingleReadlist } from "@/readlist/component/SingleReadlist.tsx";
import { QuoteExcerptListContainer } from "@/review/component/QuoteExcerptList.tsx";
import { ReviewList } from "@/review/component/ReviewList.tsx";
import { TextSearchInputWithIcon } from "@/search/component/TextSearchInputWithIcon.tsx";

type Readlist = ReadlistDTO;
type Review = ReviewDTO;
type UnitItem = UnitDTO;

export interface UserUnitsPageProps {
  userId: string;
}

// Readlist 列表视图（复用 ReadListsPage 的写法）
const ReadlistListView: React.FC<{ readlists: Readlist[] }> = ({
  readlists,
}) => {
  return (
    <div>
      {readlists.map((item) => (
        <div key={item.id}>
          <SingleReadlist
            data={item}
            // 用户内容页主要是浏览，不在这里处理交互
            handleBookListClick={() => {}}
            handleLike={() => {}}
          />
        </div>
      ))}
    </div>
  );
};

// COMMENT / NOTE 的简单通用列表视图
const UnitSimpleListView: React.FC<{ units: UnitItem[] }> = ({ units }) => {
  // TODO 需要为评论做单独的适配，传入targetUnitId
  return (
    <div className="space-y-3">
      {units.map((unit) => (
        <div
          key={unit.id}
          className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
        >
          <div className="text-xs text-gray-500 mb-1">
            {unit.type || "UNIT"}
          </div>
          <div className="font-semibold truncate mb-1">
            {unit.title || "(未命名内容)"}
          </div>
          {unit.content && (
            <div className="text-sm text-gray-700 line-clamp-3 dark:text-gray-300 whitespace-pre-wrap">
              {unit.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

type TabKey =
  | "readlist"
  | "review"
  | "remark"
  | "comment"
  | "note"
  | "quote"
  | "book";

/**
 * UserUnitsPage
 *
 * 按 Tab 展示某个用户的：
 * - READLIST：基于 /meili/readlists/search（buildMeiliReadlistQuery）
 * - REVIEW / REMARK：基于 /meili/units/search（buildMeiliUnitQuery + UnitType）
 *
 * 并使用专门的组件渲染：
 * - READLIST：SingleReadlist
 * - REVIEW / REMARK：ReviewListContainer
 */
export const UserUnitsPage: FC<UserUnitsPageProps> = ({ userId }) => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const EXTERNAL_PAGE_SIZE = 50;

  const [tab, setTab] = useState<TabKey>("readlist");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [keyword, setKeyword] = useState<string>("");

  const [startReadlist, setStartReadlist] = useState<number>(0);
  const [startReview, setStartReview] = useState<number>(0);
  const [startBook, setStartBook] = useState<number>(0);
  const [startRemark, setStartRemark] = useState<number>(0);
  const [startComment, setStartComment] = useState<number>(0);
  const [startNote, setStartNote] = useState<number>(0);
  const [startQuote, setStartQuote] = useState<number>(0);

  // ======= Readlists (Meili readlists index with userId filter) =======
  const {
    data: readlistDataRaw,
    isLoading: isLoadingReadlist,
    error: errorReadlist,
  } = useQuery(
    buildMeiliReadlistQuery(startReadlist, EXTERNAL_PAGE_SIZE, keyword, [], {
      userId,
    }),
  );

  const baseReadlists: Readlist[] = useMemo(
    () => readlistDataRaw?.readlists ?? [],
    [readlistDataRaw],
  );

  const currentReadlistTargetIds = useMemo(
    () => baseReadlists.map((r) => r.id).filter(Boolean),
    [baseReadlists],
  );

  const { data: readlistReactionSummaryBatch } = useQuery({
    queryKey: [
      "reaction-summary-batch",
      "user",
      userId,
      "readlists",
      currentReadlistTargetIds,
    ],
    queryFn: () =>
      reactionApi.summaryBatch(currentReadlistTargetIds as string[]),
    enabled: currentReadlistTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const [readlists, setReadlists] = useState<Readlist[]>([]);

  useEffect(() => {
    if (!baseReadlists || baseReadlists.length === 0) {
      setReadlists([]);
      return;
    }

    if (!readlistReactionSummaryBatch) {
      setReadlists(baseReadlists);
      return;
    }

    const merged = baseReadlists.map((item) => {
      const summaryMap = readlistReactionSummaryBatch.summaries[item.id];
      if (!summaryMap) return item;

      const reactionSummaries = Object.entries(summaryMap).map(
        ([reaction, count]) => ({
          reaction,
          count,
        }),
      );

      return {
        ...item,
        reactionSummaries,
      };
    });

    setReadlists(merged);
  }, [baseReadlists, readlistReactionSummaryBatch]);

  const totalReadlists: number = readlistDataRaw?.total ?? 0;

  // ======= Books (Meili books index with userId filter) =======
  const bookListQueryOpts = useQuery(
    meiliBookSearchQuery({
      authorIds: [userId],
      start: startBook,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  const {
    data: bookData,
    isLoading: isLoadingBook,
    error: errorBook,
  } = bookListQueryOpts;

  // ======= Reviews / Remarks (Meili units index with userId filter) =======

  const reviewListQueryOpts = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.REVIEW,
      start: startReview,
      targetUnitId: undefined,
      keyword: keyword,
      limit: EXTERNAL_PAGE_SIZE,
      mapFn: mapUnitListToReviewListResponse,
      options: { userId },
    }),
  );

  const remarkListQueryOpts = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.REMARK,
      start: startRemark,
      targetUnitId: undefined,
      keyword: keyword,
      limit: EXTERNAL_PAGE_SIZE,
      mapFn: mapUnitListToReviewListResponse,
      options: { userId },
    }),
  );

  const {
    data: reviewData,
    isLoading: isLoadingReview,
    error: errorReview,
  } = reviewListQueryOpts;

  const {
    data: remarkData,
    isLoading: isLoadingRemark,
    error: errorRemark,
  } = remarkListQueryOpts;

  const activeReviewLikeData = tab === "review" ? reviewData : remarkData;
  const isLoadingReviewLike =
    tab === "review" ? isLoadingReview : isLoadingRemark;

  const baseReviews: Review[] = useMemo(
    () => activeReviewLikeData?.reviews ?? [],
    [activeReviewLikeData],
  );

  const currentReviewTargetIds = useMemo(
    () => baseReviews.map((r) => r.unitId).filter(Boolean),
    [baseReviews],
  );

  const { data: reviewReactionSummaryBatch } = useQuery({
    queryKey: [
      "reaction-summary-batch",
      "user",
      userId,
      tab,
      currentReviewTargetIds,
    ],
    queryFn: () => reactionApi.summaryBatch(currentReviewTargetIds as string[]),
    enabled: currentReviewTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!baseReviews || baseReviews.length === 0) {
      setReviews([]);
      return;
    }

    if (!reviewReactionSummaryBatch) {
      setReviews(baseReviews);
      return;
    }

    const merged = baseReviews.map((review) => {
      const summaryMap = reviewReactionSummaryBatch.summaries[review.unitId];
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
  }, [baseReviews, reviewReactionSummaryBatch]);

  const totalReviews: number =
    (tab === "review" ? reviewData?.total : remarkData?.total) ?? 0;

  // ======= COMMENT / NOTE / QUOTE（同一 Meili units 查询，不同 type）=======

  const {
    data: commentData,
    isLoading: isLoadingComment,
    error: errorComment,
  } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.COMMENT,
      start: startComment,
      targetUnitId: undefined,
      keyword: keyword,
      limit: EXTERNAL_PAGE_SIZE,
      mapFn: (unitResp) => unitResp,
      options: { userId },
    }),
  );

  const {
    data: noteData,
    isLoading: isLoadingNote,
    error: errorNote,
  } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.NOTE,
      start: startNote,
      targetUnitId: undefined,
      keyword: keyword,
      limit: EXTERNAL_PAGE_SIZE,
      mapFn: (unitResp) => unitResp,
      options: { userId },
    }),
  );

  const {
    data: quoteData,
    isLoading: isLoadingQuote,
    error: errorQuote,
  } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.QUOTE,
      start: startQuote,
      targetUnitId: undefined,
      keyword: keyword,
      limit: EXTERNAL_PAGE_SIZE,
      mapFn: (unitResp) => unitResp,
      options: { userId },
    }),
  );

  const commentUnits: UnitItem[] = useMemo(
    () => (commentData?.units ?? []) as UnitItem[],
    [commentData],
  );
  const noteUnits: UnitItem[] = useMemo(
    () => (noteData?.units ?? []) as UnitItem[],
    [noteData],
  );
  const quoteUnits: UnitItem[] = useMemo(
    () => (quoteData?.units ?? []) as UnitItem[],
    [quoteData],
  );

  // ======= 通用分页控制 =======

  function handleNeedMoreData(page: number) {
    const start = (page - 1) * EXTERNAL_PAGE_SIZE;
    if (tab === "readlist") {
      setStartReadlist(start);
    } else if (tab === "review") {
      setStartReview(start);
    } else if (tab === "remark") {
      setStartRemark(start);
    } else if (tab === "book") {
      setStartBook(start);
    } else if (tab === "comment") {
      setStartComment(start);
    } else if (tab === "note") {
      setStartNote(start);
    } else if (tab === "quote") {
      setStartQuote(start);
    }
  }

  async function handlePreRequestData(page: number) {
    const start = (page - 1) * EXTERNAL_PAGE_SIZE;

    if (tab === "readlist") {
      const { queryKey, queryFn } = buildMeiliReadlistQuery(
        start,
        EXTERNAL_PAGE_SIZE,
        keyword,
        [],
        { userId },
      );
      const nextData = await queryClient.fetchQuery({ queryKey, queryFn });
      return nextData?.readlists?.length ?? 0;
    }

    // 其他 Tab 共用 Meili units 查询，只是 type / mapFn 不同
    if (tab === "review" || tab === "remark") {
      const isReview = tab === "review";
      const { queryKey, queryFn } = buildMeiliUnitQuery({
        kind: isReview ? UnitType.REVIEW : UnitType.REMARK,
        start: start,
        targetUnitId: undefined,
        keyword: keyword,
        limit: EXTERNAL_PAGE_SIZE,
        mapFn: mapUnitListToReviewListResponse,
        options: { userId },
      });
      const nextReviewData = await queryClient.fetchQuery({
        queryKey,
        queryFn,
      });
      return nextReviewData?.reviews?.length ?? 0;
    }

    const unitType =
      tab === "comment"
        ? UnitType.COMMENT
        : tab === "note"
          ? UnitType.NOTE
          : UnitType.QUOTE;

    const { queryKey, queryFn } = buildMeiliUnitQuery({
      kind: unitType,
      start: start,
      targetUnitId: undefined,
      keyword: keyword,
      limit: EXTERNAL_PAGE_SIZE,
      mapFn: (unitResp) => unitResp,
      options: { userId },
    });
    const nextUnitData = await queryClient.fetchQuery({
      queryKey,
      queryFn,
    });
    return nextUnitData?.units?.length ?? 0;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, []);

  // 根据当前 Tab 选择数据源
  let isLoading: boolean;
  let items: (Readlist | Review | UnitItem | BookDTO)[];
  let totalItems: number;
  let activeError: Error | null = null;

  if (tab === "readlist") {
    isLoading = isLoadingReadlist;
    items = readlists ?? [];
    totalItems = totalReadlists;
    activeError = errorReadlist as Error | null;
  } else if (tab === "review" || tab === "remark") {
    isLoading = isLoadingReviewLike;
    items = reviews ?? [];
    totalItems = totalReviews;
    activeError = (errorReview ?? errorRemark) as Error | null;
  } else if (tab === "book") {
    isLoading = isLoadingBook;
    items = bookData?.books ?? [];
    totalItems = bookData?.total ?? 0;
    activeError = errorBook as Error | null;
  } else if (tab === "comment") {
    isLoading = isLoadingComment;
    items = commentUnits ?? [];
    totalItems = commentData?.total ?? 0;
    activeError = errorComment as Error | null;
  } else if (tab === "note") {
    isLoading = isLoadingNote;
    items = noteUnits ?? [];
    totalItems = noteData?.total ?? 0;
    activeError = errorNote as Error | null;
  } else {
    // quote
    isLoading = isLoadingQuote;
    items = quoteUnits ?? [];
    totalItems = quoteData?.total ?? 0;
    activeError = errorQuote as Error | null;
  }

  return (
    <div className="mx-auto p-2 mt-4">
      {/* 顶部搜索 + Tab */}
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
            <Tab label="READLIST" value="readlist" />
            <Tab label="REVIEW" value="review" />
            <Tab label="BOOK" value="book" />
            <Tab label="REMARK" value="remark" />
            <Tab label="COMMENT" value="comment" />
            <Tab label="QUOTE" value="quote" />
            {/* <Tab label="NOTE" value="note" /> */}
          </Tabs>
        </Box>
      </div>

      {activeError && (
        <Alert severity="error" className="mb-4">
          {String(activeError)}
        </Alert>
      )}

      <UniversalPaginator<Readlist | Review | UnitItem | BookDTO>
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
        {(currentPageItems: (Readlist | Review | UnitItem | BookDTO)[]) => {
          if (tab === "readlist") {
            return (
              <ReadlistListView readlists={currentPageItems as Readlist[]} />
            );
          }
          if (tab === "review" || tab === "remark") {
            return <ReviewList reviews={currentPageItems as Review[]} />;
          }
          if (tab === "book") {
            return <BookListView books={currentPageItems as BookDTO[]} />;
          }
          if (tab === "quote") {
            return (
              <QuoteExcerptListContainer
                data={{
                  units: currentPageItems as UnitItem[],
                  total: totalItems,
                }}
              />
            );
          }
          // COMMENT / NOTE
          return <UnitSimpleListView units={currentPageItems as UnitItem[]} />;
        }}
      </UniversalPaginator>
    </div>
  );
};
