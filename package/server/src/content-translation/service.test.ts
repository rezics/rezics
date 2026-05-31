import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

describe("ContentTranslationService", () => {
  test("lists body translations by unit", async () => {
    const findMany = mock(async () => []);
    Object.assign(prismaMock, {
      contentTranslation: { findMany },
    });

    const { ContentTranslationService } = await import("./service");
    await new ContentTranslationService().list("wiki-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { unitId: "wiki-1" },
      orderBy: { language: "asc" },
    });
  });

  test("upserts language-specific body content with actor provenance", async () => {
    const upsert = mock(async (args: any) => ({
      unitId: args.create.unit.connect.id,
      language: args.create.language,
      content: args.create.content,
      status: args.create.status,
      sourceUnitId: args.create.sourceUnitId ?? null,
      authorUserId: args.create.authorUserId ?? null,
      provenance: args.create.provenance ?? null,
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    }));
    Object.assign(prismaMock, {
      contentTranslation: { upsert },
    });

    const { ContentTranslationService } = await import("./service");
    const result = await new ContentTranslationService().upsert(
      {
        unitId: "wiki-1",
        language: "en",
        content: { main: { type: "markdown", source: "Body" } },
        provenance: { importedFrom: "legacy-wiki-post" },
      },
      "user-1",
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { unitId_language: { unitId: "wiki-1", language: "en" } },
      create: expect.objectContaining({
        unit: { connect: { id: "wiki-1" } },
        language: "en",
        status: "PUBLISHED",
        authorUserId: "user-1",
        provenance: { importedFrom: "legacy-wiki-post" },
      }),
      update: expect.objectContaining({
        content: { main: { type: "markdown", source: "Body" } },
        authorUserId: "user-1",
        provenance: { importedFrom: "legacy-wiki-post" },
      }),
    });
    expect(result.authorUserId).toBe("user-1");
  });

  test("deletes one unit/language content translation", async () => {
    const deleteMock = mock(async () => ({}));
    Object.assign(prismaMock, {
      contentTranslation: { delete: deleteMock },
    });

    const { ContentTranslationService } = await import("./service");
    await new ContentTranslationService().delete("wiki-1", "ja");

    expect(deleteMock).toHaveBeenCalledWith({
      where: { unitId_language: { unitId: "wiki-1", language: "ja" } },
    });
  });
});
