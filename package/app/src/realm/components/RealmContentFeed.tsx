import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import {
  type ModerationActionDTO,
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
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
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
  realmModerationStatus?: PostListQuery["realmModerationStatus"];
  manageMode?: boolean;
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
  sort = "new",
  tagIds = [],
  realmModerationStatus,
  manageMode = false,
}) => {
  const { t } = useTranslation(["entity"]);
  const readContext = useReadLanguageContext();
  const { data, error, isError, isLoading } = useQuery({
    ...postQueries.byRealm(realmId, {
      sort,
      languages: readContext.languages,
      languageMode: readContext.languageMode,
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(realmModerationStatus ? { realmModerationStatus } : {}),
    }),
    enabled: readContext.ready && Boolean(realmId),
  });
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
    for (const row of moderationOverlayQuery.data?.overlays ?? []) {
      map.set(row.id, {
        realmUnitId: realmId,
        unitId: row.id,
        moderationStatus: row.moderationStatus,
        isLocked: false,
      });
    }
    return map;
  }, [moderationOverlayQuery.data, realmId]);
  const latestActionByUnitId = useMemo(() => {
    if (!moderationOverlayQuery.data) return null;
    const map = new Map<string, ModerationActionDTO | null>();
    for (const row of moderationOverlayQuery.data.overlays) {
      map.set(row.id, row.latestAction ?? null);
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
      ...bookQueries.detail(unitId, { languages: readContext.languages }),
      enabled: readContext.ready && Boolean(unitId),
    })),
  });
  const targetUnitByUnitId = useMemo(() => {
    const map = new Map<string, ReviewTargetUnit>();
    for (const result of targetBookQueries) {
      const book = result.data;
      if (!book) continue;
      const title = book.title ?? book.unitId;
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

  const fallbackModerationStatus =
    realmModerationStatus && realmModerationStatus !== "all"
      ? realmModerationStatus
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
            moderationStatus: fallbackModerationStatus,
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
            realmModerationStatus={
              manageMode ? unitRealm.moderationStatus : undefined
            }
            realmModerationAt={unitRealm.createdAt ?? null}
            moderationLatestAction={latestActionByUnitId?.get(post.unitId)}
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
