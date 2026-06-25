import { describe, expect, mock, test } from "bun:test";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/contract/job";

mock.module("@/env", () => ({
  env: {},
}));

describe("server job producer boundary", () => {
  test("does not require queue database configuration", async () => {
    const { createServerJobProducer } = await import("./job-boundary");
    const producer = createServerJobProducer({});
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentSync, {
      unitId: "unit-1",
    });

    await expect(producer.enqueue(command)).rejects.toThrow(
      "Job runner is not configured",
    );
  });
});
