import type {
  CreateTranslationInput,
  UpdateTranslationInput,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import type { Prisma, UnitTranslation } from "#/prisma/client";
import { prisma, UnitType } from "#/prisma/client";
import { syncRealmToMeili } from "@/meili/realm/sync";
import { syncPostsByTargetToMeili } from "@/meili/post/sync";

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

    const result = await prisma.unitTranslation.upsert({
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

    // Fire-and-forget: sync dependent Meilisearch documents
    this.syncMeiliOnTranslationChange(unitId).catch(() => {});

    return result;
  }

  private async syncMeiliOnTranslationChange(unitId: string): Promise<void> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { type: true },
    });
    if (!unit) return;

    if (unit.type === UnitType.REALM) {
      // Realm translation changed — re-sync the realm document
      await syncRealmToMeili(unitId);
    } else {
      // Non-realm translation changed — re-sync posts targeting this unit
      await syncPostsByTargetToMeili(unitId);
    }
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
   * Precedence: requestedLang -> defaultLang -> 'en' (platform fallback) -> first available
   */
  async resolveTranslation(
    unitId: string,
    requestedLang?: string,
    defaultLang?: string,
  ): Promise<UnitTranslation | null> {
    // 1. Try requested language first
    if (requestedLang) {
      const match = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language: requestedLang } },
      });
      if (match) return match;
    }

    // 2. Fall back to unit's default language
    if (defaultLang && defaultLang !== requestedLang) {
      const match = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language: defaultLang } },
      });
      if (match) return match;
    }

    // 3. Fall back to platform fallback language ('en')
    if (FALLBACK_LANGUAGE !== requestedLang && FALLBACK_LANGUAGE !== defaultLang) {
      const match = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language: FALLBACK_LANGUAGE } },
      });
      if (match) return match;
    }

    // 4. Fall back to first available translation
    return prisma.unitTranslation.findFirst({
      where: { unitId },
      orderBy: { language: "asc" },
    });
  }
}

export const translationService = new TranslationService();
