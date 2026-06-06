import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";
import type { ShelfStreamEntry } from "./shelfStream";

export function canUseShelfReorder(
  editing: boolean,
  sort: ShelfSortState,
): boolean {
  return editing && sort.field === "manual";
}

export function canReorderShelfStreamEntry(
  editing: boolean,
  sort: ShelfSortState,
  viewMode: ShelfView,
  entry: ShelfStreamEntry,
): boolean {
  if (!canUseShelfReorder(editing, sort)) return false;
  if (viewMode === "nested") return entry.kind === "root";
  return true;
}
