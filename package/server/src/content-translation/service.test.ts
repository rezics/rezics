import { describe, expect, test } from "bun:test";
import {
  ContentTranslationService,
  type ContentTranslationRepository,
} from "./service";
import type { ContentTranslationRow } from "./types";

const now = new Date("2026-05-31T00:00:00.000Z");

function translationRow(
  overrides: Partial<ContentTranslationRow> = {},
): ContentTranslationRow {
  return {
    unitId: "wiki-1",
    language: "en",
    content: { main: { type: "markdown", source: "Body" } },
    status: "PUBLISHED",
    sourceUnitId: null,
    authorUserId: null,
    provenance: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function freshRepository() {
  const calls: Array<{ method: string; input: unknown }> = [];
  const repository: ContentTranslationRepository = {
    async get(unitId, language) {
      calls.push({ method: "get", input: { unitId, language } });
      return translationRow({ unitId, language });
    },
    async list(unitId) {
      calls.push({ method: "list", input: unitId });
      return [];
    },
    async upsert(input) {
      calls.push({ method: "upsert", input });
      return translationRow({
        unitId: input.unitId,
        language: input.language,
        content: input.content,
        status: input.createStatus,
        sourceUnitId: input.sourceUnitId ?? null,
        authorUserId: input.authorUserId ?? null,
        provenance: input.provenance ?? null,
      });
    },
    async delete(unitId, language) {
      calls.push({ method: "delete", input: { unitId, language } });
    },
  };
  return { calls, service: new ContentTranslationService(repository) };
}

describe("ContentTranslationService", () => {
  test("lists body translations by unit", async () => {
    const { calls, service } = freshRepository();

    await service.list("wiki-1");

    expect(calls).toContainEqual({ method: "list", input: "wiki-1" });
  });

  test("upserts language-specific body content with actor provenance", async () => {
    const { calls, service } = freshRepository();

    const result = await service.upsert(
      {
        unitId: "wiki-1",
        language: "en",
        content: { main: { type: "markdown", source: "Body" } },
        provenance: { importedFrom: "legacy-wiki-post" },
      },
      "user-1",
    );

    expect(calls).toContainEqual({
      method: "upsert",
      input: {
        unitId: "wiki-1",
        language: "en",
        content: { main: { type: "markdown", source: "Body" } },
        createStatus: "PUBLISHED",
        updateStatus: undefined,
        sourceUnitId: undefined,
        authorUserId: "user-1",
        provenance: { importedFrom: "legacy-wiki-post" },
      },
    });
    expect(result.authorUserId).toBe("user-1");
  });

  test("deletes one unit/language content translation", async () => {
    const { calls, service } = freshRepository();

    await service.delete("wiki-1", "ja");

    expect(calls).toContainEqual({
      method: "delete",
      input: { unitId: "wiki-1", language: "ja" },
    });
  });
});
