import { describe, expect, test } from "bun:test";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { normalizeEnqueueResult } from "./enqueue";
import { queueOptionsForCommand } from "./policy";

describe("queue enqueue policy", () => {
  test("adds singleton debounce options for slow search commands", () => {
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });

    expect(queueOptionsForCommand(command)).toMatchObject({
      policy: "short",
      singletonKey: "search.content.patchTags:unit-1",
      singletonSeconds: 300,
    });
  });

  test("treats null job id as coalesced success", () => {
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });

    const result = normalizeEnqueueResult(command, null);

    expect(result).toMatchObject({ status: "coalesced" });
    expect(result).not.toHaveProperty("jobId");
  });
});
