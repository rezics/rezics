import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import {
  PostKind,
  type PostListQuery,
  type UnitRealmDTO,
} from "@rezics/contract";
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
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";
import { getTranslation } from "@/shared/utils/translation-helpers";
import {
  realmContextPostHref,
  realmContextReactionScopeKey,
} from "../models/realmPostContext";
import type { RealmFeedSort } from "../sections/RealmFeedSortSwitcher";
import { RealmContentModerationActions } from "./RealmContentModerationActions";

interface RealmContentFeedProps {
  realmId: string;
  sort?: RealmFeedSort;
  tagIds?: string[];
  realmModerationState?: PostListQuery["realmModerationState"];
  manageMode?: boolean;
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
  sort = "new",
  tagIds = [],
  realmModerationState,
  manageMode = false,
}) => {
  const { t } = useTranslation(["entity"]);
  const languages = useReadLanguageCandidates();
  const { data, error, isError, isLoading } = useQuery(
    postQueries.byRealm(realmId, {
      sort,
      languages,
      languageMode: "preferred",
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(realmModerationState ? { realmModerationState } : {}),
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
  const moderationOverlayQuery = useQuery({
    ...postQueries.moderationOverlays(postReactionTargetIds, realmId),
    enabled: manageMode && postReactionTargetIds.length > 0,
  });
  const unitRealmByUnitId = useMemo(() => {
    const map = new Map<string, UnitRealmDTO>();
    for (const row of moderationOverlayQuery.data?.realmOverlays ?? []) {
      map.set(row.unitId, row);
    }
    return map;
  }, [moderationOverlayQuery.data]);
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

  const fallbackModerationState =
    realmModerationState && realmModerationState !== "all"
      ? realmModerationState
      : "approved";

  return (
    <div>
      {posts.map((post) => {
        if (post.kind === PostKind.REVIEW) {
          return (
            <ReviewCard
              key={post.unitId}
              review={post}
              targetUnit={
                post.targetUnitId
                  ? targetUnitByUnitId.get(post.targetUnitId)
                  : undefined
              }
            />
          );
        }

        const unitRealm =
          unitRealmByUnitId.get(post.unitId) ??
          ({
            realmUnitId: realmId,
            unitId: post.unitId,
            moderationState: fallbackModerationState,
            visibilityState: "visible",
            isLocked: false,
          } satisfies UnitRealmDTO);

        return (
          <PostCard
            key={post.unitId}
            post={post}
            href={realmContextPostHref({
              realmId,
              postUnitId: post.unitId,
            })}
            summaryScopeKey={reactionScopeKey}
            reactionScopeKey={reactionScopeKey}
            manageMode={manageMode}
            realmModerationState={
              manageMode ? unitRealm.moderationState : undefined
            }
            realmModerationAt={unitRealm.createdAt ?? null}
            realmVisibilityState={
              manageMode && unitRealm.visibilityState !== "visible"
                ? unitRealm.visibilityState
                : null
            }
            moderationMenuContent={
              manageMode ? (
                <RealmContentModerationActions
                  realmUnitId={realmId}
                  targetUnitId={post.unitId}
                  unitRealm={unitRealm}
                />
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
};
