import {
  type FeedContentRow,
  feedRowsInfiniteQuery,
} from "@rezics/api/feed/feed";
import { postQueries } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import {
  type ModerationActionDTO,
  PostKind,
  type PostListQuery,
  type UnitRealmDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { FeedContentCard, FeedRenderer } from "@/feed";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { realmContextReactionScopeKey } from "../models/realmPostContext";
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
  const { t } = useTranslation(["common", "entity"]);
  const readContext = useReadLanguageContext();
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    ...feedRowsInfiniteQuery({
      scope: "realm",
      realmUnitId: realmId,
      sort,
      languages: readContext.languages,
      languageMode: readContext.languageMode,
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(realmModerationStatus ? { realmModerationStatus } : {}),
    }),
    enabled: readContext.ready && Boolean(realmId),
  });
  const rows = data?.pages.flatMap((page) => page.rows) ?? [];
  const contentRows = useMemo(
    () => rows.filter((row): row is FeedContentRow => row.type === "content"),
    [rows],
  );
  const reactionScopeKey = realmContextReactionScopeKey(realmId);
  const postReactionTargetIds = useMemo(
    () =>
      contentRows
        .filter((row) => row.post.kind !== PostKind.REVIEW)
        .map((row) => row.post.unitId),
    [contentRows],
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

  if (isError && rows.length === 0) return <QueryErrorDisplay error={error} />;

  const fallbackModerationStatus =
    realmModerationStatus && realmModerationStatus !== "all"
      ? realmModerationStatus
      : "approved";

  const renderContentRow = (row: FeedContentRow) => {
    const unitRealm =
      unitRealmByUnitId.get(row.post.unitId) ??
      ({
        realmUnitId: realmId,
        unitId: row.post.unitId,
        moderationStatus: fallbackModerationStatus,
        isLocked: false,
      } satisfies UnitRealmDTO);

    return (
      <FeedContentCard
        row={row}
        summaryScopeKey={reactionScopeKey}
        reactionScopeKey={reactionScopeKey}
        manageMode={manageMode}
        realmModerationStatus={
          manageMode ? unitRealm.moderationStatus : undefined
        }
        realmModerationAt={unitRealm.createdAt ?? null}
        moderationLatestAction={latestActionByUnitId?.get(row.post.unitId)}
        moderationMenuContent={
          manageMode ? (
            <RealmContentModerationActions
              realmUnitId={realmId}
              targetUnitId={row.post.unitId}
              unitRealm={unitRealm}
            />
          ) : undefined
        }
      />
    );
  };

  return (
    <div className="space-y-4">
      <FeedRenderer
        rows={rows}
        loading={isLoading}
        emptyTitle={t("entity:realm_content_empty_title")}
        renderContentRow={renderContentRow}
      />
      {isError && rows.length > 0 ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            {t("common:retry")}
          </Button>
        </div>
      ) : null}
      {!isLoading && !isError && hasNextPage ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                {t("common:loading")}
              </span>
            ) : (
              t("common:load_more")
            )}
          </Button>
        </div>
      ) : null}
      {!isLoading && !isError && rows.length > 0 && !hasNextPage ? (
        <p className="text-center text-xs leading-dense text-text-tertiary">
          {t("common:end_of_list")}
        </p>
      ) : null}
    </div>
  );
};
