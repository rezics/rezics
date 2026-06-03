import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { aiDisclosureDetailsSchema } from "../unit/unit";
import {
  bookContentStructureDTOSchema,
  bookContentStructureNodeSchema,
  bookDTOSchema,
  createBookSchema,
  updateBookSchema,
} from "./book";

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

  test("accepts repeated contentUnitId values in one content structure", () => {
    const value = {
      bookUnitId: "book-1",
      nodes: [
        { title: "Route A", contentUnitId: "chapter-1" },
        { title: "Route B", contentUnitId: "chapter-1" },
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
  test("omits legacy work membership properties", () => {
    expect("workUnitId" in bookDTOSchema.properties).toBe(false);
    expect("metadata" in bookDTOSchema.properties).toBe(false);
    expect("workMembership" in bookDTOSchema.properties).toBe(false);
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

  test("accepts catalog MAIN/VARIANT context from the owning Unit", () => {
    expect(
      Value.Check(bookDTOSchema, {
        unitId: "variant-1",
        catalogEntryKind: "VARIANT",
        targetUnitId: "main-1",
      }),
    ).toBe(true);
  });
});

describe("createBookSchema", () => {
  test("omits legacy work creation fields", () => {
    expect("workUnitId" in createBookSchema.properties).toBe(false);
    expect("workMatch" in createBookSchema.properties).toBe(false);
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
