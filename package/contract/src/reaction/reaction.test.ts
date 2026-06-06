import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  allowedReactionKindSchema,
  createShareResponseSchema,
  createShareSchema,
  createSchema,
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
      }),
    ).toBe(true);

    expect(
      Value.Check(createSchema, {
        targetId: "unit-1",
        reaction: "heart",
      }),
    ).toBe(false);
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
