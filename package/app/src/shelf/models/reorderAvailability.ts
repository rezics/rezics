import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";

export function canUseShelfReorder(
  viewMode: ShelfView,
  sort: ShelfSortState,
): boolean {
  return viewMode === "unit" && sort.field === "manual";
}
