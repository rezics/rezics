import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  bookContentStructureDTOSchema,
  bookContentStructureNodeSchema,
} from "./book";

describe("bookContentStructureNodeSchema", () => {
  test("accepts an unmaterialized node without id", () => {
    expect(
      Value.Check(bookContentStructureNodeSchema, { title: "Chapter One" }),
    ).toBe(true);
  });

  test("accepts a materialized node with chapterUnitId", () => {
    expect(
      Value.Check(bookContentStructureNodeSchema, {
        title: "Chapter One",
        chapterUnitId: "chapter-1",
      }),
    ).toBe(true);
  });

  test("accepts repeated chapterUnitId values in one content structure", () => {
    const value = {
      bookUnitId: "book-1",
      nodes: [
        { title: "Route A", chapterUnitId: "chapter-1" },
        { title: "Route B", chapterUnitId: "chapter-1" },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(Value.Check(bookContentStructureDTOSchema, value)).toBe(true);
  });

  test("accepts an empty content structure", () => {
    const value = {
      bookUnitId: "book-1",
      nodes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(Value.Check(bookContentStructureDTOSchema, value)).toBe(true);
  });

  test("does not require noContent", () => {
    expect(
      Value.Check(bookContentStructureNodeSchema, { title: "No flag" }),
    ).toBe(true);
  });
});
