import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { markdownContentDoc } from "./doc-v1";
import {
  contentTranslationDTOSchema,
  upsertContentTranslationSchema,
} from "./translation";

describe("ContentTranslation schemas", () => {
  test("stores body content separate from UnitTranslation metadata", () => {
    expect(
      Value.Check(contentTranslationDTOSchema, {
        unitId: "wiki-1",
        language: "en",
        content: markdownContentDoc("Body"),
        status: "PUBLISHED",
        sourceUnitId: null,
        authorUserId: "user-1",
        provenance: { importedFrom: "legacy-wiki-post" },
        createdAt: "2026-05-31T00:00:00.000Z",
        updatedAt: "2026-05-31T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("write schema accepts opaque ContentDoc-shaped payloads and provenance hooks", () => {
    expect(
      Value.Check(upsertContentTranslationSchema, {
        unitId: "wiki-1",
        language: "ja",
        content: { main: { type: "markdown", source: "本文" } },
        status: "DRAFT",
        sourceUnitId: "source-1",
        provenance: null,
      }),
    ).toBe(true);
  });
});
