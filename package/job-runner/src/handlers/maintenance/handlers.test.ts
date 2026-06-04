import { describe, expect, test } from "bun:test";
import {
  createMaintenanceCommand,
  MAINTENANCE_COMMAND_KINDS,
} from "@rezics/job";
import { createMaintenanceHandlers } from "./handlers";

describe("maintenance handlers", () => {
  test("drift repair enqueues current-state search sync", async () => {
    const enqueued: string[] = [];
    const handlers = createMaintenanceHandlers();
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.searchDriftRepair,
      { targetType: "content", targetId: "unit-1" },
    );

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push(next.kind);
      },
    });

    expect(enqueued).toEqual(["search.content.sync"]);
  });

  test("rebuild enqueues a bounded full-sync job", async () => {
    const enqueued: Array<{ kind: string; payload: unknown }> = [];
    const handlers = createMaintenanceHandlers();
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.searchRebuildIndex,
      { index: "entity", cursor: "entity-1", limit: 100 },
    );

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push({ kind: next.kind, payload: next.payload });
      },
    });

    expect(enqueued).toEqual([
      {
        kind: "search.entity.fullSync",
        payload: { cursor: "entity-1", limit: 100 },
      },
    ]);
  });

  test.each([
    ["content", "search.content.fullSync"],
    ["post", "search.post.fullSync"],
    ["comment", "search.comment.fullSync"],
    ["poll", "search.poll.fullSync"],
    ["realm", "search.realm.fullSync"],
    ["entity", "search.entity.fullSync"],
    ["user", "search.user.fullSync"],
    ["feedback", "search.feedback.fullSync"],
    ["progress", "search.progress.fullSync"],
    ["collection", "search.collection.fullSync"],
  ] as const)("rebuild maps %s to %s", async (index, expectedKind) => {
    const enqueued: string[] = [];
    const handlers = createMaintenanceHandlers();
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.searchRebuildIndex,
      { index },
    );

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push(next.kind);
      },
    });

    expect(enqueued).toEqual([expectedKind]);
  });

  test("replay by logical target enqueues current-state jobs", async () => {
    const enqueued: string[] = [];
    const handlers = createMaintenanceHandlers();
    const command = createMaintenanceCommand(MAINTENANCE_COMMAND_KINDS.replay, {
      scope: "target",
      key: "user:user-1",
    });

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push(next.kind);
      },
    });

    expect(enqueued).toEqual(["search.user.sync"]);
  });

  test("replay by source metadata maps to current-state repair", async () => {
    const enqueued: Array<{ kind: string; payload: unknown }> = [];
    const handlers = createMaintenanceHandlers();
    const command = createMaintenanceCommand(MAINTENANCE_COMMAND_KINDS.replay, {
      scope: "source",
      key: "UserUnitProgress:user-1:unit-1",
    });

    await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push({ kind: next.kind, payload: next.payload });
      },
    });

    expect(enqueued).toEqual([
      {
        kind: "search.progress.sync",
        payload: { userId: "user-1", unitId: "unit-1" },
      },
    ]);
  });

  test("repairs Series direct content index from release member nodes only", async () => {
    const handlers = createMaintenanceHandlers({
      serverMaintenanceRuntime: {
        maintenance: {
          repairSeriesContentIndex: async (seriesUnitId) => ({
            indexedReleaseCount: seriesUnitId === "series-1" ? 1 : 0,
          }),
        },
        disconnect: async () => undefined,
      },
    });
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.seriesContentIndexRepair,
      { seriesUnitId: "series-1" },
    );

    const result = await handlers[command.kind]?.(command, {
      enqueue: async () => undefined,
    });

    expect(result).toEqual({ indexedReleaseCount: 1 });
  });
});
