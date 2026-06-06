import type { ShelfItemShelfGroup } from "@rezics/contract";

function firstText(
  ...values: Array<readonly string[] | string | null | undefined>
): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = value.find((entry) => entry.trim() !== "");
      if (found) return found;
      continue;
    }
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}

export function shelfMatchedSource(
  matchedShelfItemGroup: ShelfItemShelfGroup | undefined,
): string | undefined {
  const matches = matchedShelfItemGroup?.matches ?? [];
  const labels = matches
    .map(({ item }) =>
      firstText(item.itemTitle, item.itemSummary, item.itemText, item.itemId),
    )
    .filter((label) => label.trim() !== "");
  return labels.length > 0 ? labels.slice(0, 3).join(" · ") : undefined;
}
