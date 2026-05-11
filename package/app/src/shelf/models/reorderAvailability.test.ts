import { describe, expect, test } from "bun:test";
import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";
import { canUseShelfReorder } from "./reorderAvailability";

const manual = { field: "manual", order: "desc" } satisfies ShelfSortState;
const addedAt = { field: "addedAt", order: "desc" } satisfies ShelfSortState;

describe("canUseShelfReorder", () => {
  test("allows reorder only in unit view with manual sort", () => {
    expect(canUseShelfReorder("unit", manual)).toBe(true);
  });

  test("blocks reorder for rich views even with manual sort", () => {
    for (const viewMode of [
      "nested",
      "flat",
      "masonry",
    ] satisfies ShelfView[]) {
      expect(canUseShelfReorder(viewMode, manual)).toBe(false);
    }
  });

  test("blocks reorder for non-manual sort fields", () => {
    expect(canUseShelfReorder("unit", addedAt)).toBe(false);
  });
});
