import { describe, expect, test } from "bun:test";
import { filterReadableEntries, isReadableEntry } from "./readableFilter";
import type { ShelfStreamEntry } from "./shelfStream";

function peerEntry(kind: string, isLicensed?: boolean): ShelfStreamEntry {
  return {
    kind: "peer",
    unit: {
      unit: {
        shelfId: "shelf-1",
        itemType: "unit",
        itemId: `unit-${kind}-${String(isLicensed)}`,
        kind,
        position: "a",
      },
      data: isLicensed === undefined ? undefined : { isLicensed },
    },
  } as unknown as ShelfStreamEntry;
}

describe("isReadableEntry", () => {
  test("licensed book is readable", () => {
    expect(isReadableEntry(peerEntry("book", true))).toBe(true);
  });

  test("unlicensed book is not readable", () => {
    expect(isReadableEntry(peerEntry("book", false))).toBe(false);
  });

  test("book with unknown license is not readable (defaults closed)", () => {
    expect(isReadableEntry(peerEntry("book"))).toBe(false);
  });

  test("non-book library kinds are always readable", () => {
    expect(isReadableEntry(peerEntry("game"))).toBe(true);
    expect(isReadableEntry(peerEntry("media"))).toBe(true);
  });

  test("non-library kinds are unaffected (kept)", () => {
    expect(isReadableEntry(peerEntry("review"))).toBe(true);
    expect(isReadableEntry(peerEntry("post"))).toBe(true);
    expect(isReadableEntry(peerEntry("tag"))).toBe(true);
  });
});

describe("filterReadableEntries", () => {
  const mixed = [
    peerEntry("book", true),
    peerEntry("book", false),
    peerEntry("game"),
    peerEntry("media"),
    peerEntry("review"),
  ];

  test("disabled returns every entry unchanged", () => {
    expect(filterReadableEntries(mixed, false)).toHaveLength(mixed.length);
  });

  test("enabled removes only unlicensed books", () => {
    const result = filterReadableEntries(mixed, true);
    // The unlicensed book is dropped; games, media, reviews, and the
    // licensed book all remain.
    // 未授权的 book 被丢弃；games、media、reviews 以及已授权的 book 全部保留。
    expect(result).toHaveLength(4);
    expect(
      result.some(
        (e) => e.unit.unit.kind === "book" && e.unit.data === undefined,
      ),
    ).toBe(false);
  });

  test("returns a copy, not the original array", () => {
    expect(filterReadableEntries(mixed, false)).not.toBe(mixed);
  });
});
