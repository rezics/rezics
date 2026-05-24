import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma, UnitStatus, UnitType } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import { mapSiblingToDTO } from "./translation-group.mapper";
import {
  type AttachTranslationInput,
  type TranslationGroupSiblingsResult,
  translationGroupSiblingInclude,
} from "./translation-group.types";

function enqueuePostSync(postId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.postSync,
      { postId },
      { type: "server", service: "translation-group" },
    ),
  );
}

export class TranslationGroupService {
  /**
   * Attach a new POST translation to (the group containing) an existing POST.
   * Creates the group lazily on the first attach.
   */
  async attachTranslation(
    existingUnitId: string,
    input: AttachTranslationInput,
    authorUserId: string,
  ): Promise<{ newUnitId: string; groupId: string }> {
    const existing = await prisma.unit.findUnique({
      where: { id: existingUnitId },
      select: {
        id: true,
        type: true,
        defaultLanguage: true,
        translationGroupId: true,
      },
    });

    if (!existing) {
      throw new AppError(404, "Existing unit not found");
    }
    if (existing.type !== UnitType.POST) {
      throw new AppError(
        400,
        "Translation groups are only supported for POST units",
      );
    }
    if (!existing.defaultLanguage) {
      throw new AppError(
        400,
        "Existing unit must have a defaultLanguage to start a translation group",
      );
    }
    if (existing.defaultLanguage === input.language) {
      throw new AppError(
        409,
        "New translation must use a different language than the existing unit",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let groupId = existing.translationGroupId;

      if (!groupId) {
        const group = await tx.translationGroup.create({
          data: { supportedLanguages: [existing.defaultLanguage!] },
          select: { id: true },
        });
        groupId = group.id;

        await tx.unit.update({
          where: { id: existing.id },
          data: { translationGroupId: groupId },
        });

        await tx.unitSupportLanguage.upsert({
          where: {
            unitId_language: {
              unitId: existing.id,
              language: existing.defaultLanguage!,
            },
          },
          create: {
            unitId: existing.id,
            language: existing.defaultLanguage!,
            isPrimary: true,
          },
          update: { isPrimary: true },
        });
      }

      const newUnit = await tx.unit.create({
        data: {
          userId: authorUserId,
          slugScope: authorUserId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: input.language,
          translationGroupId: groupId,
          post: {
            create: {
              authorUserId,
              content: input.content ?? Prisma.JsonNull,
            },
          },
          supportLanguages: {
            create: {
              language: input.language,
              isPrimary: true,
            },
          },
          translations:
            input.title != null
              ? {
                  create: {
                    language: input.language,
                    title: input.title,
                  },
                }
              : undefined,
        },
        select: { id: true },
      });

      await tx.translationGroup.update({
        where: { id: groupId },
        data: {
          supportedLanguages: { push: input.language },
        },
      });

      return { newUnitId: newUnit.id, groupId };
    });

    await enqueuePostSync(result.newUnitId);

    return result;
  }

