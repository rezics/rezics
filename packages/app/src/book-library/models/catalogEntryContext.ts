import type { BookDTO, PostListBody } from "@rezics/contract";

export type CatalogEntryInteractionContext = {
  pageUnitId: string;
  primaryTargetUnitId: string;
  variantUnitId?: string;
  isVariant: boolean;
};

export function resolveCatalogEntryInteractionContext(
  book: Pick<BookDTO, "unitId" | "catalogEntryKind" | "targetUnitId">,
): CatalogEntryInteractionContext {
  const isVariant = book.catalogEntryKind === "VARIANT" && !!book.targetUnitId;
  const pageUnitId = book.unitId;

  return {
    pageUnitId,
    primaryTargetUnitId: isVariant ? book.targetUnitId! : pageUnitId,
    ...(isVariant ? { variantUnitId: pageUnitId } : {}),
    isVariant,
  };
}

export function postListFiltersForCatalogEntry(
  context: CatalogEntryInteractionContext,
  filters: Pick<PostListBody, "kind" | "languages" | "limit"> = {},
) {
  return context.variantUnitId
    ? { variantUnitId: context.variantUnitId, ...filters }
    : { targetUnitId: context.primaryTargetUnitId, ...filters };
}

export function shelfListFiltersForCatalogEntry(
  context: CatalogEntryInteractionContext,
  filters: { limit?: number } = {},
) {
  return context.variantUnitId
    ? { variantUnitId: context.variantUnitId, ...filters }
    : { containsUnitId: context.primaryTargetUnitId, ...filters };
}
