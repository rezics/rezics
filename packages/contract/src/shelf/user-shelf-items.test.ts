import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  addShelfItemSchema,
  addToShelvesInputSchema,
  userShelfItemsSearchQuerySchema,
  userShelfItemsSearchResponseSchema,
  patchUserShelfItemMetadataSchema,
  setUserTagApplicationsSchema,
  shelfItemsQuerySchema,
  userTagApplicationDTOSchema,
  userShelfItemMetadataDTOSchema,
} from "./shelf";

describe("user shelf item metadata contracts", () => {
  test("models direct user tag applications without score or votes", () => {
    const application = {
      userId: "user-1",
      unitId: "book-1",
      tagUnitId: "tag-1",
      position: "a0",
    };

    expect(Value.Check(userTagApplicationDTOSchema, application)).toBe(true);
    expect(
      Value.Check(userTagApplicationDTOSchema, {
        ...application,
        score: 1,
        voteCount: 1,
      }),
    ).toBe(false);
  });

  test("models shared user/unit shelf item text outside shelf containment", () => {
    expect(
      Value.Check(userShelfItemMetadataDTOSchema, {
        userId: "user-1",
        unitId: "book-1",
        searchText: "private alias #favorite",
      }),
    ).toBe(true);
  });

  test("shelf item writes distinguish omitted, empty, and null metadata", () => {
    expect(
      Value.Check(patchUserShelfItemMetadataSchema, { unitId: "book-1" }),
    ).toBe(true);
    expect(
      Value.Check(patchUserShelfItemMetadataSchema, {
        unitId: "book-1",
        tagUnitIds: [],
      }),
    ).toBe(true);
    expect(
      Value.Check(patchUserShelfItemMetadataSchema, {
        unitId: "book-1",
        searchText: null,
      }),
    ).toBe(true);
  });

  test("add-to-shelves and shelf add can carry user-unit metadata patches", () => {
    expect(
      Value.Check(addToShelvesInputSchema, {
        targetId: "book-1",
        shelfIds: ["shelf-1"],
        tagUnitIds: ["tag-1"],
        searchText: "alt title",
      }),
    ).toBe(true);
    expect(
      Value.Check(addShelfItemSchema, {
        itemType: "unit",
        itemId: "book-1",
        kind: "book",
        tagUnitIds: [],
        searchText: null,
      }),
    ).toBe(true);
  });

  test("shelf and shelf item search accept query text plus user tag filters", () => {
    expect(
      Value.Check(shelfItemsQuerySchema, {
        q: "alias",
        tagUnitIds: ["tag-1"],
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(userShelfItemsSearchQuerySchema, {
        userId: "user-1",
        q: "alias",
        tagUnitIds: ["tag-1"],
        limit: 20,
      }),
    ).toBe(true);
  });

  test("shelf item search returns containment-backed units", () => {
    expect(
      Value.Check(userShelfItemsSearchResponseSchema, {
        units: [
          {
            userId: "user-1",
            unitId: "book-1",
            shelfIds: ["shelf-1", "shelf-2"],
            tagUnitIds: ["tag-1"],
            searchText: "private alias",
          },
        ],
        hasMore: false,
      }),
    ).toBe(true);
  });

  test("tag replacement input is scoped to one user/unit pair", () => {
    expect(
      Value.Check(setUserTagApplicationsSchema, {
        unitId: "book-1",
        tagUnitIds: ["tag-1", "tag-2"],
      }),
    ).toBe(true);
  });
});
