import { usePostSearchQuery } from "@rezics/api/meili/meili.queries";
import type { PostDTO, PostSearchDocument } from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import { EmptyState, Spinner } from "@rezics/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReviewList } from "@/review/components/list/ReviewList";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";

export function ReviewSearchPage() {
  const { t } = useTranslation();
  const search = useSearchQuery({});
  const [start, setStart] = useState(0);
  const limit = 20;
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading } = usePostSearchQuery({
    kind: PostKind.REVIEW,
    keyword,
    offset: start,
    limit,
  });

  const reviews = data?.items?.map(mapPostSearchDocToPostDTO) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">Search Reviews</h1>

      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setStart(0)}
          placeholder="Search reviews..."
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState title={t("review.search.empty.title")} />
      ) : (
        <ReviewList reviews={reviews} />
      )}
    </div>
  );
}

export default ReviewSearchPage;

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
    kind: doc.kind as PostDTO["kind"],
    depth: doc.depth,
    sortPath: doc.sortPath,
    replyCount: doc.replyCount,
    directReplyCount: doc.directReplyCount,
    lastReplyAt: doc.lastReplyAt,
    isLocked: doc.isLocked,
    scoreEntryId: doc.scoreEntryId,
    extra: doc.extra,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
