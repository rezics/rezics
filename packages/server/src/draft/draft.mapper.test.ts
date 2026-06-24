import { describe, expect, test } from "bun:test";
import {
  draftResumeRoute,
  postKindToDraftKind,
  toDraftMetadata,
} from "./draft.mapper";

describe("postKindToDraftKind", () => {
  test("maps draft-eligible kinds", () => {
    expect(postKindToDraftKind("REVIEW")).toBe("review");
    expect(postKindToDraftKind("REMARK")).toBe("remark");
    expect(postKindToDraftKind("WIKI")).toBe("wiki");
    expect(postKindToDraftKind("POST")).toBe("post");
  });

  test("returns null for non-draft kinds", () => {
    expect(postKindToDraftKind("EXCERPT")).toBeNull();
    expect(postKindToDraftKind("CHAPTER")).toBeNull();
    expect(postKindToDraftKind(null)).toBeNull();
  });
});

describe("draftResumeRoute", () => {
  test("routes each kind to its editor surface", () => {
    expect(draftResumeRoute("review", "u1")).toBe("/review/u1");
    expect(draftResumeRoute("remark", "u1")).toBe("/remark/u1");
    expect(draftResumeRoute("post", "u1")).toBe("/post/u1");
    expect(draftResumeRoute("wiki", "u1")).toBe("/post/u1");
    expect(draftResumeRoute("shelf-description", "u1")).toBe("/shelf/u1/edit");
  });
});

describe("toDraftMetadata", () => {
  test("projects a source into unified metadata with resume route", () => {
    expect(
      toDraftMetadata({
        unitId: "u1",
        kind: "review",
        title: "Draft review",
        excerpt: "Some text",
        updatedAt: "2026-05-29T00:00:00.000Z",
        targetUnitId: "book-1",
      }),
    ).toEqual({
      id: "u1",
      kind: "review",
      title: "Draft review",
      excerpt: "Some text",
      updatedAt: "2026-05-29T00:00:00.000Z",
      targetUnitId: "book-1",
      resumeRoute: "/review/u1",
    });
  });

  test("omits excerpt when empty and defaults targetUnitId to null", () => {
    const meta = toDraftMetadata({
      unitId: "u2",
      kind: "post",
      title: "Untitled",
      updatedAt: "2026-05-29T00:00:00.000Z",
    });
    expect(meta.excerpt).toBeUndefined();
    expect(meta.targetUnitId).toBeNull();
    expect(meta.resumeRoute).toBe("/post/u2");
  });
});
