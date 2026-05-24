import {
  SEARCH_COMMAND_KINDS,
  type AnyJobCommand,
  type SearchCommand,
} from "@rezics/job";
import {
  patchContentAliases,
  patchContentContainedUnitIds,
  patchContentCredits,
  patchContentMetadata,
  patchContentRealmIds,
  patchContentRealmTagKeys,
  patchContentSubjects,
  patchContentTags,
  patchContentTranslations,
  patchEntityAliases,
  patchFeedbackResolution,
  patchPostFields,
  patchPostsTarget,
  patchRealmAliases,
  patchRealmMemberCount,
  patchRealmMetadata,
  patchRealmTranslations,
  patchUserFields,
  removeProgress,
  syncAllContent,
  syncAllEntities,
  syncAllFeedbacks,
  syncAllPosts,
  syncAllPostRealmIds,
  syncAllPostRootTargets,
  syncAllRealms,
  syncAllUsers,
  syncPostsByAuthor,
  syncSingleContent,
  syncSingleEntity,
  syncSingleFeedback,
  syncSinglePost,
  syncSingleProgress,
  syncSingleRealm,
  syncSingleUser,
  type SearchClient,
} from "@rezics/search";
import type { JobHandler } from "../../worker";

type SearchOperations = Partial<
  Record<SearchCommand["kind"], (command: SearchCommand) => Promise<unknown>>
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
    [SEARCH_COMMAND_KINDS.contentFullSync]: async () => syncAllContent(client),

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
    [SEARCH_COMMAND_KINDS.postPatchAuthorFanout]: async (command) =>
      syncPostsByAuthor(client, targetIdFrom(command.payload) ?? ""),
    [SEARCH_COMMAND_KINDS.postPatchTargetFanout]: async (command) =>
      patchPostsTarget(client, targetIdFrom(command.payload) ?? ""),
    [SEARCH_COMMAND_KINDS.postPatchRealmIds]: async () =>
      syncAllPostRealmIds(client),
    [SEARCH_COMMAND_KINDS.postRepairRootTarget]: async () =>
      syncAllPostRootTargets(client),
    [SEARCH_COMMAND_KINDS.postFullSync]: async () => syncAllPosts(client),

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
      patchRealmMemberCount(client, targetIdFrom(command.payload) ?? "", 0),
    [SEARCH_COMMAND_KINDS.realmFullSync]: async () => syncAllRealms(client),

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
    [SEARCH_COMMAND_KINDS.entityFullSync]: async () => syncAllEntities(client),

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
    [SEARCH_COMMAND_KINDS.userPostsAuthorFanout]: async (command) =>
      syncPostsByAuthor(client, targetIdFrom(command.payload) ?? ""),
    [SEARCH_COMMAND_KINDS.userFullSync]: async () => syncAllUsers(client),

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
        ? patchFeedbackResolution(client, command.payload.feedbackId, {})
        : undefined,
    [SEARCH_COMMAND_KINDS.feedbackFullSync]: async () =>
      syncAllFeedbacks(client),

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
  };

  return Object.fromEntries(
    Object.entries(operations).map(([kind, operation]) => [
      kind,
      async (command: AnyJobCommand) => operation?.(command as SearchCommand),
    ]),
  ) as Partial<Record<AnyJobCommand["kind"], JobHandler>>;
}
