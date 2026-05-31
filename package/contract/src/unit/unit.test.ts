import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  AiDisclosureMode,
  aiDisclosureDetailsSchema,
  aiDisclosureModeSchema,
  catalogEntryKindSchema,
  createUnitSchema,
  unitDTOSchema,
  unitListBodySchema,
  unitListQuerySchema,
  unitTypeSchema,
  updateUnitSchema,
  wikiTypeSchema,
} from "./unit";

describe("AiDisclosureMode", () => {
  test("accepts exactly the shared canonical disclosure modes", () => {
    expect(Object.values(AiDisclosureMode)).toEqual([
      "UNKNOWN",
      "NONE",
      "AI_ASSISTED",
      "AI_ORIGINATED",
      "MACHINE_GENERATED",
    ]);

    for (const mode of Object.values(AiDisclosureMode)) {
      expect(Value.Check(aiDisclosureModeSchema, mode)).toBe(true);
    }
  });

  test("rejects unsupported disclosure modes", () => {
    expect(Value.Check(aiDisclosureModeSchema, "AI_RISKY")).toBe(false);
  });
});

describe("aiDisclosureDetailsSchema", () => {
  test("accepts supported optional detail fields", () => {
    expect(
      Value.Check(aiDisclosureDetailsSchema, {
        model: "gpt-5",
        provider: "OpenAI",
        reviewedByHuman: true,
        disclosedBy: "USER",
        sourceStandard: "SELF_DECLARED",
      }),
    ).toBe(true);
  });

  test("rejects unsupported detail keys and values", () => {
    expect(
      Value.Check(aiDisclosureDetailsSchema, {
        provider: "OpenAI",
        confidence: 0.8,
      }),
    ).toBe(false);
    expect(
      Value.Check(aiDisclosureDetailsSchema, {
        disclosedBy: "BOT",
      }),
    ).toBe(false);
  });
});

describe("Unit AI disclosure DTO/input schemas", () => {
  test("accept disclosure fields in Unit-facing responses and writes", () => {
    expect(
      Value.Check(unitDTOSchema, {
        id: "unit-1",
        type: "BOOK",
        aiDisclosureMode: "AI_ASSISTED",
        aiDisclosureDetails: { sourceStandard: "C2PA" },
      }),
    ).toBe(true);
    expect(
      Value.Check(createUnitSchema, {
        type: "BOOK",
        aiDisclosureMode: "NONE",
      }),
    ).toBe(true);
    expect(
      Value.Check(updateUnitSchema, {
        aiDisclosureMode: "AI_ORIGINATED",
        aiDisclosureDetails: null,
      }),
    ).toBe(true);
  });

  test("omits legacy work membership fields", () => {
    expect("workUnitId" in unitDTOSchema.properties).toBe(false);
    expect("workUnitId" in createUnitSchema.properties).toBe(false);
    expect("workUnitId" in updateUnitSchema.properties).toBe(false);
    expect("workUnitId" in unitListQuerySchema.properties).toBe(false);
    expect("workUnitId" in unitListBodySchema.properties).toBe(false);
  });
});

describe("CatalogEntryKind", () => {
  test("models native main entries, variants, and non-catalog rows", () => {
    expect(Value.Check(catalogEntryKindSchema, "MAIN")).toBe(true);
    expect(Value.Check(catalogEntryKindSchema, "VARIANT")).toBe(true);
    expect(Value.Check(catalogEntryKindSchema, "NONE")).toBe(true);
    expect(Value.Check(catalogEntryKindSchema, "WORK")).toBe(false);

    expect(
      Value.Check(unitDTOSchema, {
        id: "main-1",
        type: "BOOK",
        catalogEntryKind: "MAIN",
        targetUnitId: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(createUnitSchema, {
        type: "BOOK",
        catalogEntryKind: "VARIANT",
        targetUnitId: "main-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(updateUnitSchema, {
        catalogEntryKind: null,
        targetUnitId: null,
      }),
    ).toBe(true);
  });
});

describe("UnitType", () => {
  test("accepts LABEL as a base Unit type", () => {
    expect(Value.Check(unitTypeSchema, "LABEL")).toBe(true);
    expect(
      Value.Check(createUnitSchema, {
        type: "LABEL",
        defaultLanguage: "en",
        translations: [{ language: "en", title: "Characters" }],
      }),
    ).toBe(true);
  });

  test("rejects LABEL where a work-capable catalog type is required", () => {
    expect(Value.Check(wikiTypeSchema, "LABEL")).toBe(false);
  });
});

describe("Unit list filters", () => {
  test("accepts structured admin operation lookup filters", () => {
    const filters = {
      q: "dune",
      id: "unit-1",
      slug: "dune",
      title: "Dune",
      type: "BOOK",
      userId: "owner-1",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      start: 0,
      limit: 20,
    };

    expect(Value.Check(unitListQuerySchema, filters)).toBe(true);
    expect(Value.Check(unitListBodySchema, filters)).toBe(true);
  });
});
