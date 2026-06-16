import type { PostDTO } from "@rezics/contract";

export type BookCommunityStreamMode = "entry";

export type BookCommunityStreamQuery = {
  mode: BookCommunityStreamMode;
  targetUnitId: string;
};

export function resolveBookCommunityStreamQuery(input: {
  currentCatalogEntryUnitId: string;
}): BookCommunityStreamQuery {
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
