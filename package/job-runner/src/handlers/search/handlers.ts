import {
  type AnyJobCommand,
  createSearchCommand,
  SEARCH_COMMAND_KINDS,
  type SearchCommand,
} from "@rezics/job";
import type { SearchClient } from "@rezics/search/client";
import {
  patchContentAliases,
  patchContentContainedUnitIds,
  patchContentCredits,
  patchContentMetadata,
  patchContentRealmIds,
  patchContentRealmTagKeys,
  patchContentSubjects,
  patchContentTags,
  patchContentTagsByTagSegment,
  patchContentTranslations,
  patchEntityAliases,
  patchFeedbackResolutionFromDb,
  patchLabelAliases,
  patchPostFields,
  patchPostsTargetSegment,
  patchRealmAliases,
  patchRealmMemberCount,
  patchRealmMemberCountFromDb,
  patchRealmMetadata,
  patchRealmTranslations,
  patchTagAliases,
  patchUserFields,
  removeProgress,
  removeShelfItem,
  type SearchSegmentOptions,
  type SearchSegmentResult,
  syncAllPolls,
  syncCommentSegment,
  syncContentSegment,
  syncEntitySegment,
  syncFeedbackSegment,
  syncLabelSegment,
  syncPostRealmIdsSegment,
  syncPostSegment,
  syncPostsByAuthorSegment,
  syncProgressSegment,
  syncRealmSegment,
  syncReleaseContentSegment,
  syncShelfItemSegment,
  syncShelfItemsByShelfSegment,
  syncShelfItemsBySourceItemSegment,
  syncSingleLabel,
  syncSingleComment,
  syncSingleContent,
  syncSingleEntity,
  syncSingleFeedback,
  syncSinglePoll,
  syncSinglePost,
  syncSingleProgress,
  syncSingleRealm,
  syncSingleShelfItem,
  syncSingleTag,
  syncSingleUser,
  syncSingleZone,
  syncUserSegment,
  syncZoneSegment,
  syncTagSegment,
} from "@rezics/search/sync";
import {
  DEFAULT_FANOUT_SEGMENT_LIMIT,
  type FanoutPayload,
  nextFanoutPayload,
} from "../../fanout";
import type { HandlerContext, JobHandler } from "../../worker";
import { withHandlerMetadata } from "./util";

type SearchOperations = Partial<
  Record<
    SearchCommand["kind"],
    (command: SearchCommand, context: HandlerContext) => Promise<unknown>
  >
>;

function fieldsFrom(payload: SearchCommand["payload"]) {
  if (
    "fields" in payload &&
    payload.fields &&
    typeof payload.fields === "object"
  ) {
    return payload.fields as Record<string, unknown>;
  }
  return {};
}

function targetIdFrom(payload: SearchCommand["payload"]) {
  if ("targetId" in payload) return payload.targetId;
  if ("unitId" in payload) return payload.unitId;
  if ("postId" in payload) return payload.postId;
  if ("userId" in payload) return payload.userId;
  if ("feedbackId" in payload) return payload.feedbackId;
  return undefined;
}

function indexForKind(kind: string) {
  const [, domain] = kind.split(".");
  return domain;
}

function fanoutPayloadFrom(command: SearchCommand): FanoutPayload | undefined {
  if (!("targetId" in command.payload)) return undefined;
  return {
    targetId: command.payload.targetId,
    cursor: "cursor" in command.payload ? command.payload.cursor : undefined,
    limit: "limit" in command.payload ? command.payload.limit : undefined,
  };
}

async function runFanoutSegment(
  command: SearchCommand,
  context: HandlerContext,
  operation: (
    targetId: string,
    options: SearchSegmentOptions,
  ) => Promise<SearchSegmentResult>,
) {
  const payload = fanoutPayloadFrom(command);
  if (!payload) return undefined;

  const result = await operation(payload.targetId, {
    cursor: payload.cursor,
    limit: payload.limit ?? DEFAULT_FANOUT_SEGMENT_LIMIT,
  });
  const nextPayload = nextFanoutPayload(payload, result);
  if (nextPayload) {
    await context.enqueue(
      createSearchCommand(command.kind, nextPayload, command.source),
    );
  }
  return {
    ...result,
    continued: Boolean(nextPayload),
  };
}

