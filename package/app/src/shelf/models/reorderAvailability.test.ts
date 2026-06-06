import { describe, expect, test } from "bun:test";
import type { EnrichedShelfItem, ShelfSortState } from "@rezics/api/shelf";
import type { ShelfItemDTO } from "@rezics/contract";
import {
  canReorderShelfStreamEntry,
  canUseShelfReorder,
} from "./reorderAvailability";
import type { ShelfStreamEntry } from "./shelfStream";

const manual = { field: "manual", order: "desc" } satisfies ShelfSortState;
const addedAt = { field: "addedAt", order: "desc" } satisfies ShelfSortState;
const title = { field: "title", order: "asc" } satisfies ShelfSortState;

function makeEnriched(unitId: string): EnrichedShelfItem {
  const unit: ShelfItemDTO = {
    shelfId: "shelf-1",
    itemType: "unit",
    itemId: unitId,
    kind: "book",
    position: "a",
  };
  return { unit, data: undefined };
}

const rootEntry: ShelfStreamEntry = {
  kind: "root",
  unit: makeEnriched("book-1"),
  children: [],
};

const childEntry: ShelfStreamEntry = {
  kind: "child",
  unit: makeEnriched("review-1"),
  parentUnitId: "book-1",
};

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

describe("canReorderShelfStreamEntry", () => {
  test("allows every flat-mode shelf item entry to reorder", () => {
    expect(canReorderShelfStreamEntry(true, manual, "flat", rootEntry)).toBe(
      true,
    );
    expect(canReorderShelfStreamEntry(true, manual, "flat", childEntry)).toBe(
      true,
    );
  });

  test("keeps nested-mode reorder scoped to root rows", () => {
    expect(canReorderShelfStreamEntry(true, manual, "nested", rootEntry)).toBe(
      true,
    );
    expect(canReorderShelfStreamEntry(true, manual, "nested", childEntry)).toBe(
      false,
    );
  });

  test("blocks stream entry reorder when not editing manual order", () => {
    expect(canReorderShelfStreamEntry(false, manual, "flat", childEntry)).toBe(
      false,
    );
    expect(canReorderShelfStreamEntry(true, title, "flat", childEntry)).toBe(
      false,
    );
  });
});
