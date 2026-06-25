import { describe, expect, test } from "bun:test";
import { JOB_LANE_VALUES } from "@rezics/contract/job";
import { createQueues, DEAD_LETTER_LANES } from "./create-queues";
import { LANE_POLICIES } from "./policy";
import type { QueueSendOptions } from "./types";

describe("queue initialization", () => {
  test("creates dead-letter lanes before lanes that reference them", async () => {
    const calls: Array<{
      method: "createQueue" | "updateQueue";
      name: string;
      options?: QueueSendOptions;
    }> = [];

    await createQueues({
      async createQueue(name, options) {
        calls.push({ method: "createQueue", name, options });
      },
      async updateQueue(name, options) {
        calls.push({ method: "updateQueue", name, options });
      },
      async send() {
        return "job-1";
      },
    });

    expect(calls.slice(0, DEAD_LETTER_LANES.length)).toEqual(
      DEAD_LETTER_LANES.map((name) => ({ method: "createQueue", name })),
    );

    for (const lane of JOB_LANE_VALUES) {
      const policy = LANE_POLICIES[lane];

      expect(calls).toContainEqual({
        method: "createQueue",
        name: lane,
        options: policy,
      });
      expect(calls).toContainEqual({
        method: "updateQueue",
        name: lane,
        options: policy,
      });
    }
  });
});
