import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  createPostSchema,
  acceptAnswerSchema,
  pinCommentSchema,
  postDTOSchema,
  commentPromotionDTOSchema,
  postListQuerySchema,
  postListBodySchema,
  excerptSourceSchema,
  submitPostToRealmSchema,
} from "./post";
import { markdownContentDoc } from "../content/doc-v1";

describe("excerptSourceSchema", () => {
  test("unit mode passes", () => {
    const v = { mode: "unit", unitId: "u1", title: "A chapter" };
    expect(Value.Check(excerptSourceSchema, v)).toBe(true);
  });

  test("url mode passes", () => {
    const v = {
      mode: "url",
      url: "https://example.com/article",
      title: "External source",
    };
    expect(Value.Check(excerptSourceSchema, v)).toBe(true);
  });

  test("unit mode without unitId fails", () => {
    const v = { mode: "unit", title: "missing unitId" };
    expect(Value.Check(excerptSourceSchema, v)).toBe(false);
  });

  test("url mode without url fails", () => {
    const v = { mode: "url", title: "missing url" };
    expect(Value.Check(excerptSourceSchema, v)).toBe(false);
  });

  test("empty title fails (minLength 1)", () => {
    const v = { mode: "unit", unitId: "u1", title: "" };
    expect(Value.Check(excerptSourceSchema, v)).toBe(false);
  });

  test("title over 200 chars fails", () => {
    const v = { mode: "unit", unitId: "u1", title: "x".repeat(201) };
    expect(Value.Check(excerptSourceSchema, v)).toBe(false);
  });

  test("url over 2048 chars fails", () => {
    const v = {
      mode: "url",
      url: `https://example.com/${"x".repeat(2100)}`,
      title: "long url",
    };
    expect(Value.Check(excerptSourceSchema, v)).toBe(false);
  });

  test("unknown mode fails", () => {
    const v = { mode: "bogus", title: "x" };
    expect(Value.Check(excerptSourceSchema, v)).toBe(false);
  });
});

describe("post work-domain contract fields", () => {
  test("does not expose comment topology on PostDTO", () => {
    expect("rootPostUnitId" in postDTOSchema.properties).toBe(false);
    expect("parentPostUnitId" in postDTOSchema.properties).toBe(false);
    expect("depth" in postDTOSchema.properties).toBe(false);
    expect("path" in postDTOSchema.properties).toBe(false);
  });

  test("does not expose work-domain DTO metadata", () => {
    expect("workUnitIds" in postDTOSchema.properties).toBe(false);
    expect("workRoles" in postDTOSchema.properties).toBe(false);
  });

  test("does not expose work-domain list filters", () => {
    expect("workUnitId" in postListQuerySchema.properties).toBe(false);
    expect("workRoles" in postListQuerySchema.properties).toBe(false);
    expect("rootPostUnitId" in postListQuerySchema.properties).toBe(false);
    expect("parentPostUnitId" in postListQuerySchema.properties).toBe(false);
    expect("subtreeRootPostUnitId" in postListQuerySchema.properties).toBe(
      false,
    );
    expect("mode" in postListQuerySchema.properties).toBe(false);
    expect("maxDepth" in postListQuerySchema.properties).toBe(false);

    expect(
      Value.Check(postListQuerySchema, {
        realmUnitId: "realm-1",
        realmLifecycleState: "quarantined",
        limit: 20,
      }),
    ).toBe(false);
  });

  test("does not accept comment topology on post creation", () => {
    expect("parentPostUnitId" in createPostSchema.properties).toBe(false);
  });

  test("accepts weak variant context separately from target aggregation", () => {
    expect(
      Value.Check(createPostSchema, {
        targetUnitId: "main-1",
        variantUnitId: "variant-1",
        language: "en",
        title: "Resolved post title",
        content: markdownContentDoc("body"),
      }),
    ).toBe(true);
    expect(
      Value.Check(postDTOSchema, {
        unitId: "post-1",
        authorUserId: "user-1",
        targetUnitId: "main-1",
        variantUnitId: "variant-1",
        title: "Resolved post title",
        variantContext: {
          unitId: "variant-1",
          title: "Selected Edition",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(postListQuerySchema, {
        targetUnitId: "main-1",
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(postListBodySchema, {
        targetUnitId: "main-1",
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("create title is the root-post display title, not extra.title", () => {
    expect(
      Value.Check(createPostSchema, {
        language: "en",
        title: "Display title",
        content: markdownContentDoc("body"),
        extra: { title: "legacy import title" },
      }),
    ).toBe(true);
    expect(
      Value.Check(createPostSchema, {
        language: "en",
        title: "",
        content: markdownContentDoc("body"),
      }),
    ).toBe(false);
    expect(
      Value.Check(createPostSchema, {
        title: "Display title",
        content: markdownContentDoc("body"),
      }),
    ).toBe(false);
    expect(
      Value.Check(createPostSchema, {
        language: "en",
        content: markdownContentDoc("body"),
      }),
    ).toBe(false);
  });

  test("member realm submission names the author intent explicitly", () => {
    expect(
      Value.Check(submitPostToRealmSchema, {
        realmUnitId: "realm-1",
        tagIds: ["tag-1"],
        publish: true,
      }),
    ).toBe(true);
    expect("unitId" in submitPostToRealmSchema.properties).toBe(false);
    expect("realmUnitIds" in submitPostToRealmSchema.properties).toBe(false);
  });

  test("uses comment endpoint naming for promotion contracts", () => {
    expect("commentUnitId" in commentPromotionDTOSchema.properties).toBe(true);
    expect("postUnitId" in commentPromotionDTOSchema.properties).toBe(false);
    expect("commentUnitId" in pinCommentSchema.properties).toBe(true);
    expect("postUnitId" in pinCommentSchema.properties).toBe(false);
    expect("beforeTargetUnitId" in acceptAnswerSchema.properties).toBe(true);
    expect("beforePostUnitId" in acceptAnswerSchema.properties).toBe(false);
  });
});

describe("postExtraSchema poll reference", () => {
  test("post round-trips extra.poll.unitId", () => {
    const post = {
      unitId: "post-1",
      authorUserId: "user-1",
      content: null,
      extra: { poll: { unitId: "poll-unit-1" } },
    };
    expect(Value.Check(postDTOSchema, post)).toBe(true);
    const decoded = Value.Decode(
      postDTOSchema,
      Value.Clean(postDTOSchema, post),
    );
    expect(decoded.extra?.poll?.unitId).toBe("poll-unit-1");
  });

  test("extra without a poll field still validates", () => {
    const post = {
      unitId: "post-1",
      authorUserId: "user-1",
      content: null,
      extra: { rating: 5 },
    };
    expect(Value.Check(postDTOSchema, post)).toBe(true);
  });

  test("poll reference missing unitId fails", () => {
    const post = {
      unitId: "post-1",
      authorUserId: "user-1",
      content: null,
      extra: { poll: {} },
    };
    expect(Value.Check(postDTOSchema, post)).toBe(false);
  });
});
