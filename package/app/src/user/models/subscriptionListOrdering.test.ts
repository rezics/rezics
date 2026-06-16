import { describe, expect, test } from "bun:test";
import {
  reorderSubscriptionListItems,
  sortSubscriptionListItems,
} from "./subscriptionListOrdering";

const rows = [
  {
    id: "old",
    title: "Old",
    pinned: false,
    position: "A",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "new",
    title: "New",
    pinned: false,
    position: "B",
    createdAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "pinned",
    title: "Pinned",
    pinned: true,
    position: "Z",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
];

describe("subscriptionListOrdering", () => {
  test("keeps pinned items before the selected in-group sort", () => {
    expect(
      sortSubscriptionListItems(rows, "addedDesc").map((row) => row.id),
    ).toEqual(["pinned", "new", "old"]);
    expect(
      sortSubscriptionListItems(rows, "manualDesc").map((row) => row.id),
    ).toEqual(["pinned", "new", "old"]);
  });

  test("moves a selected block when the dragged item is selected", () => {
    const updates = reorderSubscriptionListItems({
      visualItems: [
        { id: "a", position: "A" },
        { id: "b", position: "B" },
        { id: "c", position: "C" },
        { id: "d", position: "D" },
      ],
      activeId: "b",
      overId: "d",
      selectedIds: new Set(["b", "c"]),
      sort: "manualAsc",
    });

    expect(updates.map((update) => update.id)).toEqual(["a", "d", "b", "c"]);
    expect(
      updates.every(
        (update, index) =>
          index === 0 || updates[index - 1]!.position < update.position,
      ),
    ).toBe(true);
  });

  test("does not reorder across pinned boundaries", () => {
    const updates = reorderSubscriptionListItems({
      visualItems: [
        { id: "pinned", pinned: true, position: "A" },
        { id: "normal", pinned: false, position: "B" },
      ],
      activeId: "normal",
      overId: "pinned",
      selectedIds: new Set(["normal"]),
      sort: "manualAsc",
    });

    expect(updates).toEqual([]);
  });
});
