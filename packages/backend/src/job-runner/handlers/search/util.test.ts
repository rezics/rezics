import { describe, expect, test } from "bun:test";
import {
  extractMeiliTaskMetadata,
  isRetryableError,
  withHandlerMetadata,
} from "./util";

describe("search handler utilities", () => {
  test("captures Meili task metadata from handler output", async () => {
    await expect(
      withHandlerMetadata(async () => ({ taskUid: 42 }), { index: "content" }),
    ).resolves.toEqual({
      meiliTasks: [{ taskUid: 42, index: "content" }],
      result: { taskUid: 42 },
    });
  });

  test("extracts task metadata from arrays", () => {
    expect(
      extractMeiliTaskMetadata([{ taskUid: 1 }, { ignored: true }], "posts"),
    ).toEqual([{ taskUid: 1, index: "posts" }]);
  });

  test("classifies retryable transient errors", () => {
    expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryableError({ code: "validation_failed" })).toBe(false);
  });
});
