import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { markdownContentDoc } from "./content-doc-v1";
import { postListResponseSchema } from "./post";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";
import { userDTOSchema } from "./user";

describe("rich description DTO contracts", () => {
  test("public and full users reject raw string descriptions", () => {
    expect(
      Value.Check(publicUserSchema, {
        unitId: "user-1",
        description: "raw markdown",
      }),
    ).toBe(false);
    expect(
      Value.Check(userDTOSchema, {
        unitId: "user-1",
        description: "raw markdown",
      }),
    ).toBe(false);
  });

  test("public and full users accept ContentDoc and null descriptions", () => {
    const doc = markdownContentDoc("seeded user profile");

    expect(
      Value.Check(publicUserSchema, { unitId: "user-1", description: doc }),
    ).toBe(true);
    expect(
      Value.Check(publicUserSchema, { unitId: "user-1", description: null }),
    ).toBe(true);
    expect(
      Value.Check(userDTOSchema, { unitId: "user-1", description: doc }),
    ).toBe(true);
    expect(
      Value.Check(userDTOSchema, { unitId: "user-1", description: null }),
    ).toBe(true);
  });

  test("unit translations reject raw strings and accept ContentDoc", () => {
    const base = {
      unitId: "unit-1",
      language: "en",
      title: "Title",
    };

    expect(
      Value.Check(unitTranslationDTOSchema, {
        ...base,
        description: "raw markdown",
      }),
    ).toBe(false);
    expect(
      Value.Check(unitTranslationDTOSchema, {
        ...base,
        description: markdownContentDoc("translation description"),
      }),
    ).toBe(true);
    expect(
      Value.Check(unitTranslationDTOSchema, { ...base, description: null }),
    ).toBe(true);
  });

  test("post list author descriptions validate as ContentDoc", () => {
    expect(
      Value.Check(postListResponseSchema, {
        posts: [
          {
            unitId: "post-1",
            authorUserId: "user-1",
            author: {
              unitId: "user-1",
              description: markdownContentDoc("seeded author profile"),
            },
            content: markdownContentDoc("post body"),
            kind: "POST",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            depth: 0,
            replyCount: 0,
            directReplyCount: 0,
            isLocked: false,
            createdAt: "2026-05-24T00:00:00.000Z",
            updatedAt: "2026-05-24T00:00:00.000Z",
          },
        ],
        total: 1,
      }),
    ).toBe(true);
  });
});