async function runShelfItemShelfFanoutSegment(
  command: SearchCommand,
  context: HandlerContext,
  operation: (
    shelfId: string,
    options: SearchSegmentOptions,
  ) => Promise<SearchSegmentResult>,
) {
  if (!("shelfId" in command.payload)) return undefined;
  const result = await operation(command.payload.shelfId, {
    cursor: "cursor" in command.payload ? command.payload.cursor : undefined,
    limit:
      "limit" in command.payload
        ? command.payload.limit
        : DEFAULT_FANOUT_SEGMENT_LIMIT,
  });
  if (result.nextCursor) {
    await context.enqueue(
      createSearchCommand(
        command.kind,
        { ...command.payload, cursor: result.nextCursor },
        command.source,
      ),
    );
  }
  return { ...result, continued: Boolean(result.nextCursor) };
}

async function runShelfItemSourceFanoutSegment(
  command: SearchCommand,
  context: HandlerContext,
  operation: (
    itemType: string,
    itemId: string,
    options: SearchSegmentOptions,
  ) => Promise<SearchSegmentResult>,
) {
  if (!("itemType" in command.payload) || !("itemId" in command.payload)) {
    return undefined;
  }
  const result = await operation(
    command.payload.itemType,
    command.payload.itemId,
    {
      cursor: "cursor" in command.payload ? command.payload.cursor : undefined,
      limit:
        "limit" in command.payload
          ? command.payload.limit
          : DEFAULT_FANOUT_SEGMENT_LIMIT,
    },
  );
  if (result.nextCursor) {
    await context.enqueue(
      createSearchCommand(
        command.kind,
        { ...command.payload, cursor: result.nextCursor },
        command.source,
      ),
    );
  }
  return { ...result, continued: Boolean(result.nextCursor) };
}

function fullSyncPayloadFrom(command: SearchCommand): SearchSegmentOptions {
  return {
    cursor: "cursor" in command.payload ? command.payload.cursor : undefined,
    limit: "limit" in command.payload ? command.payload.limit : undefined,
  };
}

async function runFullSyncSegment(
  command: SearchCommand,
  context: HandlerContext,
  options: {
    deleteAll: () => Promise<unknown>;
    syncSegment: (
      options: SearchSegmentOptions,
    ) => Promise<SearchSegmentResult>;
  },
) {
  const payload = fullSyncPayloadFrom(command);
  const resetResult = payload.cursor ? undefined : await options.deleteAll();
  const result = await options.syncSegment(payload);
  if (result.nextCursor) {
    await context.enqueue(
      createSearchCommand(
        command.kind,
        {
          ...command.payload,
          cursor: result.nextCursor,
        },
        command.source,
      ),
    );
  }
  return {
    ...(resetResult ? { resetResult } : {}),
    ...result,
    continued: Boolean(result.nextCursor),
  };
}

