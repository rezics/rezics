import { describe, expect, test } from "bun:test";
import { RESERVED_SHELF_SLUGS } from "../slug/system-slugs";
import {
  formatReservedShelfTitle,
  RESERVED_SHELF_LABELS,
} from "./system-shelves";

describe("RESERVED_SHELF_LABELS", () => {
  test("has an English label for every reserved shelf slug", () => {
    for (const slug of RESERVED_SHELF_SLUGS) {
      expect(typeof RESERVED_SHELF_LABELS[slug]).toBe("string");
      expect(RESERVED_SHELF_LABELS[slug].length).toBeGreaterThan(0);
    }
  });

  test("uses the canonical capitalized English labels", () => {
    expect(RESERVED_SHELF_LABELS).toEqual({
      favorites: "Favorites",
    });
  });
});

describe("formatReservedShelfTitle", () => {
  test("produces `${slug}'s ${Label}` for every reserved shelf slug", () => {
    for (const shelfSlug of RESERVED_SHELF_SLUGS) {
      expect(formatReservedShelfTitle("alice", shelfSlug)).toBe(
        `alice's ${RESERVED_SHELF_LABELS[shelfSlug]}`,
      );
    }
  });

  test("honors the custom label override", () => {
    expect(formatReservedShelfTitle("alice", "favorites", "收藏")).toBe(
      "alice's 收藏",
    );
  });
});
