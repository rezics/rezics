import { Box, Tab, Tabs } from "@mui/material";
import { usePostSearchQuery } from "@rezics/api/meili/meili.queries";
import { reactionApi } from "@rezics/api/reaction/reaction.api";
import type { PostDTO, PostSearchDocument } from "@rezics/contract";
import { UniversalPaginator, type UniversalPaginatorHandle } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReviewList } from "@/review/components/ReviewList.tsx";
import { TextSearchInput } from "@/search/components/TextSearchInput";

function mapPostSearchDocToPostDTO(doc: PostSearchDocument): PostDTO {
  return {
    unitId: doc.id,
    authorUserId: doc.authorUserId,
    author: {
      unitId: doc.authorUserId,
      name: doc.authorName ?? "",
      slug: doc.authorSlug ?? undefined,
      avatar: doc.authorAvatar ?? undefined,
    },
    targetUnitId: doc.targetUnitId,
    realmUnitId: doc.realmUnitId,
    body: doc.body,
    rootPostUnitId: doc.rootPostUnitId,
    parentPostUnitId: doc.parentPostUnitId,
    kind: doc.kind as any,
    depth: doc.depth,
    sortPath: doc.sortPath,
    replyCount: doc.replyCount,
    directReplyCount: doc.directReplyCount,
    lastReplyAt: doc.lastReplyAt,
    isLocked: doc.isLocked,
    scoreEntryId: doc.scoreEntryId,
    extra: doc.extra as any,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

type Review = PostDTO;

export interface ReviewsPageProps {
  bookUnitId?: string;
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({ bookUnitId }) => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const targetUnitId = bookUnitId ?? "";
  const EXTERNAL_PAGE_SIZE = 50;
  const [start, setStart] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tab, setTab] = useState<"review" | "remark">("review");
  const [keyword, setKeyword] = useState<string>("");

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

  const { data: reactionSummaryBatch } = useQuery({
    queryKey: ["reaction-summary-batch", tab, bookUnitId, currentTargetIds],
    queryFn: () => reactionApi.summary(currentTargetIds as string[]),
    enabled: currentTargetIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!baseReviews || baseReviews.length === 0) {
      setReviews([]);
      return;
    }

    if (!reactionSummaryBatch) {
      setReviews(baseReviews);
      return;
    }

    const merged = baseReviews.map((review) => {
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

  const totalItems: number = data?.total ?? 0;

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, [tab, keyword]);

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
        isLoading={isLoading && reviews.length === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        sortControl={
          <div>
            <TextSearchInput
              onSearch={(info) => {
                setKeyword(info ?? "");
              }}
              defaultValue={{ keyword: keyword ?? "" }}
              placeholder="Search reviews"
            />
            <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 2, mb: 2 }}>
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
          <ReviewList reviews={currentPageItems} />
        )}
      </UniversalPaginator>
    </div>
  );
};

export default ReviewsPage;
