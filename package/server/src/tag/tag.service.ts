import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  TagListQuery,
  UpdateTagInput,
} from "@rezics/contract";
import { validateSlug } from "@rezics/contract";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { patchContentTagsToMeili } from "@/meili/content/sync";
import type { TagWithTranslations, UnitTagWithRelations } from "./types";
import { tagUnitInclude, unitTagInclude } from "./types";

export class TagService {
  /**
   * List tag Units, optionally filtered by name search and language.
   */
  async list(query: TagListQuery = {}): Promise<{
    tags: TagWithTranslations[];
    total: number;
  }> {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 20), 100));
    const skip = (page - 1) * limit;

    const where: any = {
      type: UnitType.TAG,
      status: UnitStatus.PUBLISHED,
    };

    if (query.q && query.q.trim()) {
      where.translations = {
        some: {
          title: { contains: query.q.trim(), mode: "insensitive" },
          ...(query.language ? { language: query.language } : {}),
        },
      };
    } else if (query.language) {
      where.translations = {
        some: { language: query.language },
      };
    }

    const [tags, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: tagUnitInclude,
      }),
      prisma.unit.count({ where }),
    ]);

    return { tags: tags as TagWithTranslations[], total };
  }

  /**
   * Get a single tag Unit by its id, including translations.
   */
  async getByUnitId(unitId: string): Promise<TagWithTranslations> {
    const tag = await prisma.unit.findUniqueOrThrow({
      where: { id: unitId, type: UnitType.TAG },
      include: tagUnitInclude,
    });
    return tag as TagWithTranslations;
  }

  /**
   * Create a new tag Unit with translations.
   * Tags are always isLanguageNeutral=true and type=TAG.
   */
  async create(
    userId: string,
    input: CreateTagInput & { slug?: string },
  ): Promise<TagWithTranslations> {
    let normalizedSlug: string | undefined;
    if (input.slug) {
      const validation = validateSlug(input.slug);
      if (!validation.ok) throw new Error(`Invalid slug: ${validation.reason}`);
      normalizedSlug = validation.normalized;
    }

    const tag = await prisma.unit.create({
      data: {
        type: UnitType.TAG,
        status: UnitStatus.PUBLISHED,
        isLanguageNeutral: true,
        userId,
        ...(normalizedSlug ? { slug: normalizedSlug } : {}),
        translations: {
          create: input.translations.map((t) => ({
            language: t.language,
            title: t.title,
          })),
        },
      },
      include: tagUnitInclude,
    });
    return tag as TagWithTranslations;
  }

  /**
   * Update a tag's translations (upsert each provided translation).
   */
  async update(unitId: string, input: UpdateTagInput): Promise<TagWithTranslations> {
    if (input.translations && input.translations.length > 0) {
      await Promise.all(
        input.translations.map((t) =>
          prisma.unitTranslation.upsert({
            where: {
              unitId_language: { unitId, language: t.language },
            },
            update: { title: t.title },
            create: { unitId, language: t.language, title: t.title },
          }),
        ),
      );
    }

    return this.getByUnitId(unitId);
  }

  /**
   * Delete a tag Unit (cascades to UnitTag, TagVote via DB).
   */
  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  /**
   * Attach a tag to a unit via UnitTag junction (upsert with initial score=1).
   */
  async attachToUnit(tagUnitId: string, unitId: string): Promise<void> {
    await prisma.unitTag.upsert({
      where: {
        unitId_tagUnitId: { unitId, tagUnitId },
      },
      update: {},
      create: {
        unitId,
        tagUnitId,
        score: 1,
        voteCount: 0,
      },
    });
    await patchContentTagsToMeili(unitId);
  }

  /**
   * Detach a tag from a unit by deleting the UnitTag row.
   */
  async detachFromUnit(tagUnitId: string, unitId: string): Promise<void> {
    await prisma.unitTag.delete({
      where: {
        unitId_tagUnitId: { unitId, tagUnitId },
      },
    });
    await patchContentTagsToMeili(unitId);
  }

  /**
   * Cast a vote on a tag-unit association.
   * Upserts the TagVote and recalculates the UnitTag score and voteCount.
   */
  async castVote(
    userId: string,
    unitId: string,
    tagUnitId: string,
    value: number,
  ): Promise<void> {
    const clampedValue = value > 0 ? 1 : -1;

    await prisma.$transaction(async (tx) => {
      // Upsert the vote
      await tx.tagVote.upsert({
        where: {
          userId_unitId_tagUnitId: { userId, unitId, tagUnitId },
        },
        update: { value: clampedValue },
        create: { userId, unitId, tagUnitId, value: clampedValue },
      });

      // Recalculate score and voteCount from all votes
      const agg = await tx.tagVote.aggregate({
        where: { unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      await tx.unitTag.update({
        where: { unitId_tagUnitId: { unitId, tagUnitId } },
        data: {
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
      });
    });
  }

  /**
   * Get all UnitTag rows for a given unit, with tag labels resolved.
   * Optionally filter labels by language.
   */
  async getTagsForUnit(
    unitId: string,
    language?: string,
  ): Promise<UnitTagWithRelations[]> {
    const unitTags = await prisma.unitTag.findMany({
      where: { unitId },
      orderBy: { score: "desc" },
      include: unitTagInclude,
    });
    return unitTags as UnitTagWithRelations[];
  }
}

export const tagService = new TagService();
