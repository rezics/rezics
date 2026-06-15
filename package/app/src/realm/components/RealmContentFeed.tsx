import type { FeedPostRow } from "@rezics/api/feed/feed";
import { postQueries } from "@rezics/api/post/post";
import {
  type ModerationActionDTO,
  PostKind,
  type PostListQuery,
  type UnitRealmDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { FeedPostRowCard, FeedSectionContent, useFeedRows } from "@/feed";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
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
  const feedQuery = useFeedRows(
    {
      scope: "realm",
      realmUnitId: realmId,
      sort,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(realmModerationStatus ? { realmModerationStatus } : {}),
    },
    { enabled: readContext.ready && Boolean(realmId) },
  );
  const rows = feedQuery.rows;
  const postRows = useMemo(
    () => rows.filter((row): row is FeedPostRow => row.type === "post"),
    [rows],
  );
  const reactionContextUnitId = realmId;
  const moderationTargetIds = useMemo(
    () =>
      postRows
        .filter((row) => row.post.kind !== PostKind.REVIEW)
        .map((row) => row.post.unitId),
    [postRows],
  );
  const moderationOverlayQuery = useQuery({
    ...postQueries.moderationOverlays(moderationTargetIds, realmId),
    enabled: manageMode && moderationTargetIds.length > 0,
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

  const fallbackModerationStatus =
    realmModerationStatus && realmModerationStatus !== "all"
      ? realmModerationStatus
      : "approved";

  const renderPostRow = (row: FeedPostRow) => {
    const unitRealm =
      unitRealmByUnitId.get(row.post.unitId) ??
      ({
        realmUnitId: realmId,
        unitId: row.post.unitId,
        moderationStatus: fallbackModerationStatus,
        isLocked: false,
      } satisfies UnitRealmDTO);

    return (
      <FeedPostRowCard
        row={row}
        summaryContextUnitId={reactionContextUnitId}
        reactionContextUnitId={reactionContextUnitId}
        hydrateReaction={false}
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
    <FeedSectionContent
      rows={rows}
      loading={feedQuery.isLoading}
      emptyTitle={t("entity:realm_content_empty_title")}
      renderPostRow={renderPostRow}
      error={feedQuery.error}
      isError={feedQuery.isError}
      isFetchingNextPage={feedQuery.isFetchingNextPage}
      hasNextPage={feedQuery.hasNextPage}
      refetch={feedQuery.refetch}
      fetchNextPage={feedQuery.fetchNextPage}
    />
  );
};
