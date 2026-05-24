import type {
  CreateTranslationInput,
  EditorialPatchSubmission,
  RezicsSessionClaims,
  UpdateTranslationInput,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { UnitTranslation } from "#/prisma/client";
import { Prisma, prisma, UnitType } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import {
  applySparsePatch,
  assertCanEditCollaborativeMetadata,
  hasOwn,
  mapActualTranslationPatchPaths,
  translationPatchFromPaths,
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
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<UnitTranslation> {
    let didMutate = false;
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language } },
      });
      const nextExtra =
        hasOwn(data, "extra") && data.extra !== undefined
          ? applySparsePatch(previous?.extra ?? {}, data.extra)
          : previous?.extra;
      const payload: Prisma.UnitTranslationCreateInput = {
        unit: { connect: { id: unitId } },
        language,
        title: data.title ?? undefined,
        subtitle: data.subtitle ?? undefined,
        summary: data.summary ?? undefined,
        description:
          data.description !== undefined
            ? data.description === null
              ? Prisma.JsonNull
              : (data.description as Prisma.InputJsonValue)
            : undefined,
        extra: (nextExtra ?? null) as Prisma.InputJsonValue,
        sourceReleaseUnitId:
          "sourceReleaseUnitId" in data
            ? (data.sourceReleaseUnitId ?? undefined)
            : undefined,
      };
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
          description:
            data.description !== undefined
              ? data.description === null
                ? Prisma.JsonNull
                : (data.description as Prisma.InputJsonValue)
              : undefined,
          extra:
            hasOwn(data, "extra") && data.extra !== undefined
              ? (nextExtra as Prisma.InputJsonValue)
              : undefined,
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
          patch:
            historyInput?.patch ??
            translationPatchFromPaths(language, data, patchPaths),
          message: historyInput?.message ?? "unit.translation.upsert",
          restoreSource: historyInput?.restoreSource,
        });
      }
      return row;
    });

    if (didMutate) {
      await this.syncSearchOnTranslationChange(unitId);
    }

    return result;
  }

  private async syncSearchOnTranslationChange(unitId: string): Promise<void> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { type: true },
    });
    if (!unit) return;

    if (unit.type === UnitType.REALM) {
      await serverJobProducer.enqueue(
        createSearchCommand(
          SEARCH_COMMAND_KINDS.realmPatchTranslations,
          { unitId },
          { type: "server", service: "unit-translation" },
        ),
      );
    } else {
      await Promise.all([
        serverJobProducer.enqueue(
          createSearchCommand(
            SEARCH_COMMAND_KINDS.contentPatchTranslations,
            { unitId },
            { type: "server", service: "unit-translation" },
          ),
        ),
        serverJobProducer.enqueue(
          createSearchCommand(
            SEARCH_COMMAND_KINDS.postPatchTargetFanout,
            { targetId: unitId },
            { type: "server", service: "unit-translation" },
          ),
        ),
      ]);
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
