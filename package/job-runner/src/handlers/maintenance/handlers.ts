import {
  createSearchCommand,
  MAINTENANCE_COMMAND_KINDS,
  SEARCH_COMMAND_KINDS,
  type AnyJobCommand,
  type MaintenanceCommand,
} from "@rezics/job";
import type { JobHandler } from "../../worker";

function searchSyncKindForTarget(targetType: string) {
  switch (targetType) {
    case "content":
      return SEARCH_COMMAND_KINDS.contentSync;
    case "post":
      return SEARCH_COMMAND_KINDS.postSync;
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
    default:
      return undefined;
  }
}

function targetPayload(targetType: string, targetId: string) {
  if (targetType === "post") return { postId: targetId };
  if (targetType === "user") return { userId: targetId };
  if (targetType === "feedback") return { feedbackId: targetId };
  return { unitId: targetId };
}

export function createMaintenanceHandlers() {
  return {
    [MAINTENANCE_COMMAND_KINDS.searchDriftRepair]: async (command, context) => {
      const maintenance = command as MaintenanceCommand;
      if (!("targetType" in maintenance.payload)) return;
      if (maintenance.payload.targetType === "progress") {
        const [userId, unitId] = maintenance.payload.targetId.split(":");
        if (userId && unitId) {
          await context.enqueue(
            createSearchCommand(
              SEARCH_COMMAND_KINDS.progressSync,
              { userId, unitId },
              maintenance.source,
            ),
          );
        }
        return { enqueued: 1 };
      }
      const kind = searchSyncKindForTarget(maintenance.payload.targetType);
      if (!kind) return { enqueued: 0 };
      await context.enqueue(
        createSearchCommand(
          kind,
          targetPayload(
            maintenance.payload.targetType,
            maintenance.payload.targetId,
          ),
          maintenance.source,
        ),
      );
      return { enqueued: 1 };
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
    [MAINTENANCE_COMMAND_KINDS.replay]: async () => {
      return { status: "accepted", mode: "current-state" };
    },
    [MAINTENANCE_COMMAND_KINDS.fanoutContinuation]: async () => {
      return { status: "accepted" };
    },
  } satisfies Partial<Record<AnyJobCommand["kind"], JobHandler>>;
}
