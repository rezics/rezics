import type {
  CreateTranslationInput,
  RezicsSessionClaims,
  UpdateTranslationInput,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import type { Prisma, UnitTranslation } from "#/prisma/client";
import { prisma, UnitType } from "#/prisma/client";
import { patchContentTranslationsToMeili } from "@/meili/content/sync";
import { patchPostsTargetToMeili } from "@/meili/post/sync";
import { patchRealmTranslationsToMeili } from "@/meili/realm/sync";
import {
  assertCanEditCollaborativeMetadata,
  mapTranslationPatchPaths,
  translationPatch,
  uniquePatchPaths,
  writeEditorialMetadataHistory,
} from "./collaborative-metadata";

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
    actor?: RezicsSessionClaims,
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

    let didMutate = false;
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language } },
      });
      const patchPaths = mapActualTranslationPatchPaths(
        data,
        previous,
        language,
      );
      if (previous && patchPaths.length === 0) {
        return previous;
      }

      if (actor) {
        await assertCanEditCollaborativeMetadata(
          tx as any,
          actor,
          unitId,
          patchPaths,
        );
      }
      const row = await tx.unitTranslation.upsert({
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
      didMutate = true;
      if (actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: actor.userId,
          patch: translationPatch(language, data),
          message: "unit.translation.upsert",
        });
      }
      return row;
    });

    // Fire-and-forget: sync dependent Meilisearch documents
    if (didMutate) {
      this.syncMeiliOnTranslationChange(unitId).catch(() => {});
    }

    return result;
  }

  private async syncMeiliOnTranslationChange(unitId: string): Promise<void> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { type: true },
    });
    if (!unit) return;

    if (unit.type === UnitType.REALM) {
      await patchRealmTranslationsToMeili(unitId);
    } else {
      await patchContentTranslationsToMeili(unitId);
      await patchPostsTargetToMeili(unitId);
    }
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(unitId: string, language: string): Promise<void> {
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
    if (
      FALLBACK_LANGUAGE !== requestedLang &&
      FALLBACK_LANGUAGE !== defaultLang
    ) {
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

function mapActualTranslationPatchPaths(
  input: CreateTranslationInput | UpdateTranslationInput,
  previous: UnitTranslation | null,
  language: string,
): string[] {
  if (!previous) {
    return mapTranslationPatchPaths(input, language);
  }

  const prefix = `translations.${language}`;
  return uniquePatchPaths([
    changedNullableString(input, previous, "title")
      ? `${prefix}.title`
      : undefined,
    changedNullableString(input, previous, "subtitle")
      ? `${prefix}.subtitle`
      : undefined,
    changedNullableString(input, previous, "summary")
      ? `${prefix}.summary`
      : undefined,
    changedNullableString(input, previous, "description")
      ? `${prefix}.description`
      : undefined,
    hasOwn(input, "extra") && !sameJson(input.extra ?? null, previous.extra)
      ? `${prefix}.extra`
      : undefined,
    hasOwn(input, "sourceReleaseUnitId") &&
    (input.sourceReleaseUnitId ?? null) !==
      (previous.sourceReleaseUnitId ?? null)
      ? `${prefix}.sourceReleaseUnitId`
      : undefined,
  ]);
}

function changedNullableString(
  input: CreateTranslationInput | UpdateTranslationInput,
  previous: UnitTranslation,
  key: "title" | "subtitle" | "summary" | "description",
): boolean {
  return hasOwn(input, key) && (input[key] ?? null) !== (previous[key] ?? null);
}

function hasOwn<T extends object>(input: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
