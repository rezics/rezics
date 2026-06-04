import type {
  CreateEntityInput,
  EditorialPatchSubmission,
  EntityListQuery,
  RezicsSessionClaims,
  UpdateEntityInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { getSlugScopeId, requireSlugScopeId } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  createDrizzleCollaborativeMetadataTx,
  hasOwn,
  mapActualTranslationPatchPaths,
  mapTranslationPatchPaths,
  sameJson,
  translationPatchFromPaths,
  uniquePatchPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { AppError } from "@/utils/errors";
import { Entity, Unit, UnitFieldLock, UnitTranslation } from "../db/schema";
import type { EntityWithRelations } from "./entity.types";

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

type CreateEntityRepositoryInput = {
  input: CreateEntityInput;
  ownerUserId: string;
  entityScope: string;
  actorUserId?: string;
  historyPatch?: Record<string, unknown>;
};

type UpdateEntityRepositoryInput = {
  unitId: string;
  input: UpdateEntityInput;
  actor?: RezicsSessionClaims;
  actorUserId: string;
  patchPaths: string[];
  patch: Record<string, unknown>;
  historyInput?: Pick<
    EditorialPatchSubmission,
    "patch" | "message" | "restoreSource"
  >;
};

export type EntityRepository = {
  create(input: CreateEntityRepositoryInput): Promise<EntityWithRelations>;
  getVerified(unitId: string): Promise<boolean>;
  getCurrentMetadata(unitId: string): Promise<CurrentEntityMetadata>;
  update(input: UpdateEntityRepositoryInput): Promise<EntityWithRelations>;
  delete(unitId: string): Promise<void>;
  getByUnitId(unitId: string): Promise<EntityWithRelations | null>;
  getBySlug(input: {
    entityScope: string;
    slug: string;
  }): Promise<EntityWithRelations | null>;
  list(
    options: EntityListQuery,
  ): Promise<{ rows: EntityWithRelations[]; total: number }>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
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

async function hydrateEntity(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<EntityWithRelations | null> {
  const [row] = await database
    .select({ entity: Entity, unit: Unit })
    .from(Entity)
    .innerJoin(Unit, eq(Entity.unitId, Unit.id))
    .where(eq(Entity.unitId, unitId))
    .limit(1);
  if (!row) return null;

  const translations = await database
    .select()
    .from(UnitTranslation)
    .where(eq(UnitTranslation.unitId, unitId));

  return {
    ...row.entity,
    unit: {
      ...row.unit,
      translations,
    },
  };
}

async function hydrateEntityOrThrow(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<EntityWithRelations> {
  const row = await hydrateEntity(database, unitId);
  if (!row) throw new Error(`Entity not found: ${unitId}`);
  return row;
}

function createDrizzleEntityRepository(): EntityRepository {
  return {
    async create({
      input,
      ownerUserId,
      entityScope,
      actorUserId,
      historyPatch,
    }) {
      const db = await getServerDb();
      const unitId = await db.transaction(async (tx) => {
        const now = new Date();
        const [unit] = await tx
          .insert(Unit)
          .values({
            type: "ENTITY",
            slug: input.slug ?? null,
            slugScope: entityScope,
            status: "PUBLISHED",
            visibility: "PUBLIC",
            userId: ownerUserId,
            updatedAt: now,
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create Entity Unit");

        await tx.insert(Entity).values({
          unitId: unit.id,
          kind: input.kind ?? null,
          avatar: input.avatar ?? null,
          verified: input.verified ?? false,
          eligibleCreditRoles: input.eligibleCreditRoles,
          eligibleSubjectRoles: input.eligibleSubjectRoles,
        });

        if (input.creationMode !== "wiki") {
          await tx.insert(UnitFieldLock).values({
            unitId: unit.id,
            path: "*",
            lockedById: actorUserId ?? ownerUserId,
            reason: "Personal creation starts closed to community edits.",
          });
        }

        if (input.translations.length > 0) {
          await tx.insert(UnitTranslation).values(
            input.translations.map((tr) => ({
              unitId: unit.id,
              language: tr.language,
              title: tr.title,
              subtitle: tr.subtitle ?? null,
              summary: tr.summary ?? null,
              description: nullableContentDocJson(tr.description),
              updatedAt: now,
            })),
          );
        }

        if (actorUserId && historyPatch) {
          await writeEditorialMetadataHistory(
            createDrizzleCollaborativeMetadataTx(tx),
            {
              unitId: unit.id,
              actorUserId,
              patch: historyPatch,
              message: "entity.create",
            },
          );
        }

        return unit.id;
      });

      return hydrateEntityOrThrow(db, unitId);
    },
    async getVerified(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ verified: Entity.verified })
        .from(Entity)
        .where(eq(Entity.unitId, unitId))
        .limit(1);
      if (!row) throw new Error(`Entity not found: ${unitId}`);
      return row.verified;
    },
    async getCurrentMetadata(unitId) {
      const row = await this.getByUnitId(unitId);
      if (!row) throw new Error(`Entity not found: ${unitId}`);
      return {
        kind: row.kind,
        avatar: row.avatar,
        verified: row.verified,
        eligibleCreditRoles: row.eligibleCreditRoles,
        eligibleSubjectRoles: row.eligibleSubjectRoles,
        unit: {
          slug: row.unit.slug,
          translations: row.unit.translations,
        },
      };
    },
    async update({
      unitId,
      input,
      actor,
      actorUserId,
      patchPaths,
      patch,
      historyInput,
    }) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        const collaborativeTx = createDrizzleCollaborativeMetadataTx(tx);
        if (actor) {
          await assertCanEditCollaborativeMetadata(
            collaborativeTx,
            actor,
            unitId,
            patchPaths,
          );
        }

        const entityUpdate: Partial<typeof Entity.$inferInsert> = {};
        if (input.kind !== undefined) entityUpdate.kind = input.kind ?? null;
        if (input.avatar !== undefined) {
          entityUpdate.avatar = input.avatar ?? null;
        }
        if (input.verified !== undefined) {
          entityUpdate.verified = input.verified;
        }
        if (input.eligibleCreditRoles !== undefined) {
          entityUpdate.eligibleCreditRoles = input.eligibleCreditRoles;
        }
        if (input.eligibleSubjectRoles !== undefined) {
          entityUpdate.eligibleSubjectRoles = input.eligibleSubjectRoles;
        }
        if (Object.keys(entityUpdate).length > 0) {
          await tx
            .update(Entity)
            .set(entityUpdate)
            .where(eq(Entity.unitId, unitId));
        }

        if (input.slug !== undefined) {
          await tx
            .update(Unit)
            .set({ slug: input.slug ?? null, updatedAt: new Date() })
            .where(eq(Unit.id, unitId));
        }

        if (input.translations?.length) {
          for (const tr of input.translations) {
            await tx
              .insert(UnitTranslation)
              .values({
                unitId,
                language: tr.language,
                title: tr.title,
                subtitle: tr.subtitle ?? null,
                summary: tr.summary ?? null,
                description: nullableContentDocJson(tr.description),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [UnitTranslation.unitId, UnitTranslation.language],
                set: {
                  title: tr.title,
                  subtitle: tr.subtitle ?? null,
                  summary: tr.summary ?? null,
                  description: nullableContentDocJson(tr.description),
                  updatedAt: new Date(),
                },
              });
          }
        }

        if (actor) {
          await writeEditorialMetadataHistory(collaborativeTx, {
            unitId,
            actorUserId,
            patch: historyInput?.patch ?? patch,
            message: historyInput?.message ?? "entity.metadata.update",
            restoreSource: historyInput?.restoreSource,
          });
        }
      });

      return hydrateEntityOrThrow(db, unitId);
    },
    async delete(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },
    async getByUnitId(unitId) {
      const db = await getServerDb();
      return hydrateEntity(db, unitId);
    },
    async getBySlug({ entityScope, slug }) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(eq(Unit.slugScope, entityScope), eq(Unit.slug, slug)))
        .limit(1);
      if (!unit || unit.type !== "ENTITY") return null;
      return hydrateEntity(db, unit.id);
    },
    async list(options) {
      const db = await getServerDb();
      const page = Math.max(Number(options.page ?? 1), 1);
      const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
      const skip = (page - 1) * limit;
      const conditions = [];

      if (options.kind?.trim()) {
        conditions.push(eq(Entity.kind, options.kind));
      }
      if (options.verified !== undefined) {
        conditions.push(eq(Entity.verified, options.verified));
      }
      if (options.q?.trim()) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM "UnitTranslation" tr
          WHERE tr."unitId" = ${Entity.unitId}
            AND tr."title" ILIKE ${`%${options.q.trim()}%`}
        )`);
      }
      if (options.ownerUnitId?.trim()) {
        conditions.push(eq(Unit.userId, options.ownerUnitId));
      }
      const idList = parseIdsCsv(options.ids);
      if (idList && idList.length > 0) {
        conditions.push(inArray(Entity.unitId, idList));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db
          .select({ unitId: Entity.unitId })
          .from(Entity)
          .innerJoin(Unit, eq(Entity.unitId, Unit.id))
          .where(where)
          .orderBy(desc(Unit.createdAt))
          .offset(skip)
          .limit(limit),
        db
          .select({ value: count() })
          .from(Entity)
          .innerJoin(Unit, eq(Entity.unitId, Unit.id))
          .where(where),
      ]);

      const hydrated = await Promise.all(
        rows.map((row) => hydrateEntityOrThrow(db, row.unitId)),
      );
      return { rows: hydrated, total: totalRows[0]?.value ?? 0 };
    },
  };
}

/**
 * Entity Service - Business logic for generic Entity units.
 */
export class EntityService {
  constructor(
    private readonly repository: EntityRepository = createDrizzleEntityRepository(),
  ) {}

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

    const row = await this.repository.create({
      input,
      ownerUserId,
      entityScope,
      actorUserId: ctx.actor ? ctx.callerUnitId : undefined,
      historyPatch: ctx.actor ? buildEntityCreatePatch(input) : undefined,
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
      const existingVerified = await this.repository.getVerified(unitId);
      const willBeVerified = input.verified ?? existingVerified;
      if (!willBeVerified) {
        throw new AppError(403, "entity_slug_requires_verified");
      }
    }

    const current = await this.repository.getCurrentMetadata(unitId);
    const patchPaths = mapEntityEffectiveUpdatePatchPaths(input, current);
    const patch = buildEntityUpdatePatchFromPaths(input, current, patchPaths);
    if (patchPaths.length === 0) {
      const row = await this.repository.getByUnitId(unitId);
      if (!row) throw new Error(`Entity not found: ${unitId}`);
      return row;
    }

    const row = await this.repository.update({
      unitId,
      input,
      actor: ctx.actor,
      actorUserId: ctx.callerUnitId,
      patchPaths,
      patch,
      historyInput,
    });

    await enqueueEntitySearch(SEARCH_COMMAND_KINDS.entitySync, unitId);

    return row;
  }

  async delete(unitId: string): Promise<void> {
    await this.repository.delete(unitId);
    await enqueueEntitySearch(SEARCH_COMMAND_KINDS.entityDelete, unitId);
  }

  async getByUnitId(unitId: string): Promise<EntityWithRelations | null> {
    return this.repository.getByUnitId(unitId);
  }

  async getBySlug(slug: string): Promise<EntityWithRelations | null> {
    const entityScope = getSlugScopeId("entity");
    if (!entityScope) return null;
    return this.repository.getBySlug({ entityScope, slug });
  }

  async list(
    options: EntityListQuery = {},
  ): Promise<{ rows: EntityWithRelations[]; total: number }> {
    return this.repository.list(options);
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
