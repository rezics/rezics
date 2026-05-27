import type {
  CreateEntityInput,
  EditorialPatchSubmission,
  EntityListQuery,
  Language,
  RezicsSessionClaims,
  UpdateEntityInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { getSlugScopeId, requireSlugScopeId } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  hasOwn,
  mapActualTranslationPatchPaths,
  mapTranslationPatchPaths,
  sameJson,
  translationPatchFromPaths,
  uniquePatchPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { AppError } from "@/utils/errors";
import { type EntityWithRelations, entityInclude } from "./entity.types";

function enqueueEntitySearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.entitySync
    | typeof SEARCH_COMMAND_KINDS.entityDelete,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      kind,
      { unitId },
      { type: "server", service: "entity" },
    ),
  );
}

/** Caller-context flags consumed by the slug + verified gates. */
export interface EntityCallerContext {
  /** Caller's USER unitId. Stamped onto `Unit.userId` for v1 creator ownership. */
  callerUnitId: string;
  /** Whether the caller has the global admin role (ADMIN or ROOT). */
  isAdmin: boolean;
  actor?: RezicsSessionClaims;
}

function rejectNonAdminPrivilegedFields(
  ctx: EntityCallerContext,
  input: { slug?: string | null; verified?: boolean },
): void {
  if (ctx.isAdmin) return;
  if (input.slug !== undefined && input.slug !== null) {
    throw new AppError(403, "entity_slug_admin_only");
  }
  if (input.verified !== undefined) {
    throw new AppError(403, "entity_verified_admin_only");
  }
}

