import {
  type AnyJobCommand,
  type CommandSource,
  createHistoryOutboxIngestCommand,
  createMaintenanceCommand,
  createRankingCommand,
  createSearchCommand,
  MAINTENANCE_COMMAND_KINDS,
  RANKING_COMMAND_KINDS,
  SEARCH_COMMAND_KINDS,
} from "@rezics/job";
import type { SequinMessage } from "./types";

function targetId(message: SequinMessage, keys: string[] = ["id"]) {
  for (const key of keys) {
    const value = message.record[key] ?? message.recordPks[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function normalizeTableName(table: string) {
  return table
    .split(".")
    .at(-1)
    ?.replace(/^"+|"+$/g, "");
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function reactionSummaryDelta(message: SequinMessage): number | undefined {
  const action = message.action.toLowerCase();
  const count = numberValue(message.record.count);
  const previousCount = numberValue(message.changes?.count);
  if (action === "insert") return count ?? 1;
  if (action === "delete") return count === undefined ? undefined : -count;
  if (
    action === "update" &&
    count !== undefined &&
    previousCount !== undefined
  ) {
    return count - previousCount;
  }
  return undefined;
}

function sequinSource(message: SequinMessage): CommandSource {
  return {
    type: "sequin",
    table: message.table,
    action: message.action,
    recordPks: message.recordPks,
    sequinIdempotencyKey: message.idempotencyKey,
    commitLsn: message.commitLsn,
    commitIdx: message.commitIdx,
    commitTimestamp: message.commitTimestamp,
  };
}

export function routeSequinMessage(message: SequinMessage): AnyJobCommand[] {
  const source = sequinSource(message);
  const table = normalizeTableName(message.table);
  const action = message.action.toLowerCase();
  const isDelete = action === "delete";

  if (table === "HistoryOutbox") {
    const outboxId = targetId(message);
    return outboxId ? [createHistoryOutboxIngestCommand(outboxId, source)] : [];
  }

  if (table === "Unit") {
    const unitId = targetId(message);
    if (!unitId) return [];
    return [
      createRankingCommand(
        RANKING_COMMAND_KINDS.invalidate,
        { unitId, reason: "Unit CDC" },
        source,
      ),
      createSearchCommand(
        isDelete
          ? SEARCH_COMMAND_KINDS.contentDelete
          : SEARCH_COMMAND_KINDS.contentSync,
        { unitId },
        source,
      ),
      createSearchCommand(
        SEARCH_COMMAND_KINDS.shelfItemSourceFanout,
        { itemType: "unit", itemId: unitId },
        source,
      ),
    ];
  }

  if (table === "UnitTranslation") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    if (!unitId) return [];
    return [
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentPatchTranslations,
        { unitId },
        source,
      ),
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postPatchTargetFanout,
        { targetId: unitId },
        source,
      ),
      createSearchCommand(
        SEARCH_COMMAND_KINDS.shelfItemSourceFanout,
        { itemType: "unit", itemId: unitId },
        source,
      ),
    ];
  }

  if (table === "UnitTag" || table === "TagVote") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    return unitId
      ? [
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchTags,
            { unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "UnitAlias") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    return unitId
      ? [
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchAliases,
            { unitId },
            source,
          ),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.entityPatchAliases,
            { unitId },
            source,
          ),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.realmPatchAliases,
            { unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "CreditAttribution") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    return unitId
      ? [
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchCredits,
            { unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "SubjectAttribution") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    return unitId
      ? [
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchSubjects,
            { unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "UnitRealm") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    const realmUnitId = targetId(message, ["realmUnitId", "realm_unit_id"]);
    return unitId
      ? [
          createRankingCommand(
            RANKING_COMMAND_KINDS.invalidate,
            {
              unitId,
              scope: realmUnitId
                ? { kind: "realm", id: realmUnitId }
                : undefined,
              reason: "UnitRealm CDC",
            },
            source,
          ),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchRealmIds,
            { unitId },
            source,
          ),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.postPatchRealmIds,
            { targetId: unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "RealmTagApplication" || table === "RealmTagUnit") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    return unitId
      ? [
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
            { unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "ShelfItem") {
    const shelfId = targetId(message, ["shelfId", "shelf_id"]);
    const itemType = targetId(message, ["itemType", "item_type"]) ?? "unit";
    const itemId = targetId(message, [
      "itemId",
      "item_id",
      "unitId",
      "unit_id",
    ]);
    return shelfId
      ? [
          ...(itemId
            ? [
                createSearchCommand(
                  isDelete
                    ? SEARCH_COMMAND_KINDS.shelfItemRemove
                    : SEARCH_COMMAND_KINDS.shelfItemSync,
                  { shelfId, itemType, itemId },
                  source,
                ),
              ]
            : [
                createSearchCommand(
                  SEARCH_COMMAND_KINDS.shelfItemShelfFanout,
                  { shelfId },
                  source,
                ),
              ]),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchContainedUnitIds,
            { unitId: shelfId },
            source,
          ),
        ]
      : [];
  }

  if (table === "ContentStructureNode") {
    const ownerUnitId = targetId(message, ["ownerUnitId", "owner_unit_id"]);
    return ownerUnitId
      ? [
          createMaintenanceCommand(
            MAINTENANCE_COMMAND_KINDS.seriesContentIndexRepair,
            { seriesUnitId: ownerUnitId },
            source,
          ),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentSync,
            { unitId: ownerUnitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "Post") {
    const postId = targetId(message, ["unitId", "unit_id", "id"]);
    if (!postId) return [];
    return [
      createRankingCommand(
        RANKING_COMMAND_KINDS.invalidate,
        { unitId: postId, rankKind: "post", reason: "Post CDC" },
        source,
      ),
      createSearchCommand(
        isDelete
          ? SEARCH_COMMAND_KINDS.postDelete
          : SEARCH_COMMAND_KINDS.postSync,
        { postId },
        source,
      ),
      createSearchCommand(
        isDelete
          ? SEARCH_COMMAND_KINDS.contentDelete
          : SEARCH_COMMAND_KINDS.contentSync,
        { unitId: postId },
        source,
      ),
    ];
  }

  if (table === "User") {
    const userId = targetId(message);
    if (!userId) return [];
    return [
      createSearchCommand(
        isDelete
          ? SEARCH_COMMAND_KINDS.userDelete
          : SEARCH_COMMAND_KINDS.userSync,
        { userId },
        source,
      ),
      createSearchCommand(
        SEARCH_COMMAND_KINDS.userPostsAuthorFanout,
        { targetId: userId },
        source,
      ),
    ];
  }

  if (table === "UserUnitProgress") {
    const userId = targetId(message, ["userId", "user_id"]);
    const unitId = targetId(message, ["unitId", "unit_id"]);
    return userId && unitId
      ? [
          createRankingCommand(
            RANKING_COMMAND_KINDS.invalidate,
            { unitId, rankKind: "content", reason: "UserUnitProgress CDC" },
            source,
          ),
          createSearchCommand(
            isDelete
              ? SEARCH_COMMAND_KINDS.progressRemove
              : SEARCH_COMMAND_KINDS.progressSync,
            { userId, unitId },
            source,
          ),
        ]
      : [];
  }

  if (table === "Comment") {
    const commentId = targetId(message);
    return commentId
      ? [
          createSearchCommand(
            isDelete
              ? SEARCH_COMMAND_KINDS.commentDelete
              : SEARCH_COMMAND_KINDS.commentSync,
            { commentId },
            source,
          ),
          createSearchCommand(
            SEARCH_COMMAND_KINDS.shelfItemSourceFanout,
            { itemType: "comment", itemId: commentId },
            source,
          ),
        ]
      : [];
  }

  if (table === "ScoreEntry" || table === "ScoreAggregate") {
    const unitId = targetId(message, ["unitId", "unit_id"]);
    const realm = targetId(message, ["realm"]);
    return unitId
      ? [
          createRankingCommand(
            RANKING_COMMAND_KINDS.invalidate,
            {
              unitId,
              scope: realm ? { kind: "realm", id: realm } : undefined,
              reason: `${table} CDC`,
            },
            source,
          ),
        ]
      : [];
  }

  if (table === "ReactionSummary") {
    const unitId = targetId(message, ["targetId", "target_id"]);
    const scopeKey = targetId(message, ["scopeKey", "scope_key"]);
    const reaction = targetId(message, ["reaction"]);
    const voteDelta = reactionSummaryDelta(message);
    const realmUnitId = scopeKey?.startsWith("realm:")
      ? scopeKey.slice("realm:".length)
      : undefined;
    const voteBucketCommands =
      unitId !== undefined &&
      (reaction === "upvote" || reaction === "downvote") &&
      voteDelta !== undefined &&
      voteDelta !== 0
        ? [
            createRankingCommand(
              RANKING_COMMAND_KINDS.reactionBucket,
              {
                targetId: unitId,
                scopeKey: scopeKey ?? "global",
                reaction,
                count: voteDelta,
                at: message.commitTimestamp,
              },
              source,
            ),
          ]
        : [];
    return unitId
      ? [
          ...voteBucketCommands,
          createRankingCommand(
            RANKING_COMMAND_KINDS.invalidate,
            { unitId, reason: "ReactionSummary CDC" },
            source,
          ),
          ...(realmUnitId
            ? [
                createRankingCommand(
                  RANKING_COMMAND_KINDS.invalidate,
                  {
                    unitId,
                    scope: { kind: "realm", id: realmUnitId },
                    reason: "ReactionSummary realm CDC",
                  },
                  source,
                ),
              ]
            : []),
        ]
      : [];
  }

  if (table === "Feedback") {
    const feedbackId = targetId(message);
    return feedbackId
      ? [
          createSearchCommand(
            isDelete
              ? SEARCH_COMMAND_KINDS.feedbackDelete
              : SEARCH_COMMAND_KINDS.feedbackSync,
            { feedbackId },
            source,
          ),
        ]
      : [];
  }

  return [];
}

export function routeSequinMessages(messages: SequinMessage[]) {
  return messages.flatMap((message) => routeSequinMessage(message));
}
