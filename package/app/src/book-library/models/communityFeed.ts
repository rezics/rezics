import type { PostDTO } from "@rezics/contract";

export type BookCommunityFeedMode = "entry";

export type BookCommunityFeedQuery = {
  mode: BookCommunityFeedMode;
  targetUnitId: string;
};

export function resolveBookCommunityFeedQuery(input: {
  currentCatalogEntryUnitId: string;
}): BookCommunityFeedQuery {
  return {
    mode: "entry",
    targetUnitId: input.currentCatalogEntryUnitId,
  };
}

export function resolvePostTargetVariantLabel(
  post: Pick<PostDTO, "targetUnitId">,
  currentCatalogEntryUnitId: string,
  variantTitlesByUnitId: Readonly<Record<string, string>>,
): string | undefined {
  const targetUnitId = post.targetUnitId ?? undefined;
  if (!targetUnitId || targetUnitId === currentCatalogEntryUnitId) {
    return undefined;
  }
  return variantTitlesByUnitId[targetUnitId] ?? targetUnitId;
}
