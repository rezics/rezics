import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  postDTOSchema,
  postListQuerySchema,
  excerptSourceSchema,
} from "./post";

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
  test("does not expose work-domain DTO metadata", () => {
    expect("workUnitIds" in postDTOSchema.properties).toBe(false);
    expect("workRoles" in postDTOSchema.properties).toBe(false);
  });

  test("does not expose work-domain list filters", () => {
    expect("workUnitId" in postListQuerySchema.properties).toBe(false);
    expect("workRoles" in postListQuerySchema.properties).toBe(false);

    expect(
      Value.Check(postListQuerySchema, {
        realmUnitId: "realm-1",
        realmLifecycleState: "quarantined",
        limit: 20,
      }),
    ).toBe(false);
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
