import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { UniversalPaginator, type UniversalPaginatorHandle } from "@rezics/ui";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { ReviewList } from "@/review/components/list/ReviewList";
import { mapPostSearchDocToPostDTO } from "@/review/models/postSearchDocToPostDTO";
import { KeywordInput, useSearchQuery } from "@/search";
import { useLocalizedPostSearch } from "@/shared/hooks/useLocalizedMeiliSearch";

type Review = PostDTO;

export interface ReviewsPageProps {
  bookUnitId?: string;
  variantUnitId?: string;
}

/**
 * 评论列表页面 - 使用分页、搜索、标签标签过滤显示评论和备注
 *
 * 布局结构：
 * - 移动端 (<640px)：全宽 max-w-7xl，p-4 边距，mt-4（顶部间距）
 * - 平板 (640-1023px)：mx-auto 中心，max-w-7xl，p-4，mt-4
 * - 桌面 (1024-1535px)：mx-auto 中心，max-w-7xl，p-4，mt-4
 * - 超宽 (>=1536px)：mx-auto 中心，max-w-7xl，p-4，mt-4
 *
 * ASCII 布局示意:
 *
 * All Viewports (max-w-7xl, centered, p-4, mt-4)
 * +----------+
 * |SEARCH    |
 * +----------+
 * +----------+
 * |TAB|REMARK|
 * +----------+
 * +----------+
 * |REVIEW    |
 * |LIST      |
 * |[10 items]|
 * +----------+
 * +__PAGIN___+
 */
export const ReviewsPage: React.FC<ReviewsPageProps> = ({
  bookUnitId,
  variantUnitId,
}) => {
  const { t } = useTranslation(["book", "community"]);
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

  const { data, isLoading, isError, error } = useLocalizedPostSearch({
    kind,
    targetUnitId: targetUnitId || undefined,
    variantUnitId,
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

  if (isError) {
    return (
      <div className="w-full mx-auto max-w-7xl p-4 mt-4">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto max-w-7xl p-4 mt-4">
      <UniversalPaginator<Review>
        ref={ref}
        data={baseReviews}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
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
              placeholder={t("community:review_search_placeholder")}
            />
            <div className="mb-4 mt-4 border-b border-border-whisper">
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  setTab(v as typeof tab);
                  resetPagination();
                  setStart(0);
                }}
                aria-label={t("community:review_tabs_label")}
              >
                <TabsList>
                  <TabsTrigger value="review">
                    {t("community:review_short_review")}
                  </TabsTrigger>
                  <TabsTrigger value="remark">{t("book:remark")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        }
      >
        {(currentPageItems: Review[]) => (
          <ReviewList reviews={currentPageItems} />
        )}
      </UniversalPaginator>
    </div>
  );
};
