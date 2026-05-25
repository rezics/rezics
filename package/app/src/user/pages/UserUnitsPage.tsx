import { bookQueries } from "@rezics/api/book/book";
import {
  contentSearchQueryOptions,
  postSearchQueryOptions,
} from "@rezics/api/meili/meili.queries";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { BookDTO, PostDTO, ShelfDTO, UnitDTO } from "@rezics/contract";
import { PostKind, UnitType } from "@rezics/contract";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import {
  Alert,
  AlertDescription,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { type FC, useCallback, useMemo, useRef, useState } from "react";
import { BookListView } from "@/book-library/components/BookList/BookListView";
import { ExcerptList } from "@/excerpt";
import { ReviewList } from "@/review/components/list/ReviewList";
import { mapPostSearchDocToPostDTO } from "@/review/models/postSearchDocToPostDTO";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { ShelfCard } from "@/shelf/components/ShelfCard";
import { useMessage } from "@rezics/i18n/react";
import {
  profile_search_content_placeholder,
  profile_unit_tabs_label,
  search_category_books,
  search_category_excerpts,
  search_category_remarks,
  search_category_reviews,
  search_category_shelves,
} from "@rezics/i18n/messages";
const i18nMessages = {
  profile_search_content_placeholder,
  profile_unit_tabs_label,
  search_category_books,
  search_category_excerpts,
  search_category_remarks,
  search_category_reviews,
  search_category_shelves,
};

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

type TabKey = "shelf" | "review" | "remark" | "excerpt" | "book";

const EXTERNAL_PAGE_SIZE = 50;

export const UserUnitsPage: FC<UserUnitsPageProps> = ({ userId }) => {
  const m = useMessage(i18nMessages);
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>("shelf");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const search = useSearchQuery({});
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const [startShelf, setStartShelf] = useState<number>(0);
  const [startReview, setStartReview] = useState<number>(0);
  const [startBook, setStartBook] = useState<number>(0);
  const [startRemark, setStartRemark] = useState<number>(0);
  const [startExcerpt, setStartExcerpt] = useState<number>(0);

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
      (shelfDataRaw?.items ?? []).map((r) => r.id).filter(Boolean) as string[],
    [shelfDataRaw],
  );

  useReactionHydration(shelfTargetIds);

  const shelves = useMemo(
    () => (shelfDataRaw?.items ?? []) as unknown as ShelfDTO[],
    [shelfDataRaw],
  );

  const totalShelves: number = shelfDataRaw?.total ?? 0;

  // ======= Books =======

  const {
    data: bookData,
    isLoading: isLoadingBook,
    error: errorBook,
  } = useQuery(
    bookQueries.byUser(userId, {
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
    postSearchQueryOptions({
      kind: PostKind.REVIEW,
      authorUserId: userId,
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
    postSearchQueryOptions({
      kind: PostKind.REMARK,
      authorUserId: userId,
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
      (activeReviewLikeData?.items?.map(mapPostSearchDocToPostDTO) ?? [])
        .map((r) => r.unitId)
        .filter(Boolean) as string[],
    [activeReviewLikeData],
  );

  useReactionHydration(reviewTargetIds);

  const reviews = useMemo(
    () => activeReviewLikeData?.items?.map(mapPostSearchDocToPostDTO) ?? [],
    [activeReviewLikeData],
  );

  const totalReviews: number =
    (tab === "review" ? reviewData?.total : remarkData?.total) ?? 0;

  // ======= Excerpts =======

  const {
    data: excerptData,
    isLoading: isLoadingExcerpt,
    error: errorExcerpt,
  } = useQuery(
    contentSearchQueryOptions({
      type: UnitType.QUOTE,
      keyword: keyword || undefined,
      offset: startExcerpt,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  const excerptUnits: UnitDTO[] = useMemo(
    () => (excerptData?.items ?? []) as unknown as UnitDTO[],
    [excerptData],
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
      } else if (tab === "excerpt") {
        setStartExcerpt(start);
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
          postSearchQueryOptions({
            kind: tab === "review" ? PostKind.REVIEW : PostKind.REMARK,
            authorUserId: userId,
            keyword: keyword || undefined,
            offset: start,
            limit: EXTERNAL_PAGE_SIZE,
          }),
        );
        return result?.items?.length ?? 0;
      }

      if (tab === "book") {
        const result = await queryClient.fetchQuery(
          bookQueries.byUser(userId, {
            start,
            limit: EXTERNAL_PAGE_SIZE,
          }),
        );
        return result?.books?.length ?? 0;
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
    isLoading = isLoadingExcerpt;
    items = excerptUnits;
    totalItems = excerptData?.total ?? 0;
    activeError = errorExcerpt as Error | null;
  }

  return (
    <div className="mx-auto p-2 mt-4">
      <div className="mb-4">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          placeholder={m.profile_search_content_placeholder()}
        />
        <div className="border-b border-border-whisper mt-4 mb-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabKey)}
            aria-label={m.profile_unit_tabs_label()}
          >
            <TabsList>
              <TabsTrigger value="shelf">
                {m.search_category_shelves()}
              </TabsTrigger>
              <TabsTrigger value="review">
                {m.search_category_reviews()}
              </TabsTrigger>
              <TabsTrigger value="book">
                {m.search_category_books()}
              </TabsTrigger>
              <TabsTrigger value="remark">
                {m.search_category_remarks()}
              </TabsTrigger>
              <TabsTrigger value="excerpt">
                {m.search_category_excerpts()}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {activeError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{String(activeError)}</AlertDescription>
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
            return <ShelfListView shelves={currentPageItems as ShelfDTO[]} />;
          }
          if (tab === "review" || tab === "remark") {
            return <ReviewList reviews={currentPageItems as PostDTO[]} />;
          }
          if (tab === "book") {
            return <BookListView books={currentPageItems as BookDTO[]} />;
          }
          if (tab === "excerpt") {
            return <ExcerptList units={currentPageItems as UnitDTO[]} />;
          }
          return null;
        }}
      </UniversalPaginator>
    </div>
  );
};
