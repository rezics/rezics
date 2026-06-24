import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createFeedbackSchema,
  feedbackDTOSchema,
  feedbackListQuerySchema,
} from "./feedback";

describe("feedback contract", () => {
  test("accepts polymorphic targets and addressed units", () => {
    expect(
      Value.Check(createFeedbackSchema, {
        targetKind: "comment",
        targetId: "comment-1",
        addressedUnitId: "post-1",
        content: "This reply needs review",
      }),
    ).toBe(true);
  });

  test("does not declare legacy unitId addressing", () => {
    expect("unitId" in createFeedbackSchema.properties).toBe(false);
    expect("unitId" in feedbackDTOSchema.properties).toBe(false);
    expect("unitId" in feedbackListQuerySchema.properties).toBe(false);
  });

  test("serializes feedback DTO targets in lowercase contract form", () => {
    expect(
      Value.Check(feedbackDTOSchema, {
        id: "feedback-1",
        userId: "user-1",
        targetKind: "feedback",
        targetId: "feedback-parent",
        addressedUnitId: null,
        url: null,
        content: "Follow-up",
        type: "REPORT",
        resolved: false,
        resolvedAt: null,
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("filters by polymorphic target fields", () => {
    expect(
      Value.Check(feedbackListQuerySchema, {
        targetKind: "unit",
        targetId: "unit-1",
        addressedUnitId: "unit-1",
        limit: 20,
      }),
    ).toBe(true);
  });
});
