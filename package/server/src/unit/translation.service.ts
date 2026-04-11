import type {
  CreateTranslationInput,
  UpdateTranslationInput,
} from "@rezics/contract";
import type { Prisma, UnitTranslation } from "#/prisma/client";
import { prisma } from "#/prisma/client";

/**
 * Translation Service - CRUD for UnitTranslation rows
 */
export class TranslationService {
  /**
   * Get a specific translation by composite key
   */
  async getTranslation(
    unitId: string,
    language: string,
  ): Promise<UnitTranslation> {
    return prisma.unitTranslation.findUniqueOrThrow({
      where: { unitId_language: { unitId, language } },
    });
  }

  /**
   * List all translations for a unit
   */
  async listByUnitId(unitId: string): Promise<UnitTranslation[]> {
    return prisma.unitTranslation.findMany({
      where: { unitId },
      orderBy: { language: "asc" },
    });
  }

  /**
   * Upsert a translation (create or update)
   */
  async upsertTranslation(
    unitId: string,
    language: string,
    data: CreateTranslationInput | UpdateTranslationInput,
  ): Promise<UnitTranslation> {
    const payload: Prisma.UnitTranslationCreateInput = {
      unit: { connect: { id: unitId } },
      language,
      title: data.title ?? undefined,
      subtitle: data.subtitle ?? undefined,
      summary: data.summary ?? undefined,
      description: data.description ?? undefined,
      extra: (data.extra ?? null) as Prisma.InputJsonValue,
      sourceReleaseUnitId:
        "sourceReleaseUnitId" in data
          ? (data.sourceReleaseUnitId ?? undefined)
          : undefined,
    };

    return prisma.unitTranslation.upsert({
      where: { unitId_language: { unitId, language } },
      create: payload,
      update: {
        title: data.title,
        subtitle: data.subtitle,
        summary: data.summary,
        description: data.description,
        extra: (data.extra ?? undefined) as Prisma.InputJsonValue | undefined,
        sourceReleaseUnitId:
          "sourceReleaseUnitId" in data
            ? data.sourceReleaseUnitId
            : undefined,
      },
    });
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(
    unitId: string,
    language: string,
  ): Promise<void> {
    await prisma.unitTranslation.delete({
      where: { unitId_language: { unitId, language } },
    });
  }

  /**
   * Resolve the best translation for a unit given requested and default languages.
   *
   * Precedence: requestedLang -> defaultLang -> first available
   */
  async resolveTranslation(
    unitId: string,
    requestedLang?: string,
    defaultLang?: string,
  ): Promise<UnitTranslation | null> {
    // Try requested language first
    if (requestedLang) {
      const match = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language: requestedLang } },
      });
      if (match) return match;
    }

    // Fall back to default language
    if (defaultLang && defaultLang !== requestedLang) {
      const match = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language: defaultLang } },
      });
      if (match) return match;
    }

    // Fall back to first available translation
    return prisma.unitTranslation.findFirst({
      where: { unitId },
      orderBy: { language: "asc" },
    });
  }
}

export const translationService = new TranslationService();
