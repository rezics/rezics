import {
  type AnyJobCommand,
  type CommandSource,
  createHistoryOutboxIngestCommand,
  createSearchCommand,
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
  const table = message.table;
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
      createSearchCommand(
        isDelete
          ? SEARCH_COMMAND_KINDS.contentDelete
          : SEARCH_COMMAND_KINDS.contentSync,
        { unitId },
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
    return unitId
      ? [
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

  if (table === "ShelfUnit") {
    const shelfId = targetId(message, ["shelfId", "shelf_id"]);
    return shelfId
      ? [
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchContainedUnitIds,
            { unitId: shelfId },
            source,
          ),
        ]
      : [];
  }

  if (table === "Post") {
    const postId = targetId(message, ["unitId", "unit_id", "id"]);
    if (!postId) return [];
    return [
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
