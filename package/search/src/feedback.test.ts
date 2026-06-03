import { describe, expect, test } from "bun:test";
import { buildFeedbackSearchDocument } from "./sync";

describe("feedback search sync", () => {
  test("buildFeedbackSearchDocument projects polymorphic targets", () => {
    const doc = buildFeedbackSearchDocument({
      id: "feedback-1",
      userId: "user-1",
      targetKind: "COMMENT",
      targetId: "comment-1",
      addressedUnitId: "post-1",
      url: null,
      content: "Report body",
      type: "REPORT",
      resolved: false,
      resolvedAt: null,
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
      updatedAt: new Date("2026-06-03T00:00:00.000Z"),
    });

    expect(doc).toEqual({
      id: "feedback-1",
      userId: "user-1",
      targetKind: "comment",
      targetId: "comment-1",
      addressedUnitId: "post-1",
      url: null,
      content: "Report body",
      type: "REPORT",
      resolved: false,
      resolvedAt: null,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    });
    expect("unitId" in doc).toBe(false);
  });
});
