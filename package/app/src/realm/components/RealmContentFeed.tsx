import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { EmptyState } from "@rezics/ui";
import { useQueries, useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
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
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
  sort = "new",
  tagIds = [],
}) => {
  const { data } = useQuery(
    postQueries.byRealm(realmId, {
      sort,
      ...(tagIds.length > 0 ? { tagIds } : {}),
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

  if (posts.length === 0) {
    return <EmptyState title={m.realm_content_empty_title()} />;
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
