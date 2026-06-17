import type { StreamPostRow } from "@rezics/api/stream/stream";
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
import {
  StreamPostRowCard,
  StreamSectionContent,
  useStreamRows,
} from "@/stream";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import type { RealmStreamSort } from "../sections/RealmStreamSortSwitcher";
import { RealmContentModerationActions } from "./RealmContentModerationActions";

interface RealmContentStreamProps {
  realmId: string;
  sort?: RealmStreamSort;
  tagIds?: string[];
  policyTagIds?: string[];
  realmModerationStatus?: PostListQuery["realmModerationStatus"];
  manageMode?: boolean;
}

export const RealmContentStream: React.FC<RealmContentStreamProps> = ({
  realmId,
  sort = "new",
  tagIds = [],
  policyTagIds = [],
  realmModerationStatus,
  manageMode = false,
}) => {
  const { t } = useTranslation(["entity"]);
  const readContext = useReadLanguageContext();
  const streamQuery = useStreamRows(
    {
      scope: "realm",
      realmUnitId: realmId,
      sort,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      ...(tagIds.length > 0 ? { tagIds } : {}),
      ...(policyTagIds.length > 0 ? { policyTagIds } : {}),
      ...(realmModerationStatus ? { realmModerationStatus } : {}),
    },
    { enabled: readContext.ready && Boolean(realmId) },
  );
  const rows = streamQuery.rows;
  const postRows = useMemo(
    () => rows.filter((row): row is StreamPostRow => row.type === "post"),
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

  const renderPostRow = (row: StreamPostRow) => {
    const unitRealm =
      unitRealmByUnitId.get(row.post.unitId) ??
      ({
        realmUnitId: realmId,
        unitId: row.post.unitId,
        moderationStatus: fallbackModerationStatus,
        isLocked: false,
      } satisfies UnitRealmDTO);

    return (
      <StreamPostRowCard
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
    <StreamSectionContent
      rows={rows}
      loading={streamQuery.isLoading}
      emptyTitle={t("entity:realm_content_empty_title")}
      renderPostRow={renderPostRow}
      error={streamQuery.error}
      isError={streamQuery.isError}
      isFetchingNextPage={streamQuery.isFetchingNextPage}
      hasNextPage={streamQuery.hasNextPage}
      refetch={streamQuery.refetch}
      fetchNextPage={streamQuery.fetchNextPage}
    />
  );
};
