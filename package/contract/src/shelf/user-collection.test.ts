import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  addShelfUnitSchema,
  collectInputSchema,
  collectionSearchQuerySchema,
  collectionSearchResponseSchema,
  patchUserUnitCollectionSchema,
  setUserTagApplicationsSchema,
  shelfUnitsQuerySchema,
  userTagApplicationDTOSchema,
  userUnitCollectionDTOSchema,
} from "./shelf";

describe("user collection metadata contracts", () => {
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

  test("models shared user/unit collection text outside shelf containment", () => {
    expect(
      Value.Check(userUnitCollectionDTOSchema, {
        userId: "user-1",
        unitId: "book-1",
        searchText: "private alias #favorite",
      }),
    ).toBe(true);
  });

  test("collection writes distinguish omitted, empty, and null metadata", () => {
    expect(
      Value.Check(patchUserUnitCollectionSchema, { unitId: "book-1" }),
    ).toBe(true);
    expect(
      Value.Check(patchUserUnitCollectionSchema, {
        unitId: "book-1",
        tagUnitIds: [],
      }),
    ).toBe(true);
    expect(
      Value.Check(patchUserUnitCollectionSchema, {
        unitId: "book-1",
        searchText: null,
      }),
    ).toBe(true);
  });

  test("collect and shelf add can carry user-unit metadata patches", () => {
    expect(
      Value.Check(collectInputSchema, {
        targetId: "book-1",
        shelfIds: ["shelf-1"],
        tagUnitIds: ["tag-1"],
        searchText: "alt title",
      }),
    ).toBe(true);
    expect(
      Value.Check(addShelfUnitSchema, {
        unitId: "book-1",
        kind: "book",
        tagUnitIds: [],
        searchText: null,
      }),
    ).toBe(true);
  });

  test("shelf and collection search accept query text plus user tag filters", () => {
    expect(
      Value.Check(shelfUnitsQuerySchema, {
        q: "alias",
        tagUnitIds: ["tag-1"],
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(collectionSearchQuerySchema, {
        userId: "user-1",
        q: "alias",
        tagUnitIds: ["tag-1"],
        limit: 20,
      }),
    ).toBe(true);
  });

  test("collection search returns containment-backed collection units", () => {
    expect(
      Value.Check(collectionSearchResponseSchema, {
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
