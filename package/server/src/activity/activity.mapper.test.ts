import { describe, expect, it } from "bun:test";
import type { ActivityItem } from "@rezics/contract";
import {
  extractExtraTitle,
  mergeActivity,
  postActivityHref,
  postActivityKind,
  shelfActivityHref,
} from "./activity.mapper";

describe("postActivityKind", () => {
  it("maps review/remark and defaults the rest to post", () => {
    expect(postActivityKind("REVIEW")).toBe("review");
    expect(postActivityKind("REMARK")).toBe("remark");
    expect(postActivityKind("POST")).toBe("post");
    expect(postActivityKind("WIKI")).toBe("post");
    expect(postActivityKind(null)).toBe("post");
  });
});

describe("hrefs", () => {
  it("routes each post kind to its detail page", () => {
    expect(postActivityHref("review", "u1")).toBe("/review/u1");
    expect(postActivityHref("remark", "u1")).toBe("/remark/u1");
    expect(postActivityHref("post", "u1")).toBe("/post/u1");
    expect(shelfActivityHref("s1")).toBe("/shelf/s1");
  });
});

describe("extractExtraTitle", () => {
  it("reads a non-empty string title, else undefined", () => {
    expect(extractExtraTitle({ title: "Hi" })).toBe("Hi");
    expect(extractExtraTitle({ title: "  " })).toBeUndefined();
    expect(extractExtraTitle({ title: 42 })).toBeUndefined();
    expect(extractExtraTitle(null)).toBeUndefined();
    expect(extractExtraTitle("nope")).toBeUndefined();
  });
});

describe("mergeActivity", () => {
  const item = (id: string, at: string): ActivityItem => ({
    id,
    kind: "post",
    title: id,
    href: `/post/${id}`,
    at,
  });

  it("orders by time descending and tie-breaks by id", () => {
    const merged = mergeActivity(
      [
        item("a", "2026-05-01T00:00:00.000Z"),
        item("c", "2026-05-03T00:00:00.000Z"),
        item("b", "2026-05-02T00:00:00.000Z"),
      ],
      10,
    );
    expect(merged.items.map((i) => i.id)).toEqual(["c", "b", "a"]);
    expect(merged.nextCursor).toBeNull();
  });

  it("caps to limit and returns the last item's timestamp as the cursor", () => {
    const merged = mergeActivity(
      [
        item("a", "2026-05-01T00:00:00.000Z"),
        item("b", "2026-05-02T00:00:00.000Z"),
        item("c", "2026-05-03T00:00:00.000Z"),
      ],
      2,
    );
    expect(merged.items.map((i) => i.id)).toEqual(["c", "b"]);
    expect(merged.nextCursor).toBe("2026-05-02T00:00:00.000Z");
  });
});
