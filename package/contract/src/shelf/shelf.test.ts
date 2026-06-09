import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  addShelfItemSchema,
  collectInputSchema,
  setShelfItemChildrenSchema,
  shelfDTOSchema,
  shelfItemBatchAddOpSchema,
  shelfItemBatchSetChildrenOpSchema,
  shelfItemChildDTOSchema,
  shelfItemDTOSchema,
  shelfItemsQuerySchema,
  shelfListBodySchema,
  shelfListQuerySchema,
} from "./shelf";

describe("shelf containment contract fields", () => {
  test("accepts matched contained unit context", () => {
    expect(
      Value.Check(shelfDTOSchema, {
        unitId: "shelf-1",
        itemCount: 1,
        matchedUnit: {
          unitId: "release-2",
          kind: "book",
          title: "Translated Edition",
        },
      }),
    ).toBe(true);
  });

  test("accepts exact list filters", () => {
    expect(
      Value.Check(shelfListQuerySchema, {
        containsUnitId: "release-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListBodySchema, {
        containsUnitId: "release-1",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("accepts weak variant context separately from containment", () => {
    expect(
      Value.Check(addShelfItemSchema, {
        itemType: "unit",
        itemId: "main-1",
        variantUnitId: "variant-1",
        kind: "book",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemDTOSchema, {
        shelfId: "shelf-1",
        itemType: "unit",
        itemId: "main-1",
        variantUnitId: "variant-1",
        variantContext: {
          unitId: "variant-1",
          title: "Selected Edition",
        },
        kind: "book",
        position: "a0",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListQuerySchema, {
        containsUnitId: "main-1",
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListBodySchema, {
        containsUnitId: "main-1",
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemsQuerySchema, {
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(collectInputSchema, {
        targetId: "main-1",
        variantUnitId: "variant-1",
        shelfIds: ["shelf-1"],
      }),
    ).toBe(true);
  });

  test("supports comment shelf items without Unit-backed identity", () => {
    expect(
      Value.Check(addShelfItemSchema, {
        itemType: "comment",
        itemId: "comment-1",
        kind: "comment",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemDTOSchema, {
        shelfId: "shelf-1",
        itemType: "comment",
        itemId: "comment-1",
        kind: "comment",
        position: "b0",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemDTOSchema, {
        shelfId: "shelf-1",
        itemType: "comment",
        itemId: "comment-1",
        unitId: "comment-1",
        kind: "comment",
        position: "b0",
      }),
    ).toBe(false);
  });

  test("models one-level child attachments by item identity", () => {
    expect(
      Value.Check(shelfItemDTOSchema, {
        shelfId: "shelf-1",
        itemType: "unit",
        itemId: "review-1",
        kind: "review",
        parentItemType: "unit",
        parentItemId: "book-1",
        parentRole: "review",
        position: "c0",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemDTOSchema, {
        shelfId: "shelf-1",
        itemType: "unit",
        itemId: "variant-1",
        kind: "book",
        parentItemType: "unit",
        parentItemId: "book-1",
        parentRole: "variant",
        position: "c1",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemChildDTOSchema, {
        shelfId: "shelf-1",
        parentItemType: "unit",
        parentItemId: "book-1",
        childItemType: "comment",
        childItemId: "comment-1",
        role: "comment",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemChildDTOSchema, {
        shelfId: "shelf-1",
        parentItemType: "unit",
        parentItemId: "book-1",
        childItemType: "unit",
        childItemId: "variant-1",
        role: "variant",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemChildDTOSchema, {
        shelfId: "shelf-1",
        parentItemType: "unit",
        parentItemId: "book-1",
        parentUnitId: "book-1",
        childItemType: "comment",
        childItemId: "comment-1",
        childUnitId: "comment-1",
        role: "comment",
      }),
    ).toBe(false);
  });

  test("rejects duplicate child ids in set-children inputs", () => {
    expect(
      Value.Check(setShelfItemChildrenSchema, {
        role: "comment",
        childItemType: "comment",
        childItemIds: ["comment-1", "comment-1"],
      }),
    ).toBe(false);
    expect(
      Value.Check(shelfItemBatchSetChildrenOpSchema, {
        op: "setChildren",
        parentItemType: "unit",
        parentItemId: "book-1",
        role: "comment",
        childItemType: "comment",
        childItemIds: ["comment-1", "comment-1"],
      }),
    ).toBe(false);
  });

  test("batch add operations require typed shelf-item identity", () => {
    expect(
      Value.Check(shelfItemBatchAddOpSchema, {
        op: "add",
        itemType: "unit",
        itemId: "book-1",
        kind: "book",
        position: "a0",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfItemBatchAddOpSchema, {
        op: "add",
        unitId: "book-1",
        kind: "book",
        position: "a0",
      }),
    ).toBe(false);
  });

  test("exposes root and total item counts separately", () => {
    expect(
      Value.Check(shelfDTOSchema, {
        unitId: "shelf-1",
        rootItemCount: 2,
        itemCount: 5,
        items: [
          {
            shelfId: "shelf-1",
            itemType: "unit",
            itemId: "book-1",
            kind: "book",
            position: "a0",
          },
        ],
      }),
    ).toBe(true);
  });
});
