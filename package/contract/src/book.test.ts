import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  bookContentStructureDTOSchema,
  bookContentStructureNodeSchema,
  bookDTOSchema,
  createBookSchema,
  updateBookSchema,
} from "./book";
import { aiDisclosureDetailsSchema } from "./unit";

describe("bookContentStructureNodeSchema", () => {
  test("accepts an unmaterialized node without id", () => {
    expect(
      Value.Check(bookContentStructureNodeSchema, { title: "Chapter One" }),
    ).toBe(true);
  });

  test("accepts a materialized node with contentUnitId", () => {
    expect(
      Value.Check(bookContentStructureNodeSchema, {
        title: "Chapter One",
        contentUnitId: "content-1",
      }),
    ).toBe(true);
  });

  test("accepts legacy materialized node with chapterUnitId", () => {
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

  test("accepts a node with optional id and updatedAt", () => {
    expect(
      Value.Check(bookContentStructureNodeSchema, {
        title: "Chapter One",
        id: "node-uuid-1",
        updatedAt: "2026-05-18T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("roundtrips read-shape with id and updatedAt populated", () => {
    const value = {
      bookUnitId: "book-1",
      nodes: [
        {
          id: "node-1",
          title: "Chapter One",
          updatedAt: "2026-05-18T12:00:00.000Z",
        },
        {
          id: "node-2",
          title: "Chapter Two",
          contentUnitId: "chapter-2",
          chapterUnitId: "chapter-2",
          updatedAt: "2026-05-18T12:00:01.000Z",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(Value.Check(bookContentStructureDTOSchema, value)).toBe(true);
  });

  test("accepts write-shape mixing nodes with and without id", () => {
    const value = {
      bookUnitId: "book-1",
      nodes: [
        { id: "node-1", title: "Existing" },
        { title: "New node, no id yet" },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(Value.Check(bookContentStructureDTOSchema, value)).toBe(true);
  });
});

describe("bookDTOSchema", () => {
  test("accepts release work membership metadata", () => {
    expect(
      Value.Check(bookDTOSchema, {
        unitId: "release-1",
        workUnitId: "work-1",
        metadata: { uswn: "work-1" },
        workMembership: {
          unitId: "release-1",
          workUnitId: "work-1",
          role: "RELEASE",
          language: "en",
          position: "a0",
          displayPolicy: "PRIMARY",
        },
      }),
    ).toBe(true);
  });

  test("accepts null USWN for standalone content", () => {
    expect(
      Value.Check(bookDTOSchema, {
        unitId: "standalone-1",
        metadata: { uswn: null },
      }),
    ).toBe(true);
  });

  test("accepts Unit-level AI disclosure metadata", () => {
    expect(
      Value.Check(bookDTOSchema, {
        unitId: "book-1",
        rating: "GENERAL",
        aiDisclosureMode: "MACHINE_GENERATED",
        aiDisclosureDetails: { disclosedBy: "MODERATOR" },
      }),
    ).toBe(true);
  });
});

describe("createBookSchema", () => {
  test("accepts creation-time work matching", () => {
    expect(
      Value.Check(createBookSchema, {
        creationMode: "wiki",
        defaultLanguage: "en",
        workMatch: { releaseUnitId: "release-1" },
        translations: [{ language: "en", title: "New Release" }],
      }),
    ).toBe(true);
  });

  test("accepts AI disclosure fields and rejects unsupported details", () => {
    expect(
      Value.Check(createBookSchema, {
        defaultLanguage: "en",
        aiDisclosureMode: "AI_ASSISTED",
        aiDisclosureDetails: { provider: "OpenAI" },
      }),
    ).toBe(true);
    expect(
      Value.Check(updateBookSchema, {
        aiDisclosureMode: "AI_ASSISTED",
        aiDisclosureDetails: { confidence: 0.9 },
      }),
    ).toBe(false);
    expect(Value.Check(aiDisclosureDetailsSchema, { confidence: 0.9 })).toBe(
      false,
    );
  });
});