  /**
   * Detach a Unit from its translation group. Removes the group entirely
   * if the detached unit was the last member.
   */
  async detachTranslation(unitId: string): Promise<void> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        defaultLanguage: true,
        translationGroupId: true,
      },
    });

    if (!unit) throw new AppError(404, "Unit not found");
    if (!unit.translationGroupId) {
      throw new AppError(400, "Unit is not part of a translation group");
    }

    const groupId = unit.translationGroupId;
    const language = unit.defaultLanguage;

    await prisma.$transaction(async (tx) => {
      await tx.unit.update({
        where: { id: unitId },
        data: { translationGroupId: null },
      });

      const remaining = await tx.unit.findMany({
        where: { translationGroupId: groupId },
        select: { defaultLanguage: true },
      });

      if (remaining.length === 0) {
        await tx.translationGroup.delete({ where: { id: groupId } });
        return;
      }

      const supportedLanguages = remaining
        .map((u) => u.defaultLanguage)
        .filter((l): l is string => !!l && l !== language);

      await tx.translationGroup.update({
        where: { id: groupId },
        data: { supportedLanguages },
      });
    });

    await enqueuePostSync(unitId);
  }

  /**
   * Returns the group's siblings (including the queried unit) and the
   * group's authoritative supportedLanguages. If the unit is standalone
   * (no group), `groupId` is null and `siblings` is empty.
   */
  async listGroupSiblings(
    unitId: string,
  ): Promise<TranslationGroupSiblingsResult> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { translationGroupId: true },
    });

    if (!unit?.translationGroupId) {
      return { groupId: null, supportedLanguages: [], siblings: [] };
    }

    const groupId = unit.translationGroupId;

    const [group, siblings] = await Promise.all([
      prisma.translationGroup.findUniqueOrThrow({
        where: { id: groupId },
        select: { supportedLanguages: true },
      }),
      prisma.unit.findMany({
        where: { translationGroupId: groupId },
        include: translationGroupSiblingInclude,
      }),
    ]);

    return {
      groupId,
      supportedLanguages: group.supportedLanguages,
      siblings: siblings.map(mapSiblingToDTO),
    };
  }

  /**
   * Single PK-style lookup of a group's supported languages.
   * Returns an empty array if the unit is standalone.
   */
  async getSupportedLanguages(unitId: string): Promise<string[]> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { translationGroupId: true },
    });
    if (!unit?.translationGroupId) return [];

    const group = await prisma.translationGroup.findUnique({
      where: { id: unit.translationGroupId },
      select: { supportedLanguages: true },
    });
    return group?.supportedLanguages ?? [];
  }

  /**
   * Recompute every group's supportedLanguages from its members.
   * Defensive maintenance only — the transactional path is the source of truth.
   */
  async reconcileSupportedLanguages(): Promise<{
    groupsScanned: number;
    groupsUpdated: number;
    emptyGroupsDeleted: number;
  }> {
    const groups = await prisma.translationGroup.findMany({
      select: { id: true, supportedLanguages: true },
    });

    let groupsUpdated = 0;
    let emptyGroupsDeleted = 0;

    for (const group of groups) {
      const members = await prisma.unit.findMany({
        where: { translationGroupId: group.id },
        select: { defaultLanguage: true },
      });

      if (members.length === 0) {
        await prisma.translationGroup.delete({ where: { id: group.id } });
        emptyGroupsDeleted += 1;
        continue;
      }

      const next = members
        .map((m) => m.defaultLanguage)
        .filter((l): l is string => !!l)
        .sort();
      const current = [...group.supportedLanguages].sort();

      if (
        next.length !== current.length ||
        next.some((l, i) => l !== current[i])
      ) {
        await prisma.translationGroup.update({
          where: { id: group.id },
          data: { supportedLanguages: next },
        });
        groupsUpdated += 1;
      }
    }

    return {
      groupsScanned: groups.length,
      groupsUpdated,
      emptyGroupsDeleted,
    };
  }

  /**
   * Cleanup hook called when a Unit is being deleted: remove the unit's
   * contribution to its group's supportedLanguages, and delete the group
   * if it becomes empty. Caller supplies the transaction client.
   */
  async onUnitDeleted(
    tx: Prisma.TransactionClient,
    deletedUnit: {
      id: string;
      translationGroupId: string | null;
      defaultLanguage: string | null;
    },
  ): Promise<void> {
    if (!deletedUnit.translationGroupId) return;

    const remaining = await tx.unit.findMany({
      where: {
        translationGroupId: deletedUnit.translationGroupId,
        id: { not: deletedUnit.id },
      },
      select: { defaultLanguage: true },
    });

    if (remaining.length === 0) {
      await tx.translationGroup.delete({
        where: { id: deletedUnit.translationGroupId },
      });
      return;
    }

    await tx.translationGroup.update({
      where: { id: deletedUnit.translationGroupId },
      data: {
        supportedLanguages: remaining
          .map((u) => u.defaultLanguage)
          .filter((l): l is string => !!l),
      },
    });
  }
}

export const translationGroupService = new TranslationGroupService();
