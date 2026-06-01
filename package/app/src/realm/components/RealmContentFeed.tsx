import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
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
  type ReviewTargetUnit,
} from "@/review/components/item/ReviewCard";
import { getTranslation } from "@/shared/utils/translation-helpers";
import {
  realmContextPostHref,
  realmContextReactionScopeKey,
} from "../models/realmPostContext";
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
  const reactionScopeKey = realmContextReactionScopeKey(realmId);
  const postReactionTargetIds = useMemo(
    () =>
      posts
        .filter((post) => post.kind !== PostKind.REVIEW)
        .map((post) => post.unitId),
    [posts],
  );
  useReactionHydration(postReactionTargetIds, {
    summaryScopeKey: reactionScopeKey,
    userScopeKey: reactionScopeKey,
  });
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
  const targetUnitByUnitId = useMemo(() => {
    const map = new Map<string, ReviewTargetUnit>();
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
            targetUnit={
              post.targetUnitId
                ? targetUnitByUnitId.get(post.targetUnitId)
                : undefined
            }
          />
        ) : (
          <PostCard
            key={post.unitId}
            post={post}
            href={realmContextPostHref({
              realmId,
              postUnitId: post.unitId,
            })}
            summaryScopeKey={reactionScopeKey}
            reactionScopeKey={reactionScopeKey}
          />
        ),
      )}
    </div>
  );
};
