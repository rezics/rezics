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
});