export class EntityService {
  /**
   * Create an Entity unit transactionally:
   *
   *  1. Insert `Unit { type: ENTITY, slugScope: <entity-scope>, userId: caller }`.
   *  2. Insert `Entity { unitId, kind, verified }`.
   *  3. Insert `UnitTranslation[]` rows.
   *
   * Slug acceptance requires admin AND `verified=true` in the same payload.
   * Verified acceptance requires admin.
   */
  async create(
    input: CreateEntityInput,
    ctx: EntityCallerContext,
  ): Promise<EntityWithRelations> {
    rejectNonAdminPrivilegedFields(ctx, input);

    if (input.slug !== undefined && input.slug !== null) {
      if (!input.verified) {
        throw new AppError(403, "entity_slug_requires_verified");
      }
    }

    const entityScope = requireSlugScopeId("entity");
    const ownerUserId =
      input.creationMode === "wiki"
        ? await resolveRezicsWikiUserId()
        : ctx.callerUnitId;

    const row = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          type: "ENTITY",
          slug: input.slug ?? undefined,
          slugScope: entityScope,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          userId: ownerUserId,
          fieldLocks:
            input.creationMode === "wiki"
              ? undefined
              : {
                  create: {
                    path: "*",
                    lockedById: ctx.callerUnitId,
                    reason:
                      "Personal creation starts closed to community edits.",
                  },
                },
          translations: {
            create: input.translations.map((tr) => ({
              language: tr.language as Language,
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: nullableContentDocJson(tr.description),
            })),
          },
          entity: {
            create: {
              kind: input.kind ?? undefined,
              avatar: input.avatar ?? undefined,
              verified: input.verified ?? false,
              eligibleCreditRoles: input.eligibleCreditRoles,
              eligibleSubjectRoles: input.eligibleSubjectRoles,
            },
          },
        },
      });

      if (ctx.actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId: unit.id,
          actorUserId: ctx.callerUnitId,
          patch: buildEntityCreatePatch(input),
          message: "entity.create",
        });
      }

      return tx.entity.findUniqueOrThrow({
        where: { unitId: unit.id },
        include: entityInclude,
      });
    });

    await enqueueEntitySearch(SEARCH_COMMAND_KINDS.entitySync, row.unitId);

    return row;
  }

  /**
   * Update an Entity's fields, parent Unit slug, verified flag, and/or
   * translations. Slug acceptance requires admin AND the entity currently
   * has `verified=true` (or `verified: true` is part of the same payload).
   */
  async update(
    unitId: string,
    input: UpdateEntityInput,
    ctx: EntityCallerContext,
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<EntityWithRelations> {
    rejectNonAdminPrivilegedFields(ctx, input);

    if (input.slug !== undefined && input.slug !== null) {
      const existing = await prisma.entity.findUniqueOrThrow({
        where: { unitId },
        select: { verified: true },
      });
      const willBeVerified = input.verified ?? existing.verified;
      if (!willBeVerified) {
        throw new AppError(403, "entity_slug_requires_verified");
      }
    }

    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.entity.findUniqueOrThrow({
        where: { unitId },
        select: {
          kind: true,
          avatar: true,
          verified: true,
          eligibleCreditRoles: true,
          eligibleSubjectRoles: true,
          unit: {
            select: {
              slug: true,
              translations: {
                select: {
                  language: true,
                  title: true,
                  subtitle: true,
                  summary: true,
                  description: true,
                  extra: true,
                  sourceUnitId: true,
                },
              },
            },
          },
        },
      });
      const patchPaths = mapEntityEffectiveUpdatePatchPaths(input, current);
      const patch = buildEntityUpdatePatchFromPaths(input, current, patchPaths);
      if (patchPaths.length === 0) {
        return tx.entity.findUniqueOrThrow({
          where: { unitId },
          include: entityInclude,
        });
      }
      if (ctx.actor) {
        await assertCanEditCollaborativeMetadata(
          tx as any,
          ctx.actor,
          unitId,
          patchPaths,
        );
      }

      if (
        input.kind !== undefined ||
        input.avatar !== undefined ||
        input.verified !== undefined ||
        input.eligibleCreditRoles !== undefined ||
        input.eligibleSubjectRoles !== undefined
      ) {
        await tx.entity.update({
          where: { unitId },
          data: {
            kind: input.kind !== undefined ? (input.kind ?? null) : undefined,
            avatar:
              input.avatar !== undefined ? (input.avatar ?? null) : undefined,
            verified: input.verified !== undefined ? input.verified : undefined,
            eligibleCreditRoles:
              input.eligibleCreditRoles !== undefined
                ? input.eligibleCreditRoles
                : undefined,
            eligibleSubjectRoles:
              input.eligibleSubjectRoles !== undefined
                ? input.eligibleSubjectRoles
                : undefined,
          },
        });
      }

      if (input.slug !== undefined) {
        await tx.unit.update({
          where: { id: unitId },
          data: { slug: input.slug ?? null },
        });
      }

      if (input.translations?.length) {
        for (const tr of input.translations) {
          await tx.unitTranslation.upsert({
            where: {
              unitId_language: { unitId, language: tr.language },
            },
            create: {
              unitId,
              language: tr.language,
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: nullableContentDocJson(tr.description),
            },
            update: {
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: nullableContentDocJson(tr.description),
            },
          });
        }
      }

      const updated = await tx.entity.findUniqueOrThrow({
        where: { unitId },
        include: entityInclude,
      });

      if (ctx.actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: ctx.callerUnitId,
          patch: historyInput?.patch ?? patch,
          message: historyInput?.message ?? "entity.metadata.update",
          restoreSource: historyInput?.restoreSource,
        });
      }

      return updated;
    });

    await enqueueEntitySearch(SEARCH_COMMAND_KINDS.entitySync, unitId);

    return row;
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
    await enqueueEntitySearch(SEARCH_COMMAND_KINDS.entityDelete, unitId);
  }

  async getByUnitId(unitId: string): Promise<EntityWithRelations | null> {
    return prisma.entity.findUnique({
      where: { unitId },
      include: entityInclude,
    });
  }

  async getBySlug(slug: string): Promise<EntityWithRelations | null> {
    const entityScope = getSlugScopeId("entity");
    if (!entityScope) return null;

    const unit = await prisma.unit.findUnique({
      where: { slugScope_slug: { slugScope: entityScope, slug } },
      select: { id: true, type: true },
    });
    if (!unit || unit.type !== "ENTITY") return null;

    return prisma.entity.findUnique({
      where: { unitId: unit.id },
      include: entityInclude,
    });
  }

  async list(
    options: EntityListQuery = {},
  ): Promise<{ rows: EntityWithRelations[]; total: number }> {
    const page = Math.max(Number(options.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (page - 1) * limit;

    const where: Prisma.EntityWhereInput = {};
    const unitConditions: Prisma.UnitWhereInput[] = [];

    if (options.kind?.trim()) {
      where.kind = options.kind;
    }

    if (options.verified !== undefined) {
      where.verified = options.verified;
    }

    if (options.q?.trim()) {
      unitConditions.push({
        translations: {
          some: {
            title: { contains: options.q, mode: "insensitive" },
          },
        },
      });
    }

    if (options.ownerUnitId?.trim()) {
      unitConditions.push({ userId: options.ownerUnitId });
    }

    if (unitConditions.length === 1) {
      where.unit = unitConditions[0];
    } else if (unitConditions.length > 1) {
      where.unit = { AND: unitConditions };
    }

    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      where.unitId = { in: idList };
    }

    const [rows, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: entityInclude,
        orderBy: { unit: { createdAt: "desc" } },
        skip,
        take: limit,
      }),
      prisma.entity.count({ where }),
    ]);

    return { rows, total };
  }
}

export const entityService = new EntityService();

export function mapEntityUpdatePatchPaths(input: UpdateEntityInput): string[] {
  return uniquePatchPaths([
    input.kind !== undefined ? "entity.kind" : undefined,
    input.avatar !== undefined ? "entity.avatar" : undefined,
    input.verified !== undefined ? "entity.verified" : undefined,
    input.slug !== undefined ? "unit.slug" : undefined,
    input.eligibleCreditRoles !== undefined
      ? "entity.eligibleCreditRoles"
      : undefined,
    input.eligibleSubjectRoles !== undefined
      ? "entity.eligibleSubjectRoles"
      : undefined,
    ...(input.translations ?? []).flatMap((tr) => [
      ...mapTranslationPatchPaths(tr, tr.language),
    ]),
  ]);
}

