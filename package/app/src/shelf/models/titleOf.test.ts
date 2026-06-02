import { describe, expect, test } from "bun:test";
import type { ShelfUnitDTO } from "@rezics/contract";
import { titleOf } from "./titleOf";

function makeUnit(overrides: Partial<ShelfUnitDTO>): ShelfUnitDTO {
  return {
    shelfId: "s1",
    unitId: "ref-1",
    kind: "book",
    position: "a",
    ...overrides,
  };
}

describe("titleOf", () => {
  test("book with translations returns translation title", () => {
    const unit = makeUnit({ kind: "book", unitId: "book-1" });
    const cached = {
      unitId: "book-1",
      translations: [{ language: "en", title: "War and Peace" }],
    };
    expect(titleOf(unit, cached)).toBe("War and Peace");
  });

  test("review with resolved title returns title", () => {
    const unit = makeUnit({ kind: "review", unitId: "rev-1" });
    const cached = {
      unitId: "rev-1",
      authorUserId: "u1",
      title: "A great review",
      extra: { title: "Legacy title" },
    };
    expect(titleOf(unit, cached)).toBe("A great review");
  });

  test("review ignores repair-only extra.title and falls back to unitId", () => {
    const unit = makeUnit({ kind: "review", unitId: "rev-2" });
    const cached = {
      unitId: "rev-2",
      authorUserId: "u1",
      extra: { title: "Legacy title" },
    };
    expect(titleOf(unit, cached)).toBe("rev-2");
  });

  test("tag with translations returns translation title", () => {
    const unit = makeUnit({ kind: "tag", unitId: "tag-1" });
    const cached = {
      unitId: "tag-1",
      translations: [{ language: "en", title: "fantasy" }],
    };
    expect(titleOf(unit, cached)).toBe("fantasy");
  });

  test("tag with label only returns label", () => {
    const unit = makeUnit({ kind: "tag", unitId: "tag-2" });
    const cached = { unitId: "tag-2", label: "sci-fi", translations: [] };
    expect(titleOf(unit, cached)).toBe("sci-fi");
  });

  test("unsupported kind returns unitId", () => {
    const unit = makeUnit({ kind: "game", unitId: "game-1" });
    expect(titleOf(unit, undefined)).toBe("game-1");
  });

  test("missing cache returns unitId", () => {
    const unit = makeUnit({ kind: "book", unitId: "book-x" });
    expect(titleOf(unit, undefined)).toBe("book-x");
  });
});
