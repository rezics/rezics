import type {
  CreateUnitInput,
  UnitListQuery,
  UpdateUnitInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { Prisma } from "#/prisma/client";
import {
  type ContentRating,
  prisma,
  UnitStatus,
  type UnitType,
  type UnitVisibility,
} from "#/prisma/client";
import { pickSlugScope } from "@/infra/slug-scopes";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { serverJobProducer } from "@/job/job-boundary";
import { cleanupReactions } from "@/reaction-boundary/reaction-boundary.client";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import type { UnitWithRelations } from "./types";
import {
  assertLicenseSlug,
  publicUnitEligibilityWhere,
} from "./publication-policy";
import { unitInclude } from "./types";

type MaybeInclude = Prisma.UnitInclude | undefined;
type ResolvedInclude<TInclude extends MaybeInclude> =
  TInclude extends Prisma.UnitInclude ? TInclude : typeof unitInclude;
type UnitResult<TInclude extends MaybeInclude> = Prisma.UnitGetPayload<{
  include: ResolvedInclude<TInclude>;
}>;

function enqueueContentCommand(
  kind:
    | typeof SEARCH_COMMAND_KINDS.contentSync
    | typeof SEARCH_COMMAND_KINDS.contentDelete,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(kind, { unitId }, { type: "server", service: "unit" }),
  );
}

function enqueueContentMetadataCommand(
  unitId: string,
  fields: Record<string, unknown>,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchMetadata,
      { targetId: unitId, fields },
      { type: "server", service: "unit" },
    ),
  );
}

/**
 * Compose a Prisma where clause for Unit list queries.
 *
 * Searches UnitTranslation titles for text queries. Rich description text is
 * projected through Meilisearch, not PostgreSQL JSON fields.
 * Filters by visibility, workUnitId, language, rating, type, status, userId.
 */
