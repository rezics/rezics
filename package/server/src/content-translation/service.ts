import type { UpsertContentTranslationInput } from "@rezics/contract";
import { Prisma, prisma } from "#/prisma/client";
import type { ContentTranslationRow } from "./types";

export class ContentTranslationService {
  async get(unitId: string, language: string): Promise<ContentTranslationRow> {
    return prisma.contentTranslation.findUniqueOrThrow({
      where: { unitId_language: { unitId, language } },
    });
  }

  async list(unitId: string): Promise<ContentTranslationRow[]> {
    return prisma.contentTranslation.findMany({
      where: { unitId },
      orderBy: { language: "asc" },
    });
  }

  async upsert(
    input: UpsertContentTranslationInput,
    actorUserId?: string,
  ): Promise<ContentTranslationRow> {
    return prisma.contentTranslation.upsert({
      where: {
        unitId_language: {
          unitId: input.unitId,
          language: input.language,
        },
      },
      create: {
        unit: { connect: { id: input.unitId } },
        language: input.language,
        content: input.content as Prisma.InputJsonValue,
        status: input.status ?? "PUBLISHED",
        sourceUnitId: input.sourceUnitId ?? undefined,
        authorUserId: input.authorUserId ?? actorUserId ?? undefined,
        provenance:
          input.provenance === null
            ? Prisma.JsonNull
            : (input.provenance as Prisma.InputJsonValue | undefined),
      },
      update: {
        content: input.content as Prisma.InputJsonValue,
        status: input.status,
        sourceUnitId:
          input.sourceUnitId === undefined ? undefined : input.sourceUnitId,
        authorUserId:
          input.authorUserId === undefined
            ? actorUserId
            : (input.authorUserId ?? null),
        provenance:
          input.provenance === undefined
            ? undefined
            : input.provenance === null
              ? Prisma.JsonNull
              : (input.provenance as Prisma.InputJsonValue),
      },
    });
  }

  async delete(unitId: string, language: string): Promise<void> {
    await prisma.contentTranslation.delete({
      where: { unitId_language: { unitId, language } },
    });
  }
}

export const contentTranslationService = new ContentTranslationService();
