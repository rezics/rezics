import type { ShelfSortState } from "@rezics/api/shelf";

export function canUseShelfReorder(
  editing: boolean,
  sort: ShelfSortState,
): boolean {
  return editing && sort.field === "manual";
}
