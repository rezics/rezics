export type CreatePageSearch = {
  shareTargetId?: string;
  shareTitle?: string;
};

function optionalSearchString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function normalizeCreatePageSearch(
  search: Record<string, unknown>,
): CreatePageSearch {
  return {
    shareTargetId: optionalSearchString(search.shareTargetId),
    shareTitle: optionalSearchString(search.shareTitle),
  };
}