export function buildEntityCreatePatch(
  input: CreateEntityInput,
): Record<string, unknown> {
  const entity: Record<string, unknown> = {};
  if (input.kind !== undefined) entity.kind = input.kind;
  if (input.avatar !== undefined) entity.avatar = input.avatar;
  if (input.verified !== undefined) entity.verified = input.verified;
  entity.eligibleCreditRoles = input.eligibleCreditRoles;
  entity.eligibleSubjectRoles = input.eligibleSubjectRoles;

  const unit: Record<string, unknown> = {};
  if (input.slug !== undefined) unit.slug = input.slug;

  const translations = Object.fromEntries(
    input.translations
      .map((tr) => {
        const paths = mapActualTranslationPatchPaths(tr, null, tr.language);
        const patch = translationPatchFromPaths(tr.language, tr, paths)
          .translations as Record<string, unknown>;
        return [tr.language, patch[tr.language]];
      })
      .filter(([, patch]) => patch !== undefined),
  );

  return {
    ...(Object.keys(unit).length > 0 ? { unit } : {}),
    ...(Object.keys(entity).length > 0 ? { entity } : {}),
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
  };
}

type CurrentEntityMetadata = {
  kind?: string | null;
  avatar?: string | null;
  verified?: boolean;
  eligibleCreditRoles?: string[];
  eligibleSubjectRoles?: string[];
  unit?: {
    slug?: string | null;
    translations?: Array<{
      language: string;
      title?: string | null;
      subtitle?: string | null;
      summary?: string | null;
      description?: unknown;
      extra?: unknown;
      sourceUnitId?: string | null;
    }>;
  };
};

function mapEntityEffectiveUpdatePatchPaths(
  input: UpdateEntityInput,
  current: CurrentEntityMetadata,
): string[] {
  const translationsByLanguage = new Map(
    (current.unit?.translations ?? []).map((tr) => [tr.language, tr]),
  );
  return uniquePatchPaths([
    hasOwn(input, "kind") && (input.kind ?? null) !== (current.kind ?? null)
      ? "entity.kind"
      : undefined,
    hasOwn(input, "avatar") &&
    (input.avatar ?? null) !== (current.avatar ?? null)
      ? "entity.avatar"
      : undefined,
    hasOwn(input, "verified") && input.verified !== current.verified
      ? "entity.verified"
      : undefined,
    hasOwn(input, "eligibleCreditRoles") &&
    !sameJson(input.eligibleCreditRoles, current.eligibleCreditRoles ?? [])
      ? "entity.eligibleCreditRoles"
      : undefined,
    hasOwn(input, "eligibleSubjectRoles") &&
    !sameJson(input.eligibleSubjectRoles, current.eligibleSubjectRoles ?? [])
      ? "entity.eligibleSubjectRoles"
      : undefined,
    hasOwn(input, "slug") &&
    (input.slug ?? null) !== (current.unit?.slug ?? null)
      ? "unit.slug"
      : undefined,
    ...(input.translations ?? []).flatMap((tr) =>
      mapActualTranslationPatchPaths(
        tr,
        translationsByLanguage.get(tr.language) ?? null,
        tr.language,
      ),
    ),
  ]);
}

function buildEntityUpdatePatchFromPaths(
  input: UpdateEntityInput,
  current: CurrentEntityMetadata,
  paths: readonly string[],
): Record<string, unknown> {
  const pathSet = new Set(paths);
  const entity: Record<string, unknown> = {};
  if (pathSet.has("entity.kind")) entity.kind = input.kind;
  if (pathSet.has("entity.avatar")) entity.avatar = input.avatar;
  if (pathSet.has("entity.verified")) entity.verified = input.verified;
  if (pathSet.has("entity.eligibleCreditRoles")) {
    entity.eligibleCreditRoles = input.eligibleCreditRoles;
  }
  if (pathSet.has("entity.eligibleSubjectRoles")) {
    entity.eligibleSubjectRoles = input.eligibleSubjectRoles;
  }

  const unit: Record<string, unknown> = {};
  if (pathSet.has("unit.slug")) unit.slug = input.slug;

  const translationsByLanguage = new Map(
    (current.unit?.translations ?? []).map((tr) => [tr.language, tr]),
  );
  const translations = Object.fromEntries(
    (input.translations ?? [])
      .map((tr) => {
        const actualPaths = mapActualTranslationPatchPaths(
          tr,
          translationsByLanguage.get(tr.language) ?? null,
          tr.language,
        ).filter((path) => pathSet.has(path));
        const patch = translationPatchFromPaths(tr.language, tr, actualPaths)
          .translations as Record<string, unknown>;
        return [tr.language, patch[tr.language]];
      })
      .filter(([, patch]) => patch !== undefined),
  );

  return {
    ...(Object.keys(unit).length > 0 ? { unit } : {}),
    ...(Object.keys(entity).length > 0 ? { entity } : {}),
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
  };
}
