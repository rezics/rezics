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

  test("admin work merge fanout requires the admin runtime", async () => {
    const handlers = createMaintenanceHandlers();
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.fanoutContinuation,
      {
        fanout: "admin-work-merge.execute",
        targetId: "operation-1",
        cursor: "start",
      },
    );

    await expect(
      handlers[command.kind]?.(command, { enqueue: async () => undefined }),
    ).rejects.toThrow("Admin work merge runtime is not configured");
  });

  test("repairs Series direct content index from release member nodes only", async () => {
    const createManyCalls: unknown[] = [];
    const handlers = createMaintenanceHandlers({
      adminWorkMergeRuntime: {
        prisma: {
          series: {
            findUnique: async () => ({ unitId: "series-1" }),
          },
          contentStructureNode: {
            findMany: async () => [
              { id: "node-1", contentUnitId: "release-1" },
            ],
          },
          seriesContentIndex: {
            deleteMany: async () => ({ count: 0 }),
            createMany: async (args: unknown) => {
              createManyCalls.push(args);
              return { count: 1 };
            },
          },
        } as any,
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
    expect(createManyCalls).toEqual([
      {
        data: [
          {
            seriesUnitId: "series-1",
            releaseUnitId: "release-1",
            contentNodeId: "node-1",
          },
        ],
        skipDuplicates: true,
      },
    ]);
  });

  test("repairs Series work projection and enqueues search rebuilds", async () => {
    const enqueued: Array<{ kind: string; payload: unknown }> = [];
    const upserts: unknown[] = [];
    const handlers = createMaintenanceHandlers({
      adminWorkMergeRuntime: {
        prisma: {
          series: {
            findUnique: async () => ({ unitId: "series-1" }),
          },
          contentStructureNode: {
            findMany: async () => [
              {
                contentUnit: {
                  workMemberships: [{ workUnitId: "work-1" }],
                },
              },
            ],
          },
          unitWork: {
            deleteMany: async () => ({ count: 0 }),
            upsert: async (args: unknown) => {
              upserts.push(args);
              return {};
            },
          },
        } as any,
        disconnect: async () => undefined,
      },
    });
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.seriesWorkProjectionRepair,
      { seriesUnitId: "series-1" },
    );

    const result = await handlers[command.kind]?.(command, {
      enqueue: async (next) => {
        enqueued.push({ kind: next.kind, payload: next.payload });
      },
    });

    expect(result).toEqual({
      projectedWorkUnitIds: ["work-1"],
      enqueued: 1,
    });
    expect(upserts).toHaveLength(1);
    expect(enqueued).toEqual([
      { kind: "search.content.sync", payload: { unitId: "series-1" } },
    ]);
  });
});
