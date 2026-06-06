import {
  type AnyJobCommand,
  createSearchCommand,
  MAINTENANCE_COMMAND_KINDS,
  type MaintenanceCommand,
  SEARCH_COMMAND_KINDS,
} from "@rezics/job";
import type { HandlerContext, JobHandler } from "../../worker";
import type { ServerMaintenanceRuntime } from "./runtime";

function searchSyncKindForTarget(targetType: string) {
  switch (targetType) {
    case "content":
      return SEARCH_COMMAND_KINDS.contentSync;
    case "post":
      return SEARCH_COMMAND_KINDS.postSync;
    case "comment":
      return SEARCH_COMMAND_KINDS.commentSync;
    case "poll":
      return SEARCH_COMMAND_KINDS.pollSync;
    case "realm":
      return SEARCH_COMMAND_KINDS.realmSync;
    case "entity":
      return SEARCH_COMMAND_KINDS.entitySync;
    case "user":
      return SEARCH_COMMAND_KINDS.userSync;
    case "feedback":
      return SEARCH_COMMAND_KINDS.feedbackSync;
    default:
      return undefined;
  }
}

function fullSyncKindForIndex(index: string) {
  switch (index) {
    case "content":
      return SEARCH_COMMAND_KINDS.contentFullSync;
    case "post":
      return SEARCH_COMMAND_KINDS.postFullSync;
    case "comment":
      return SEARCH_COMMAND_KINDS.commentFullSync;
    case "poll":
      return SEARCH_COMMAND_KINDS.pollFullSync;
    case "realm":
      return SEARCH_COMMAND_KINDS.realmFullSync;
    case "entity":
      return SEARCH_COMMAND_KINDS.entityFullSync;
    case "user":
      return SEARCH_COMMAND_KINDS.userFullSync;
    case "feedback":
      return SEARCH_COMMAND_KINDS.feedbackFullSync;
    case "progress":
      return SEARCH_COMMAND_KINDS.progressFullSync;
    case "shelf-item":
      return SEARCH_COMMAND_KINDS.shelfItemFullSync;
    default:
      return undefined;
  }
}

function targetPayload(targetType: string, targetId: string) {
  if (targetType === "post") return { postId: targetId };
  if (targetType === "comment") return { commentId: targetId };
  if (targetType === "user") return { userId: targetId };
  if (targetType === "feedback") return { feedbackId: targetId };
  return { unitId: targetId };
}

async function enqueueSearchRepair(
  command: MaintenanceCommand,
  context: HandlerContext,
  targetType: string,
  targetId: string,
) {
  if (targetType === "progress") {
    const [userId, unitId] = targetId.split(":");
    if (userId && unitId) {
      await context.enqueue(
        createSearchCommand(
          SEARCH_COMMAND_KINDS.progressSync,
          { userId, unitId },
          command.source,
        ),
      );
      return 1;
    }
    return 0;
  }

  const kind = searchSyncKindForTarget(targetType);
  if (!kind) return 0;
  await context.enqueue(
    createSearchCommand(
      kind,
      targetPayload(targetType, targetId),
      command.source,
    ),
  );
  return 1;
}

function replayTargetFromKey(scope: string, key: string) {
  const [head, ...tail] = key.split(":");
  const id = tail.join(":");
  if (!head || !id) return undefined;

  if (scope === "target") {
    return { targetType: head, targetId: id };
  }

  switch (head) {
    case "Unit":
    case "unit":
      return { targetType: "content", targetId: id };
    case "Post":
    case "post":
      return { targetType: "post", targetId: id };
    case "Comment":
    case "comment":
      return { targetType: "comment", targetId: id };
    case "Realm":
    case "realm":
      return { targetType: "realm", targetId: id };
    case "Entity":
    case "entity":
      return { targetType: "entity", targetId: id };
    case "User":
    case "user":
      return { targetType: "user", targetId: id };
    case "Feedback":
    case "feedback":
      return { targetType: "feedback", targetId: id };
    case "UserUnitProgress":
    case "userUnitProgress":
    case "progress":
      return { targetType: "progress", targetId: id };
    default:
      return undefined;
  }
}

export function createMaintenanceHandlers(
  options: { serverMaintenanceRuntime?: ServerMaintenanceRuntime } = {},
) {
  return {
    [MAINTENANCE_COMMAND_KINDS.searchDriftRepair]: async (command, context) => {
      const maintenance = command as MaintenanceCommand;
      if (!("targetType" in maintenance.payload)) return;
      const enqueued = await enqueueSearchRepair(
        maintenance,
        context,
        maintenance.payload.targetType,
        maintenance.payload.targetId,
      );
      return { enqueued };
    },
    [MAINTENANCE_COMMAND_KINDS.searchRebuildIndex]: async (
      command,
      context,
    ) => {
      const maintenance = command as MaintenanceCommand;
      if (!("index" in maintenance.payload)) return;
      const kind = fullSyncKindForIndex(maintenance.payload.index);
      if (!kind) return { enqueued: 0 };
      await context.enqueue(
        createSearchCommand(
          kind,
          {
            cursor: maintenance.payload.cursor,
            limit: maintenance.payload.limit,
          },
          maintenance.source,
        ),
      );
      return { enqueued: 1 };
    },
    [MAINTENANCE_COMMAND_KINDS.seriesContentIndexRepair]: async (command) => {
      const maintenance = command as MaintenanceCommand;
      if (!("seriesUnitId" in maintenance.payload)) return;
      const repository = options.serverMaintenanceRuntime?.maintenance;
      if (!repository) {
        throw new Error("Server maintenance runtime is not configured");
      }
      return repository.repairSeriesContentIndex(
        maintenance.payload.seriesUnitId,
      );
    },
    [MAINTENANCE_COMMAND_KINDS.replay]: async (command, context) => {
      const maintenance = command as MaintenanceCommand;
      if (!("scope" in maintenance.payload)) return { enqueued: 0 };
      const target = replayTargetFromKey(
        maintenance.payload.scope,
        maintenance.payload.key,
      );
      if (!target) return { enqueued: 0, mode: "current-state" };
      const enqueued = await enqueueSearchRepair(
        maintenance,
        context,
        target.targetType,
        target.targetId,
      );
      return { enqueued, mode: "current-state" };
    },
    [MAINTENANCE_COMMAND_KINDS.fanoutContinuation]: async (
      command,
      _context,
    ) => {
      const maintenance = command as MaintenanceCommand;
      if (!("fanout" in maintenance.payload)) return { status: "accepted" };
      return { status: "accepted" };
    },
  } satisfies Partial<Record<AnyJobCommand["kind"], JobHandler>>;
}
