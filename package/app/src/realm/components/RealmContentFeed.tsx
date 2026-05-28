import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { PostKind, type PostListQuery } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { useQueries, useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PostCard } from "@/post";
import {
  ReviewCard,
  type ReviewTargetWork,
} from "@/review/components/item/ReviewCard";
import { getTranslation } from "@/shared/utils/translation-helpers";
import type { RealmFeedSort } from "../sections/RealmFeedSortSwitcher";

interface RealmContentFeedProps {
  realmId: string;
  sort?: RealmFeedSort;
  tagIds?: string[];
  realmLifecycleState?: PostListQuery["realmLifecycleState"];
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
  sort = "new",
  tagIds = [],
  realmLifecycleState,
}) => {
  const { t } = useTranslation(["entity"]);
const { data, error, isError, isLoading } = useQuery(
    postQueries.byRealm(realmId, {
      sort,
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(realmLifecycleState ? { realmLifecycleState } : {}),
    }),
  );
  const posts = data?.posts ?? [];
  const reviewTargetIds = useMemo(
    () =>
      Array.from(
        new Set(
          posts
            .filter((post) => post.kind === PostKind.REVIEW)
            .map((post) => post.targetUnitId)
            .filter(Boolean) as string[],
        ),
      ),
    [posts],
  );
  const targetBookQueries = useQueries({
    queries: reviewTargetIds.map((unitId) => ({
      ...bookQueries.detail(unitId),
      enabled: Boolean(unitId),
    })),
  });
  const targetWorkByUnitId = useMemo(() => {
    const map = new Map<string, ReviewTargetWork>();
    for (const result of targetBookQueries) {
      const book = result.data;
      if (!book) continue;
      const title =
        getTranslation(book.translations, book.defaultLanguage ?? undefined)
          ?.title ?? book.unitId;
      map.set(book.unitId, {
        unitId: book.unitId,
        title,
      });
    }
    return map;
  }, [targetBookQueries]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return <QueryErrorDisplay error={error} />;
  }

  if (posts.length === 0) {
    return <EmptyState title={t("entity:realm_content_empty_title")} />;
  }

  return (
    <div>
      {posts.map((post) =>
        post.kind === PostKind.REVIEW ? (
          <ReviewCard
            key={post.unitId}
            review={post}
            targetWork={
              post.targetUnitId
                ? targetWorkByUnitId.get(post.targetUnitId)
                : undefined
            }
          />
        ) : (
          <PostCard key={post.unitId} post={post} />
        ),
      )}
    </div>
  );
};