export function createSearchHandlers(client: SearchClient) {
  const operations: SearchOperations = {
    [SEARCH_COMMAND_KINDS.contentSync]: async (command) =>
      "unitId" in command.payload
        ? syncSingleContent(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deleteContent([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchMetadata]: async (command) =>
      patchContentMetadata(
        client,
        targetIdFrom(command.payload) ?? "",
        fieldsFrom(command.payload),
      ),
    [SEARCH_COMMAND_KINDS.contentPatchTags]: async (command) =>
      "unitId" in command.payload
        ? patchContentTags(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchAliases]: async (command) =>
      "unitId" in command.payload
        ? patchContentAliases(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchCredits]: async (command) =>
      "unitId" in command.payload
        ? patchContentCredits(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchSubjects]: async (command) =>
      "unitId" in command.payload
        ? patchContentSubjects(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchTranslations]: async (command) =>
      "unitId" in command.payload
        ? patchContentTranslations(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchTagFanout]: async (command, context) =>
      runFanoutSegment(command, context, (targetId, options) =>
        patchContentTagsByTagSegment(client, targetId, options),
      ),
    [SEARCH_COMMAND_KINDS.contentPatchRealmIds]: async (command) =>
      "unitId" in command.payload
        ? patchContentRealmIds(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys]: async (command) =>
      "unitId" in command.payload
        ? patchContentRealmTagKeys(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentPatchContainedUnitIds]: async (command) =>
      "unitId" in command.payload
        ? patchContentContainedUnitIds(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.contentReleaseFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: async () => undefined,
        syncSegment: (options) => syncReleaseContentSegment(client, options),
      }),
    [SEARCH_COMMAND_KINDS.contentFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllContent(),
        syncSegment: (options) => syncContentSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.postSync]: async (command) =>
      "postId" in command.payload
        ? syncSinglePost(client, command.payload.postId)
        : undefined,
    [SEARCH_COMMAND_KINDS.postDelete]: async (command) =>
      "postId" in command.payload
        ? client.deletePosts([command.payload.postId])
        : undefined,
    [SEARCH_COMMAND_KINDS.postPatchFields]: async (command) =>
      patchPostFields(
        client,
        targetIdFrom(command.payload) ?? "",
        fieldsFrom(command.payload),
      ),
    [SEARCH_COMMAND_KINDS.postPatchAuthorFanout]: async (command, context) =>
      runFanoutSegment(command, context, (targetId, options) =>
        syncPostsByAuthorSegment(client, targetId, options),
      ),
    [SEARCH_COMMAND_KINDS.postPatchTargetFanout]: async (command, context) =>
      runFanoutSegment(command, context, (targetId, options) =>
        patchPostsTargetSegment(client, targetId, options),
      ),
    [SEARCH_COMMAND_KINDS.postPatchRealmIds]: async (command, context) =>
      runFanoutSegment(command, context, (_targetId, options) =>
        syncPostRealmIdsSegment(client, options),
      ),
    [SEARCH_COMMAND_KINDS.postFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllPosts(),
        syncSegment: (options) => syncPostSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.commentSync]: async (command) =>
      "commentId" in command.payload
        ? syncSingleComment(client, command.payload.commentId)
        : undefined,
    [SEARCH_COMMAND_KINDS.commentDelete]: async (command) =>
      "commentId" in command.payload
        ? client.deleteComments([command.payload.commentId])
        : undefined,
    [SEARCH_COMMAND_KINDS.commentFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllComments(),
        syncSegment: (options) => syncCommentSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.pollSync]: async (command) =>
      "unitId" in command.payload
        ? syncSinglePoll(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.pollDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deletePolls([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.pollFullSync]: async () => syncAllPolls(client),

    [SEARCH_COMMAND_KINDS.realmSync]: async (command) =>
      "unitId" in command.payload
        ? syncSingleRealm(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.realmDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deleteRealms([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.realmPatchMetadata]: async (command) =>
      patchRealmMetadata(
        client,
        targetIdFrom(command.payload) ?? "",
        fieldsFrom(command.payload),
      ),
    [SEARCH_COMMAND_KINDS.realmPatchTranslations]: async (command) =>
      "unitId" in command.payload
        ? patchRealmTranslations(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.realmPatchAliases]: async (command) =>
      "unitId" in command.payload
        ? patchRealmAliases(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.realmPatchMemberCount]: async (command) =>
      "unitId" in command.payload
        ? patchRealmMemberCountFromDb(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.realmFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllRealms(),
        syncSegment: (options) => syncRealmSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.zoneSync]: async (command) =>
      "unitId" in command.payload
        ? syncSingleZone(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.zoneDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deleteZones([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.zoneFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllZones(),
        syncSegment: (options) => syncZoneSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.tagSync]: async (command) =>
      "unitId" in command.payload
        ? syncSingleTag(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.tagDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deleteTags([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.tagPatchAliases]: async (command) =>
      "unitId" in command.payload
        ? patchTagAliases(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.tagFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllTags(),
        syncSegment: (options) => syncTagSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.labelSync]: async (command) =>
      "unitId" in command.payload
        ? syncSingleLabel(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.labelDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deleteLabels([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.labelPatchAliases]: async (command) =>
      "unitId" in command.payload
        ? patchLabelAliases(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.labelFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllLabels(),
        syncSegment: (options) => syncLabelSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.entitySync]: async (command) =>
      "unitId" in command.payload
        ? syncSingleEntity(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.entityDelete]: async (command) =>
      "unitId" in command.payload
        ? client.deleteEntities([command.payload.unitId])
        : undefined,
    [SEARCH_COMMAND_KINDS.entityPatchAliases]: async (command) =>
      "unitId" in command.payload
        ? patchEntityAliases(client, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.entityFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllEntities(),
        syncSegment: (options) => syncEntitySegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.userSync]: async (command) =>
      "userId" in command.payload
        ? syncSingleUser(client, command.payload.userId)
        : undefined,
    [SEARCH_COMMAND_KINDS.userDelete]: async (command) =>
      "userId" in command.payload
        ? client.deleteUsers([command.payload.userId])
        : undefined,
    [SEARCH_COMMAND_KINDS.userPatchFields]: async (command) =>
      patchUserFields(
        client,
        targetIdFrom(command.payload) ?? "",
        fieldsFrom(command.payload),
      ),
    [SEARCH_COMMAND_KINDS.userPostsAuthorFanout]: async (command, context) =>
      runFanoutSegment(command, context, (targetId, options) =>
        syncPostsByAuthorSegment(client, targetId, options),
      ),
    [SEARCH_COMMAND_KINDS.userFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllUsers(),
        syncSegment: (options) => syncUserSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.feedbackSync]: async (command) =>
      "feedbackId" in command.payload
        ? syncSingleFeedback(client, command.payload.feedbackId)
        : undefined,
    [SEARCH_COMMAND_KINDS.feedbackDelete]: async (command) =>
      "feedbackId" in command.payload
        ? client.deleteFeedbacks([command.payload.feedbackId])
        : undefined,
    [SEARCH_COMMAND_KINDS.feedbackPatchResolution]: async (command) =>
      "feedbackId" in command.payload
        ? patchFeedbackResolutionFromDb(client, command.payload.feedbackId)
        : undefined,
    [SEARCH_COMMAND_KINDS.feedbackFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllFeedbacks(),
        syncSegment: (options) => syncFeedbackSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.progressSync]: async (command) =>
      "userId" in command.payload && "unitId" in command.payload
        ? syncSingleProgress(
            client,
            command.payload.userId,
            command.payload.unitId,
          )
        : undefined,
    [SEARCH_COMMAND_KINDS.progressRemove]: async (command) =>
      "userId" in command.payload && "unitId" in command.payload
        ? removeProgress(client, command.payload.userId, command.payload.unitId)
        : undefined,
    [SEARCH_COMMAND_KINDS.progressFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllProgress(),
        syncSegment: (options) => syncProgressSegment(client, options),
      }),

    [SEARCH_COMMAND_KINDS.shelfItemSync]: async (command) =>
      "shelfId" in command.payload &&
      "itemType" in command.payload &&
      "itemId" in command.payload
        ? syncSingleShelfItem(
            client,
            command.payload.shelfId,
            command.payload.itemType,
            command.payload.itemId,
          )
        : undefined,
    [SEARCH_COMMAND_KINDS.shelfItemRemove]: async (command) =>
      "shelfId" in command.payload &&
      "itemType" in command.payload &&
      "itemId" in command.payload
        ? removeShelfItem(
            client,
            command.payload.shelfId,
            command.payload.itemType,
            command.payload.itemId,
          )
        : undefined,
    [SEARCH_COMMAND_KINDS.shelfItemShelfFanout]: async (command, context) =>
      runShelfItemShelfFanoutSegment(command, context, (shelfId, options) =>
        syncShelfItemsByShelfSegment(client, shelfId, options),
      ),
    [SEARCH_COMMAND_KINDS.shelfItemSourceFanout]: async (command, context) =>
      runShelfItemSourceFanoutSegment(
        command,
        context,
        (itemType, itemId, options) =>
          syncShelfItemsBySourceItemSegment(client, itemType, itemId, options),
      ),
    [SEARCH_COMMAND_KINDS.shelfItemFullSync]: async (command, context) =>
      runFullSyncSegment(command, context, {
        deleteAll: () => client.deleteAllShelfItems(),
        syncSegment: (options) => syncShelfItemSegment(client, options),
      }),
  };

  return Object.fromEntries(
    Object.entries(operations).map(([kind, operation]) => [
      kind,
      async (command: AnyJobCommand, context: HandlerContext) =>
        withHandlerMetadata(
          () => operation?.(command as SearchCommand, context),
          {
            index: indexForKind(kind),
          },
        ),
    ]),
  ) as Partial<Record<AnyJobCommand["kind"], JobHandler>>;
}
