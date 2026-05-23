import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  RezicsSessionClaims,
  TagListQuery,
  UpdateTagInput,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE, parseIdsCsv, validateSlug } from "@rezics/contract";
import type { UnitTag } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { patchContentTagsToMeili } from "@/meili/content/sync";
import type { TagWithTranslations, UnitTagWithRelations } from "./types";
import { tagUnitInclude, unitTagInclude } from "./types";

/** Score at or below this threshold hides a UnitTag from regular users. */
export const VISIBILITY_THRESHOLD = -100;

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

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      where.id = { in: idList };
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
      const validation = validateSlug(input.slug, { scope: "tag" });
      if (!validation.ok) throw new Error(`Invalid slug: ${validation.reason}`);
      normalizedSlug = validation.normalized;
    }

    const { requireSlugScopeId } = await import("@/infra/slug-scopes");
    const tagScope = requireSlugScopeId("tag");
    const tag = await prisma.unit.create({
      data: {
        type: UnitType.TAG,
        slugScope: tagScope,
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
  async update(
    unitId: string,
    input: UpdateTagInput,
  ): Promise<TagWithTranslations> {
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
   * Create a UnitTag with creation-as-vote semantics.
   *
   * - First call: writes the UnitTag (score=1, voteCount=1) and a +1 TagVote.
   * - Subsequent distinct-user calls: insert a TagVote and recompute score/voteCount.
   * - Idempotent for the same user: existing TagVote is left untouched.
   */
  async createUnitTag(
    userId: string,
    unitId: string,
    tagUnitId: string,
    _actor?: RezicsSessionClaims,
  ): Promise<UnitTag> {
    const result = await prisma.$transaction(async (tx) => {
      const existingVote = await tx.tagVote.findUnique({
        where: {
          userId_unitId_tagUnitId: { userId, unitId, tagUnitId },
        },
      });

      if (!existingVote) {
        await tx.tagVote.create({
          data: { userId, unitId, tagUnitId, value: 1 },
        });
      }

      const agg = await tx.tagVote.aggregate({
        where: { unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      const row = await tx.unitTag.upsert({
        where: { unitId_tagUnitId: { unitId, tagUnitId } },
        update: {
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
        create: {
          unitId,
          tagUnitId,
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
      });
      return row;
    });

    await patchContentTagsToMeili(unitId);
    return result;
  }

  /**
   * Set pin/position on a UnitTag. Authorization is enforced by the route.
   * `position` may be null to clear it; `pinned=false` clears `position` too.
   */
  async setUnitTagPin(
    unitId: string,
    tagUnitId: string,
    input: { pinned?: boolean; position?: string | null },
    _actor?: RezicsSessionClaims,
  ): Promise<UnitTag> {
    const data: { pinned?: boolean; position?: string | null } = {};
    if (input.pinned !== undefined) {
      data.pinned = input.pinned;
      if (input.pinned === false) data.position = null;
    }
    if (input.position !== undefined) data.position = input.position;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.unitTag.update({
        where: { unitId_tagUnitId: { unitId, tagUnitId } },
        data,
      });
      return row;
    });
    await patchContentTagsToMeili(unitId);
    return updated;
  }

  /**
   * Delete a UnitTag and the underlying TagVote rows for that pair.
   */
  async deleteUnitTag(
    unitId: string,
    tagUnitId: string,
    _actor?: RezicsSessionClaims,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.tagVote.deleteMany({ where: { unitId, tagUnitId } });
      await tx.unitTag.delete({
        where: { unitId_tagUnitId: { unitId, tagUnitId } },
      });
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
   * Get UnitTag rows for a given unit, ordered pin-first then score-desc.
   *
   * Regular callers do not see rows with `score <= VISIBILITY_THRESHOLD`.
   * Privileged callers (platform admin / unit owner) see them so the route
   * can flag them with `belowVisibilityThreshold`.
   */
  async getTagsForUnit(
    unitId: string,
    options?: { includeBelowThreshold?: boolean },
  ): Promise<UnitTagWithRelations[]> {
    const where = options?.includeBelowThreshold
      ? { unitId }
      : { unitId, score: { gt: VISIBILITY_THRESHOLD } };

    const unitTags = await prisma.unitTag.findMany({
      where,
      orderBy: [
        { pinned: "desc" },
        { position: "asc" },
        { score: "desc" },
        { tagUnitId: "asc" },
      ],
      include: unitTagInclude,
    });
    return unitTags as UnitTagWithRelations[];
  }

  /**
   * Admin-only discovery: list UnitTag rows at or below the given score
   * threshold, ordered ascending so the worst offenders surface first.
   */
  async listLowScoreUnitTags(
    threshold: number,
    limit: number,
  ): Promise<UnitTag[]> {
    return prisma.unitTag.findMany({
      where: { score: { lte: threshold } },
      orderBy: [{ score: "asc" }, { unitId: "asc" }, { tagUnitId: "asc" }],
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  /**
   * Resolve display translations for a batch of tag unit IDs in the requested language.
   * Uses the standard translation resolution chain (requested -> unit default -> platform fallback -> first).
   */
  async batchTranslations(
    tagUnitIds: string[],
    language: string,
  ): Promise<
    Record<string, { name: string; slug: string; description: string }>
  > {
    if (tagUnitIds.length === 0) return {};

    const tagUnits = await prisma.unit.findMany({
      where: { id: { in: tagUnitIds }, type: UnitType.TAG },
      include: { translations: true },
    });

    const result: Record<
      string,
      { name: string; slug: string; description: string }
    > = {};

    for (const tag of tagUnits) {
      const translations = tag.translations ?? [];
      const requested = translations.find(
        (t) => t.language === language && t.title,
      );
      const defaultLang = tag.defaultLanguage;
      const byDefault = defaultLang
        ? translations.find((t) => t.language === defaultLang && t.title)
        : undefined;
      const byFallback = translations.find(
        (t) => t.language === FALLBACK_LANGUAGE && t.title,
      );
      const first = translations.find((t) => t.title);
      const pick = requested ?? byDefault ?? byFallback ?? first;

      result[tag.id] = {
        name: pick?.title ?? "",
        slug: tag.slug ?? "",
        description: pick?.description ?? "",
      };
    }

    return result;
  }
}

export const tagService = new TagService();
