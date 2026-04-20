import type { ShelfItemDTO } from "@rezics/contract";
import { describe, expect, test } from "bun:test";
import { titleOf } from "./titleOf";

function makeItem(overrides: Partial<ShelfItemDTO>): ShelfItemDTO {
  return {
    shelfUnitId: "s1",
    itemRef: "ref-1",
    kind: "book",
    position: "a",
    reviewIds: [],
    tagIds: [],
    ...overrides,
  };
}

describe("titleOf", () => {
  test("book with translations returns translation title", () => {
    const item = makeItem({ kind: "book", itemRef: "book-1" });
    const cached = {
      unitId: "book-1",
      translations: [{ language: "en", title: "War and Peace" }],
    };
    expect(titleOf(item, cached)).toBe("War and Peace");
  });

  test("review with extra.title returns extra.title", () => {
    const item = makeItem({ kind: "review", itemRef: "rev-1" });
    const cached = {
      unitId: "rev-1",
      authorUserId: "u1",
      extra: { title: "A great review" },
    };
    expect(titleOf(item, cached)).toBe("A great review");
  });

  test("review with no title falls back to itemRef", () => {
    const item = makeItem({ kind: "review", itemRef: "rev-2" });
    const cached = { unitId: "rev-2", authorUserId: "u1", extra: {} };
    expect(titleOf(item, cached)).toBe("rev-2");
  });

  test("tag with translations returns translation title", () => {
    const item = makeItem({ kind: "tag", itemRef: "tag-1" });
    const cached = {
      unitId: "tag-1",
      translations: [{ language: "en", title: "fantasy" }],
    };
    expect(titleOf(item, cached)).toBe("fantasy");
  });

  test("tag with label only returns label", () => {
    const item = makeItem({ kind: "tag", itemRef: "tag-2" });
    const cached = { unitId: "tag-2", label: "sci-fi", translations: [] };
    expect(titleOf(item, cached)).toBe("sci-fi");
  });

  test("unsupported kind returns itemRef", () => {
    const item = makeItem({ kind: "game", itemRef: "game-1" });
    expect(titleOf(item, undefined)).toBe("game-1");
  });

  test("missing cache returns itemRef", () => {
    const item = makeItem({ kind: "book", itemRef: "book-x" });
    expect(titleOf(item, undefined)).toBe("book-x");
  });
});
