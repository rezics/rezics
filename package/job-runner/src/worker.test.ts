import { describe, expect, test } from "bun:test";
import {
  createSearchCommand,
  JOB_LANE_VALUES,
  SEARCH_COMMAND_KINDS,
} from "@rezics/job";
import { registerWorkers } from "./worker";
import type { WorkerQueueLike } from "./queue/types";

describe("worker dispatch", () => {
  test("registers a worker for every lane and dispatches by command kind", async () => {
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });
    const worked: string[] = [];
    const queue: WorkerQueueLike = {
      async createQueue() {},
      async send() {
        return "job-2";
      },
      async stop() {},
      async work(name, handler) {
        worked.push(name);
        if (name === command.lane)
          await handler({ id: "job-1", data: command });
      },
    };
    let handled = false;

    await registerWorkers(queue, {
      [command.kind]: async () => {
        handled = true;
      },
    });

    expect(worked).toEqual(JOB_LANE_VALUES);
    expect(handled).toBe(true);
  });

  test("fails unknown commands with actionable error", async () => {
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });
    const queue: WorkerQueueLike = {
      async createQueue() {},
      async send() {
        return "job-2";
      },
      async stop() {},
      async work(name, handler) {
        if (name === command.lane) {
          await expect(handler({ id: "job-1", data: command })).rejects.toThrow(
            "No job handler registered",
          );
        }
      },
    };

    await registerWorkers(queue, {});
  });
});
