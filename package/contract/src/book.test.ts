import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { bookIndexDTOSchema, bookIndexNodeSchema } from "./book";

describe("bookIndexNodeSchema", () => {
  test("accepts an unmaterialized node without id", () => {
    expect(Value.Check(bookIndexNodeSchema, { title: "Chapter One" })).toBe(
      true,
    );
  });

  test("accepts a materialized node with chapterUnitId", () => {
    expect(
      Value.Check(bookIndexNodeSchema, {
        title: "Chapter One",
        chapterUnitId: "chapter-1",
      }),
    ).toBe(true);
  });

  test("accepts repeated chapterUnitId values in one index", () => {
    const value = {
      bookUnitId: "book-1",
      index: [
        { title: "Route A", chapterUnitId: "chapter-1" },
        { title: "Route B", chapterUnitId: "chapter-1" },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(Value.Check(bookIndexDTOSchema, value)).toBe(true);
  });

  test("accepts an empty index", () => {
    const value = {
      bookUnitId: "book-1",
      index: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(Value.Check(bookIndexDTOSchema, value)).toBe(true);
  });

  test("does not require noContent", () => {
    expect(Value.Check(bookIndexNodeSchema, { title: "No flag" })).toBe(true);
  });
});
