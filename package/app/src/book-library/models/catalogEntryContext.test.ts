import { describe, expect, test } from "bun:test";
import { PostKind, type BookDTO } from "@rezics/contract";
import {
  postListFiltersForCatalogEntry,
  resolveCatalogEntryInteractionContext,
  shelfListFiltersForCatalogEntry,
} from "./catalogEntryContext";

describe("catalog entry interaction context", () => {
  test("keeps MAIN pages on primary target and contains filters", () => {
    const context = resolveCatalogEntryInteractionContext({
      unitId: "main-1",
      catalogEntryKind: "MAIN",
      targetUnitId: null,
    } as BookDTO);

    expect(context).toEqual({
      pageUnitId: "main-1",
      primaryTargetUnitId: "main-1",
      isVariant: false,
    });
    expect(
      postListFiltersForCatalogEntry(context, {
        kind: PostKind.REVIEW,
        limit: 5,
      }),
    ).toEqual({
      targetUnitId: "main-1",
      kind: PostKind.REVIEW,
      limit: 5,
    });
    expect(shelfListFiltersForCatalogEntry(context, { limit: 5 })).toEqual({
      containsUnitId: "main-1",
      limit: 5,
    });
  });

  test("uses exact variant context for VARIANT page sections", () => {
    const context = resolveCatalogEntryInteractionContext({
      unitId: "variant-1",
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-1",
    } as BookDTO);

    expect(context).toEqual({
      pageUnitId: "variant-1",
      primaryTargetUnitId: "main-1",
      variantUnitId: "variant-1",
      isVariant: true,
    });
    expect(
      postListFiltersForCatalogEntry(context, {
        kind: PostKind.REVIEW,
        limit: 5,
      }),
    ).toEqual({
      variantUnitId: "variant-1",
      kind: PostKind.REVIEW,
      limit: 5,
    });
    expect(shelfListFiltersForCatalogEntry(context, { limit: 5 })).toEqual({
      variantUnitId: "variant-1",
      limit: 5,
    });
  });
});
