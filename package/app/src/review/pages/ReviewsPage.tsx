import { usePostSearchQuery } from "@rezics/api/meili/meili.queries";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import {
  book_remark,
  review_search_placeholder,
  review_short_review,
  review_tabs_label,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { UniversalPaginator, type UniversalPaginatorHandle } from "@rezics/ui";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { ReviewList } from "@/review/components/list/ReviewList";
import { mapPostSearchDocToPostDTO } from "@/review/models/postSearchDocToPostDTO";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";

const i18nMessages = {
  book_remark,
  review_search_placeholder,
  review_short_review,
  review_tabs_label,
};

type Review = PostDTO;

export interface ReviewsPageProps {
  bookUnitId?: string;
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({ bookUnitId }) => {
  const m = useMessage(i18nMessages);
  const ref = useRef<UniversalPaginatorHandle>(null);
  const targetUnitId = bookUnitId ?? "";
  const EXTERNAL_PAGE_SIZE = 50;
  const [start, setStart] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tab, setTab] = useState<"review" | "remark">("review");
  const search = useSearchQuery({});
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const kind = tab === "review" ? "REVIEW" : "REMARK";

  const { data, isLoading } = usePostSearchQuery({
    kind,
    targetUnitId: targetUnitId || undefined,
    keyword: keyword || undefined,
    offset: start,
    limit: EXTERNAL_PAGE_SIZE,
  });

  const baseReviews: Review[] = useMemo(
    () => data?.items?.map(mapPostSearchDocToPostDTO) ?? [],
    [data],
  );

  const currentTargetIds = useMemo(
    () => baseReviews.map((r) => r.unitId).filter(Boolean),
    [baseReviews],
  );

  useReactionHydration(currentTargetIds);

  const totalItems: number = data?.total ?? 0;

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  function resetPagination() {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl p-4 mt-4">
      <UniversalPaginator<Review>
        ref={ref}
        data={baseReviews}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        isLoading={isLoading && baseReviews.length === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        sortControl={
          <div>
            <KeywordInput
              value={keywordBind.value ?? ""}
              onChange={(v) => {
                keywordBind.onChange(v);
                resetPagination();
              }}
              onSubmit={() => setStart(0)}
              placeholder={m.review_search_placeholder()}
            />
            <div className="mb-4 mt-4 border-b border-border-whisper">
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  setTab(v as typeof tab);
                  resetPagination();
                  setStart(0);
                }}
                aria-label={m.review_tabs_label()}
              >
                <TabsList>
                  <TabsTrigger value="review">
                    {m.review_short_review()}
                  </TabsTrigger>
                  <TabsTrigger value="remark">{m.book_remark()}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        }
      >
        {(currentPageItems: Review[]) => (
          <ReviewList reviews={currentPageItems} showTargetWork={!bookUnitId} />
        )}
      </UniversalPaginator>
    </div>
  );
};

export default ReviewsPage;
