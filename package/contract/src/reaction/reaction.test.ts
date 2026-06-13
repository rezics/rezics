import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  allowedReactionKindSchema,
  createSchema,
  createShareResponseSchema,
  createShareSchema,
  knownReactionKindSchema,
  shareSummaryResponseSchema,
} from "./reaction.schema";

describe("reaction contract", () => {
  test("allows only currently writable reaction kinds", () => {
    expect(Value.Check(allowedReactionKindSchema, "upvote")).toBe(true);
    expect(Value.Check(allowedReactionKindSchema, "downvote")).toBe(true);
    expect(Value.Check(allowedReactionKindSchema, "heart")).toBe(false);
  });

  test("tracks known future reaction vocabulary separately", () => {
    for (const reaction of ["upvote", "downvote", "heart", "funny", "award"]) {
      expect(Value.Check(knownReactionKindSchema, reaction)).toBe(true);
    }

    for (const reaction of ["bookmark", "star", "insightful", "reply"]) {
      expect(Value.Check(knownReactionKindSchema, reaction)).toBe(false);
    }
  });

  test("uses the writable allowlist for reaction creation", () => {
    expect(
      Value.Check(createSchema, {
        targetId: "unit-1",
        reaction: "upvote",
        contextUnitId: null,
      }),
    ).toBe(true);

    expect(
      Value.Check(createSchema, {
        targetId: "unit-1",
        reaction: "heart",
      }),
    ).toBe(false);
  });

  test("uses nullable contextUnitId instead of scopeKey", () => {
    expect(
      Value.Check(createSchema, {
        targetId: "comment-1",
        reaction: "upvote",
        contextUnitId: "realm-1",
      }),
    ).toBe(true);
    expect("scopeKey" in createSchema.properties).toBe(false);
  });

  test("share schemas use singular shareCount fields", () => {
    expect(Value.Check(createShareSchema, { targetId: "unit-1" })).toBe(true);
    expect(
      Value.Check(createShareResponseSchema, {
        targetId: "unit-1",
        shareCount: 1,
        created: true,
      }),
    ).toBe(true);
    expect(
      Value.Check(shareSummaryResponseSchema, {
        summaries: {
          "unit-1": { shareCount: 2 },
        },
      }),
    ).toBe(true);
  });
});
