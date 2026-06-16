import { describe, expect, test } from "bun:test";
import { OFFICIAL_ISSUE_TAG_SLUG } from "../tag/seed-tags";
import { OFFICIAL_QUESTION_TAG_SLUG } from "./post";
import {
  activeSlugs,
  allBucketSlugs,
  closedSlugs,
  getStateSchema,
  isLegalStateValue,
  isLegalTransition,
  isStatefulTagSlug,
  normalizeStateSlug,
  POST_STATE_SCHEMAS,
  resolveValueTagSlug,
} from "./state-schema";

describe("post state schema registry", () => {
  test("question schema: initial open, expected values and buckets", () => {
    const schema = getStateSchema(OFFICIAL_QUESTION_TAG_SLUG);
    expect(schema).toBeDefined();
    expect(schema?.initial).toBe("open");
    expect(activeSlugs(schema!)).toEqual(["open"]);
    expect(closedSlugs(schema!).sort()).toEqual(
      ["duplicate", "not-planned", "off-topic", "solved"].sort(),
    );
  });

  test("issue schema: initial open, completed/not-planned/duplicate closed", () => {
    const schema = getStateSchema(OFFICIAL_ISSUE_TAG_SLUG);
    expect(schema?.initial).toBe("open");
    expect(activeSlugs(schema!)).toEqual(["open"]);
    expect(closedSlugs(schema!).sort()).toEqual(
      ["completed", "duplicate", "not-planned"].sort(),
    );
  });

  test("isStatefulTagSlug recognizes registered tags only", () => {
    expect(isStatefulTagSlug(OFFICIAL_QUESTION_TAG_SLUG)).toBe(true);
    expect(isStatefulTagSlug(OFFICIAL_ISSUE_TAG_SLUG)).toBe(true);
    expect(isStatefulTagSlug("book")).toBe(false);
  });

  test("there is no bare `closed` value (closing requires a reason)", () => {
    for (const schema of Object.values(POST_STATE_SCHEMAS)) {
      expect(isLegalStateValue(schema, "closed")).toBe(false);
    }
  });

  test("write-strict: illegal values and disallowed transitions are rejected", () => {
    const schema = getStateSchema(OFFICIAL_QUESTION_TAG_SLUG)!;
    // Unknown value.
    // 未知值。
    expect(isLegalStateValue(schema, "banana")).toBe(false);
    // open → solved is allowed; closed → closed (solved → duplicate) is not.
    // open → solved 允许；closed → closed（solved → duplicate）不允许。
    expect(isLegalTransition(schema, "open", "solved")).toBe(true);
    expect(isLegalTransition(schema, "solved", "duplicate")).toBe(false);
    // Reopen: any closed reason → initial open.
    // 重新打开：任意关闭原因 → 初始的 open。
    expect(isLegalTransition(schema, "not-planned", "open")).toBe(true);
    expect(isLegalTransition(schema, "duplicate", "open")).toBe(true);
  });

  test("active/closed buckets are derived as a union across schemas", () => {
    expect(allBucketSlugs("active")).toEqual(["open"]);
    const closed = allBucketSlugs("closed").sort();
    expect(closed).toEqual(
      ["completed", "duplicate", "not-planned", "off-topic", "solved"].sort(),
    );
  });

  test("a value renders via its mapped tag slug, defaulting to the value slug", () => {
    const schema = getStateSchema(OFFICIAL_QUESTION_TAG_SLUG)!;
    const solved = schema.values.find((value) => value.slug === "solved")!;
    // No tagSlug override → renders through the tag whose slug is the value slug.
    // 没有 tagSlug 覆盖 → 通过 slug 等于该值 slug 的标签来渲染。
    expect(resolveValueTagSlug(solved)).toBe("solved");
    // An explicit override is honored when present.
    // 存在显式覆盖时优先使用该覆盖。
    expect(
      resolveValueTagSlug({ slug: "x", bucket: "closed", tagSlug: "y" }),
    ).toBe("y");
  });

  test("normalizeStateSlug lowercases and maps `_` to `-`", () => {
    expect(normalizeStateSlug("NOT_PLANNED")).toBe("not-planned");
    expect(normalizeStateSlug("  Off_Topic ")).toBe("off-topic");
  });
});
