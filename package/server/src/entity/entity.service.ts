import type {
  CreateEntityInput,
  EntityListQuery,
  Language,
  UpdateEntityInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { getSlugScopeId, requireSlugScopeId } from "@/infra/slug-scopes";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { deleteEntityFromMeili, syncEntityToMeili } from "@/meili/entity/sync";
import { AppError } from "@/utils/errors";
import { entityInclude, type EntityWithRelations } from "./entity.types";

/** Caller-context flags consumed by the slug + verified gates. */
export interface EntityCallerContext {
  /** Caller's USER unitId. Stamped onto `Unit.userId` for v1 creator ownership. */
  callerUnitId: string;
  /** Whether the caller has the global admin role (ADMIN or ROOT). */
  isAdmin: boolean;
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
                    fieldKey: "*",
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
              description: tr.description ?? undefined,
            })),
          },
          entity: {
            create: {
              kind: input.kind ?? undefined,
              verified: input.verified ?? false,
            },
          },
        },
      });

      return tx.entity.findUniqueOrThrow({
        where: { unitId: unit.id },
        include: entityInclude,
      });
    });

    await syncEntityToMeili(row.unitId).catch((error: unknown) => {
      console.error("entity meili sync failed (create)", {
        unitId: row.unitId,
        error,
      });
    });

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
      if (input.kind !== undefined || input.verified !== undefined) {
        await tx.entity.update({
          where: { unitId },
          data: {
            kind: input.kind !== undefined ? (input.kind ?? null) : undefined,
            verified: input.verified !== undefined ? input.verified : undefined,
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
              description: tr.description ?? undefined,
            },
            update: {
              title: tr.title,
              subtitle: tr.subtitle ?? undefined,
              summary: tr.summary ?? undefined,
              description: tr.description ?? undefined,
            },
          });
        }
      }

      return tx.entity.findUniqueOrThrow({
        where: { unitId },
        include: entityInclude,
      });
    });

    await syncEntityToMeili(unitId).catch((error: unknown) => {
      console.error("entity meili sync failed (update)", { unitId, error });
    });

    return row;
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
    await deleteEntityFromMeili(unitId).catch((error: unknown) => {
      console.error("entity meili delete failed", { unitId, error });
    });
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
