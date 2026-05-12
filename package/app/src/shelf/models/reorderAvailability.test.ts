import { describe, expect, test } from "bun:test";
import type { ShelfSortState } from "@rezics/api/shelf";
import { canUseShelfReorder } from "./reorderAvailability";

const manual = { field: "manual", order: "desc" } satisfies ShelfSortState;
const addedAt = { field: "addedAt", order: "desc" } satisfies ShelfSortState;
const title = { field: "title", order: "asc" } satisfies ShelfSortState;

describe("canUseShelfReorder", () => {
  test("allows reorder only in edit mode with manual sort", () => {
    expect(canUseShelfReorder(true, manual)).toBe(true);
  });

  test("blocks reorder outside edit mode", () => {
    expect(canUseShelfReorder(false, manual)).toBe(false);
  });

  test("blocks reorder for non-manual sort fields", () => {
    expect(canUseShelfReorder(true, addedAt)).toBe(false);
    expect(canUseShelfReorder(true, title)).toBe(false);
  });
});