export function buildUnitWhereClause(
  options: UnitListQuery,
): Prisma.UnitWhereInput {
  const andWhere: Prisma.UnitWhereInput[] = [];

  // Text search: search in UnitTranslation title.
  if (options.q?.trim()) {
    andWhere.push({
      translations: {
        some: {
          title: { contains: options.q, mode: "insensitive" },
        },
      },
    });
  }

  // Filter by type(s)
  const typeList = (options.types ?? options.type ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (typeList.length > 0)
    andWhere.push({ type: { in: typeList as UnitType[] } });

  // Exclude types
  const excludeTypeList = (options.excludeTypes ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (excludeTypeList.length > 0)
    andWhere.push({ NOT: { type: { in: excludeTypeList as UnitType[] } } });

  // Filter by status(es)
  const statusList = (options.statuses ?? options.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (statusList.length > 0)
    andWhere.push({ status: { in: statusList as UnitStatus[] } });

  // Filter by visibility
  if (options.visibility?.trim()) {
    andWhere.push({
      visibility: options.visibility as UnitVisibility,
    });
  }

  // Filter by userId(s)
  const userList = (options.userIds ?? options.userId ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (userList.length > 0) andWhere.push({ userId: { in: userList } });

  // Filter by workUnitId
  if (options.workUnitId?.trim()) {
    andWhere.push({ workUnitId: options.workUnitId });
  }

  // Filter by language (translations must have this language)
  if (options.language?.trim()) {
    andWhere.push({
      translations: {
        some: { language: options.language },
      },
    });
  }

  // Rating filter
  if (options.rating) {
    andWhere.push({ rating: options.rating as ContentRating });
  }

  // Date ranges
  if (options.createdAtFrom) {
    andWhere.push({ createdAt: { gte: new Date(options.createdAtFrom) } });
  }
  if (options.createdAtTo) {
    andWhere.push({ createdAt: { lte: new Date(options.createdAtTo) } });
  }
  if (options.publishedAtFrom) {
    andWhere.push({ publishedAt: { gte: new Date(options.publishedAtFrom) } });
  }
  if (options.publishedAtTo) {
    andWhere.push({ publishedAt: { lte: new Date(options.publishedAtTo) } });
  }

  // Intersect with explicit unit id list (from listGetQueryBase)
  const idList = parseIdsCsv(options.ids);
  if (idList && idList.length > 0) {
    andWhere.push({ id: { in: idList } });
  }

  return andWhere.length > 0 ? { AND: andWhere } : {};
}

/**
 * Merge multiple where inputs with AND semantics.
 */
export function mergeUnitWhereInputs(
  ...clauses: (Prisma.UnitWhereInput | undefined)[]
): Prisma.UnitWhereInput {
  const valid = clauses.filter(Boolean) as Prisma.UnitWhereInput[];
  if (valid.length === 0) return {};
  if (valid.length === 1) return valid[0]!;
  return { AND: valid };
}

export function publicUnitWhere(): Prisma.UnitWhereInput {
  return { ...publicUnitEligibilityWhere };
}

/**
 * Unit Service - Business logic for generic Unit entities
 */
export class UnitService {
  /**
   * List Units with pagination and rich filters
   */
  async list<TInclude extends MaybeInclude = undefined>(
    options: UnitListQuery = {},
    opts?: {
      include?: TInclude;
      where?: Prisma.UnitWhereInput;
    },
  ): Promise<{ units: UnitResult<TInclude>[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = options.cursor?.unitId ? 1 : (options.start ?? 0);

    const include = (opts?.include ?? unitInclude) as ResolvedInclude<TInclude>;
    const baseWhere = buildUnitWhereClause(options);
    const where = mergeUnitWhereInputs(baseWhere, opts?.where);

    const sortField = options.sort?.field ?? "createdAt";
    const sortOrder = (
      options.sort?.order?.toLowerCase() === "asc" ? "asc" : "desc"
    ) as Prisma.SortOrder;

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: skipNum,
        cursor: options.cursor?.unitId
          ? { id: options.cursor.unitId }
          : undefined,
        take: limitNum,
        include: include as Prisma.UnitInclude,
      }),
      prisma.unit.count({ where }),
    ]);

    return {
      units: (await hydrateUnitOwnerUserSlugs(
        units as UnitResult<TInclude>[],
      )) as UnitResult<TInclude>[],
      total,
    };
  }

  /** Get a unit by id with relations */
  async getByUnitId<TInclude extends MaybeInclude = undefined>(
    unitId: string,
    opts?: { include?: TInclude },
  ): Promise<UnitResult<TInclude>> {
    const include = (opts?.include ?? unitInclude) as ResolvedInclude<TInclude>;
    const unit = await prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
      include: include as Prisma.UnitInclude,
    });
    return (await hydrateUnitOwnerUserSlugRow(
      unit as UnitResult<TInclude>,
    )) as UnitResult<TInclude>;
  }

  /** Create a Unit with optional translations */
  async create(input: CreateUnitInput): Promise<UnitWithRelations> {
    const type = input.type as UnitType;
    const unit = await prisma.unit.create({
      data: {
        userId: input.userId,
        type,
        slugScope: pickSlugScope(type, input.userId),
        status: (input.status as UnitStatus) ?? UnitStatus.DRAFT,
        visibility: (input.visibility as UnitVisibility) ?? undefined,
        workUnitId: input.workUnitId ?? undefined,
        defaultLanguage: input.defaultLanguage ?? undefined,
        isLanguageNeutral: input.isLanguageNeutral ?? false,
        rating: (input.rating as ContentRating | undefined) ?? undefined,
        licenseSlug: assertLicenseSlug(input.licenseSlug) ?? undefined,
        extra: (input.extra ?? null) as Prisma.InputJsonValue,
        publishedAt: input.publishedAt
          ? new Date(input.publishedAt as any)
          : undefined,
        translations:
          input.translations && input.translations.length > 0
            ? {
                create: input.translations.map((tr) => ({
                  language: tr.language,
                  title: tr.title ?? undefined,
                  subtitle: tr.subtitle ?? undefined,
                  summary: tr.summary ?? undefined,
                  description: nullableContentDocJson(tr.description),
                  extra: (tr.extra ?? null) as Prisma.InputJsonValue,
                  sourceReleaseUnitId: tr.sourceReleaseUnitId ?? undefined,
                })),
              }
            : undefined,
      },
      include: unitInclude,
    });
    await enqueueContentCommand(SEARCH_COMMAND_KINDS.contentSync, unit.id);
    return hydrateUnitOwnerUserSlugRow(unit as UnitWithRelations);
  }

  /** Update a Unit (does not touch translations -- use TranslationService) */
  async update(
    unitId: string,
    input: UpdateUnitInput,
  ): Promise<UnitWithRelations> {
    const unit = await prisma.unit.update({
      where: { id: unitId },
      data: {
        status: (input.status as UnitStatus | undefined) ?? undefined,
        visibility:
          (input.visibility as UnitVisibility | undefined) ?? undefined,
        rating: (input.rating as ContentRating | undefined) ?? undefined,
        licenseSlug:
          input.licenseSlug === null
            ? null
            : (assertLicenseSlug(input.licenseSlug) ?? undefined),
        defaultLanguage: input.defaultLanguage ?? undefined,
        isLanguageNeutral: input.isLanguageNeutral ?? undefined,
        workUnitId: input.workUnitId,
        extra: (input.extra ?? undefined) as Prisma.InputJsonValue | undefined,
        publishedAt: input.publishedAt
          ? new Date(input.publishedAt as any)
          : input.publishedAt === null
            ? null
            : undefined,
      },
      include: unitInclude,
    });

    const patchFields: Record<string, any> = {};
    if (input.rating !== undefined) patchFields.rating = input.rating;
    if (input.visibility !== undefined)
      patchFields.visibility = input.visibility;
    if (input.licenseSlug !== undefined)
      patchFields.licenseSlug = input.licenseSlug;
    if (input.defaultLanguage !== undefined)
      patchFields.defaultLanguage = input.defaultLanguage;
    if (input.publishedAt !== undefined) {
      patchFields.publishedAt = input.publishedAt
        ? new Date(input.publishedAt as any).toISOString()
        : null;
    }
    await enqueueContentMetadataCommand(unitId, patchFields);

    return hydrateUnitOwnerUserSlugRow(unit as UnitWithRelations);
  }

  /**
   * Get a unit by `(scope, slug)`. `scope` is either a named scope key
   * (`user|realm|tag|zone|entity`) or an owner unit id.
   */
  async getBySlug(
    scope: string,
    slug: string,
  ): Promise<UnitWithRelations | null> {
    const { resolveScopeId } = await import("@/shared/slug-ref");
    const slugScope = resolveScopeId(scope);
    if (!slugScope) return null;
    const unit = await prisma.unit.findUnique({
      where: { slugScope_slug: { slugScope, slug } },
      include: unitInclude,
    });
    return unit ? hydrateUnitOwnerUserSlugRow(unit as UnitWithRelations) : null;
  }

  /** Set or update a unit's slug */
  async setSlug(unitId: string, slug: string): Promise<UnitWithRelations> {
    const unit = await prisma.unit.update({
      where: { id: unitId },
      data: { slug },
      include: unitInclude,
    });
    return hydrateUnitOwnerUserSlugRow(unit as UnitWithRelations);
  }

  /** Delete a Unit by id (cascades) */
  async delete(
    unitId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<void> {
    await db.unit.delete({ where: { id: unitId } });
    await enqueueContentCommand(SEARCH_COMMAND_KINDS.contentDelete, unitId);
    // Fire-and-forget cleanup of reactions in the reaction service
    cleanupReactions(unitId).catch(() => {});
  }
}

export const unitService = new UnitService();
