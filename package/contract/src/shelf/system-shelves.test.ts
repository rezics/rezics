import { describe, expect, test } from "bun:test";
import { SYSTEM_SHELF_KIND_KEYS } from "../progress";
import { SYSTEM_SHELF_LABELS, formatSystemShelfTitle } from "./system-shelves";

describe("SYSTEM_SHELF_LABELS", () => {
  test("has an English label for every system kindKey", () => {
    for (const kindKey of SYSTEM_SHELF_KIND_KEYS) {
      expect(typeof SYSTEM_SHELF_LABELS[kindKey]).toBe("string");
      expect(SYSTEM_SHELF_LABELS[kindKey].length).toBeGreaterThan(0);
    }
  });

  test("uses the canonical capitalized English labels", () => {
    expect(SYSTEM_SHELF_LABELS).toEqual({
      favorites: "Favorites",
      backlog: "Backlog",
      active: "Active",
      completed: "Completed",
    });
  });
});

describe("formatSystemShelfTitle", () => {
  test("produces `${slug}'s ${Label}` for every kindKey", () => {
    for (const kindKey of SYSTEM_SHELF_KIND_KEYS) {
      expect(formatSystemShelfTitle("alice", kindKey)).toBe(
        `alice's ${SYSTEM_SHELF_LABELS[kindKey]}`,
      );
    }
  });

  test("honors the custom label override", () => {
    expect(formatSystemShelfTitle("alice", "favorites", "收藏")).toBe(
      "alice's 收藏",
    );
  });

  test("works with arbitrary slugs", () => {
    expect(formatSystemShelfTitle("synth_42", "backlog")).toBe(
      "synth_42's Backlog",
    );
  });
});
