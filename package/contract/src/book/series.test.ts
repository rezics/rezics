import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  seriesContentEligibilityHints,
  seriesContentIndexDTOSchema,
  seriesContentNodeSchema,
  seriesDetailDTOSchema,
  seriesKindSchema,
} from "./series";

describe("series contract schemas", () => {
  test("accepts public Series kind values and rejects internal partitions", () => {
    expect(Value.Check(seriesKindSchema, "book_series")).toBe(true);
    expect(Value.Check(seriesKindSchema, "franchise")).toBe(true);
    expect(Value.Check(seriesKindSchema, "universe")).toBe(true);
    expect(Value.Check(seriesKindSchema, "season_group")).toBe(false);
    expect(Value.Check(seriesKindSchema, "arc")).toBe(false);
  });

  test("accepts release-first Series member nodes", () => {
    expect(
      Value.Check(seriesContentNodeSchema, {
        title: "Volume 1",
        nodeKind: "release_member",
        contentUnitId: "release-1",
        contentUnitType: "BOOK",
        contributesDirectReleaseMembership: true,
      }),
    ).toBe(true);
  });

  test("rejects Work Units as counted Series member nodes", () => {
    expect(
      Value.Check(seriesContentNodeSchema, {
        title: "Abstract work",
        nodeKind: "release_member",
        contentUnitId: "work-1",
        contentUnitType: "WORK",
        contributesDirectReleaseMembership: true,
      }),
    ).toBe(false);
  });

  test("allows nested Series references as non-transitive structure nodes", () => {
    expect(
      Value.Check(seriesContentNodeSchema, {
        title: "Marvel Cinematic Universe",
        nodeKind: "nested_series_reference",
        contentUnitId: "series-child",
        contentUnitType: "SERIES",
        contributesDirectReleaseMembership: false,
      }),
    ).toBe(true);
    expect(
      seriesContentEligibilityHints.nestedSeriesReferencesAreTransitive,
    ).toBe(false);
  });

  test("serializes direct Series content index rows without hierarchy fields", () => {
    const row = {
      seriesUnitId: "series-1",
      releaseUnitId: "release-1",
      contentNodeId: "node-1",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    };

    expect(Value.Check(seriesContentIndexDTOSchema, row)).toBe(true);
    expect(
      Object.keys(
        (seriesContentIndexDTOSchema as unknown as { properties: object })
          .properties,
      ),
    ).not.toEqual(expect.arrayContaining(["path", "depth", "position"]));
  });

  test("accepts Series details with generic content structure", () => {
    expect(
      Value.Check(seriesDetailDTOSchema, {
        unitId: "series-1",
        kindKey: "media_series",
        directReleaseCount: 1,
        contentStructure: {
          ownerUnitId: "series-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          nodes: [{ title: "TV", contentUnitId: "release-1" }],
        },
      }),
    ).toBe(true);
  });
});
