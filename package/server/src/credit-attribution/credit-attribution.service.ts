import type {
  CreateCreditAttributionEvidenceInput,
  CreditAttributionDTO,
  LinkCreditAttributionInput,
  RezicsSessionClaims,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  SourceSite,
  Unit,
  UnitExternalRef,
  UnitTranslation,
} from "../db/schema";
import { serverJobProducer } from "../job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  createDrizzleCollaborativeMetadataTx,
  creditRolePatchPath,
  writeEditorialMetadataHistory,
} from "../unit/collaborative-metadata";
import { AppError } from "../utils/errors";
import { mapCreditAttributionToDTO } from "./credit-attribution.mapper";
import type { CreditAttributionWithRelations } from "./types";

function enqueueContentCreditsSync(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchCredits,
      { unitId },
      { type: "server", service: "credit-attribution" },
    ),
  );
}

type CreditAttributionRow = typeof CreditAttribution.$inferSelect;
type CreditAttributionTx = Awaited<ReturnType<typeof getServerDb>>;

export interface CreditAttributionRepository {
  getCreditEntity(
    entityId: string,
  ): Promise<{ eligibleCreditRoles: string[] } | null>;
  create(
    input: LinkCreditAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<CreditAttributionWithRelations>;
  delete(input: {
    unitId: string;
    entityId: string;
    role: string;
    actor?: RezicsSessionClaims;
  }): Promise<void>;
  listByUnit(unitId: string): Promise<CreditAttributionWithRelations[]>;
  createEvidence(
    input: CreateCreditAttributionEvidenceInput,
  ): Promise<CreditAttributionWithRelations>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function sqlIn(column: any, values: readonly string[]): SQL {
  return values.length === 1
    ? eq(column, values[0]!)
    : inArray(column, [...values]);
}

async function hydrateRows(
  db: Pick<CreditAttributionTx, "select">,
  rows: CreditAttributionRow[],
): Promise<CreditAttributionWithRelations[]> {
  if (rows.length === 0) return [];
  const entityIds = unique(rows.map((row) => row.entityId));
  const unitIds = unique(rows.map((row) => row.unitId));

  const [entityUnits, entities, translations, evidenceRows] = await Promise.all(
    [
      db.select().from(Unit).where(sqlIn(Unit.id, entityIds)),
      db.select().from(Entity).where(sqlIn(Entity.unitId, entityIds)),
      db
        .select()
        .from(UnitTranslation)
        .where(sqlIn(UnitTranslation.unitId, entityIds)),
      db
        .select()
        .from(CreditAttributionEvidence)
        .where(sqlIn(CreditAttributionEvidence.unitId, unitIds))
        .orderBy(desc(CreditAttributionEvidence.observedAt)),
    ],
  );

  const sourceRefIds = unique(evidenceRows.map((row) => row.sourceRefId));
  const sourceRefs =
    sourceRefIds.length > 0
      ? await db
          .select()
          .from(UnitExternalRef)
          .where(sqlIn(UnitExternalRef.id, sourceRefIds))
      : [];
  const sourceSiteIds = unique(
    sourceRefs.map((row) => row.sourceSiteEntityUnitId),
  );
  const [
    sourceSites,
    sourceSiteEntities,
    sourceSiteUnits,
    sourceSiteTranslations,
  ] =
    sourceSiteIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(SourceSite)
            .where(sqlIn(SourceSite.entityUnitId, sourceSiteIds)),
          db.select().from(Entity).where(sqlIn(Entity.unitId, sourceSiteIds)),
          db.select().from(Unit).where(sqlIn(Unit.id, sourceSiteIds)),
          db
            .select()
            .from(UnitTranslation)
            .where(sqlIn(UnitTranslation.unitId, sourceSiteIds)),
        ])
      : [[], [], [], []];

  const unitById = new Map(entityUnits.map((unit) => [unit.id, unit]));
  const entityById = new Map(entities.map((entity) => [entity.unitId, entity]));
  const translationsByUnitId = new Map<string, typeof translations>();
  for (const translation of translations) {
    const list = translationsByUnitId.get(translation.unitId) ?? [];
    list.push(translation);
    translationsByUnitId.set(translation.unitId, list);
  }

  const sourceRefById = new Map(sourceRefs.map((ref) => [ref.id, ref]));
  const sourceSiteById = new Map(
    sourceSites.map((site) => [site.entityUnitId, site]),
  );
  const sourceSiteEntityById = new Map(
    sourceSiteEntities.map((entity) => [entity.unitId, entity]),
  );
  const sourceSiteUnitById = new Map(
    sourceSiteUnits.map((unit) => [unit.id, unit]),
  );
  const sourceSiteTranslationsByUnitId = new Map<
    string,
    typeof sourceSiteTranslations
  >();
  for (const translation of sourceSiteTranslations) {
    const list = sourceSiteTranslationsByUnitId.get(translation.unitId) ?? [];
    list.push(translation);
    sourceSiteTranslationsByUnitId.set(translation.unitId, list);
  }

  const evidenceByKey = new Map<string, typeof evidenceRows>();
  for (const evidence of evidenceRows) {
    const key = `${evidence.unitId}:${evidence.entityId}:${evidence.role}`;
    const list = evidenceByKey.get(key) ?? [];
    list.push(evidence);
    evidenceByKey.set(key, list);
  }

  return rows.map((row) => {
    const entityUnit = unitById.get(row.entityId);
    if (!entityUnit)
      throw new Error("CreditAttribution entity hydration failed");
    const evidence = (
      evidenceByKey.get(`${row.unitId}:${row.entityId}:${row.role}`) ?? []
    ).map((evidence) => {
      const sourceRef = sourceRefById.get(evidence.sourceRefId);
      const sourceSite = sourceRef
        ? sourceSiteById.get(sourceRef.sourceSiteEntityUnitId)
        : undefined;
      const sourceSiteEntity = sourceRef
        ? sourceSiteEntityById.get(sourceRef.sourceSiteEntityUnitId)
        : undefined;
      const sourceSiteUnit = sourceRef
        ? sourceSiteUnitById.get(sourceRef.sourceSiteEntityUnitId)
        : undefined;
      return {
        ...evidence,
        sourceRef: sourceRef
          ? {
              ...sourceRef,
              sourceSite: sourceSite
                ? {
                    ...sourceSite,
                    entity: sourceSiteEntity
                      ? {
                          ...sourceSiteEntity,
                          unit: sourceSiteUnit
                            ? {
                                ...sourceSiteUnit,
                                translations:
                                  sourceSiteTranslationsByUnitId.get(
                                    sourceSiteUnit.id,
                                  ) ?? [],
                              }
                            : undefined,
                        }
                      : null,
                  }
                : null,
            }
          : null,
      };
    });
    return {
      ...row,
      entity: {
        ...entityUnit,
        entity: entityById.get(row.entityId) ?? null,
        translations: translationsByUnitId.get(row.entityId) ?? [],
      },
      evidence,
    };
  });
}

function createDrizzleCreditAttributionRepository(): CreditAttributionRepository {
  async function hydrateOne(
    db: Pick<CreditAttributionTx, "select">,
    row: CreditAttributionRow,
  ) {
    return (await hydrateRows(db, [row]))[0]!;
  }

  return {
    async getCreditEntity(entityId) {
      const db = await getServerDb();
      const [entity] = await db
        .select({ eligibleCreditRoles: Entity.eligibleCreditRoles })
        .from(Entity)
        .where(eq(Entity.unitId, entityId))
        .limit(1);
      return entity ?? null;
    },

    async create(input, actor) {
      const db = await getServerDb();
      if (!actor) {
        const [row] = await db
          .insert(CreditAttribution)
          .values({
            unitId: input.unitId,
            entityId: input.entityId,
            role: input.role,
            sortOrder: input.sortOrder ?? 0,
          })
          .returning();
        if (!row) throw new Error("Failed to create CreditAttribution");
        return hydrateOne(db, row);
      }

      return db.transaction(async (tx) => {
        const patchPath = creditRolePatchPath(input.role);
        const metadataTx = createDrizzleCollaborativeMetadataTx(tx);
        await assertCanEditCollaborativeMetadata(
          metadataTx,
          actor,
          input.unitId,
          [patchPath],
        );
        const [row] = await tx
          .insert(CreditAttribution)
          .values({
            unitId: input.unitId,
            entityId: input.entityId,
            role: input.role,
            sortOrder: input.sortOrder ?? 0,
          })
          .returning();
        if (!row) throw new Error("Failed to create CreditAttribution");
        await writeEditorialMetadataHistory(metadataTx, {
          unitId: input.unitId,
          actorUserId: actor.userId,
          patch: {
            credits: {
              [patchPath.slice("credits.".length)]: [
                {
                  entityId: input.entityId,
                  role: input.role,
                  sortOrder: input.sortOrder ?? 0,
                },
              ],
            },
          },
          message: "credit-attribution.link",
        });
        return hydrateOne(tx, row);
      });
    },

    async delete(input) {
      const db = await getServerDb();
      const patchPath = creditRolePatchPath(input.role);
      if (!input.actor) {
        await db
          .delete(CreditAttribution)
          .where(
            and(
              eq(CreditAttribution.unitId, input.unitId),
              eq(CreditAttribution.entityId, input.entityId),
              eq(CreditAttribution.role, input.role),
            ),
          );
        return;
      }

      await db.transaction(async (tx) => {
        const metadataTx = createDrizzleCollaborativeMetadataTx(tx);
        await assertCanEditCollaborativeMetadata(
          metadataTx,
          input.actor!,
          input.unitId,
          [patchPath],
        );
        await tx
          .delete(CreditAttribution)
          .where(
            and(
              eq(CreditAttribution.unitId, input.unitId),
              eq(CreditAttribution.entityId, input.entityId),
              eq(CreditAttribution.role, input.role),
            ),
          );
        await writeEditorialMetadataHistory(metadataTx, {
          unitId: input.unitId,
          actorUserId: input.actor!.userId,
          patch: { $unset: [patchPath] },
          message: "credit-attribution.unlink",
        });
      });
    },

    async listByUnit(unitId) {
      const db = await getServerDb();
      const rows = await db
        .select()
        .from(CreditAttribution)
        .where(eq(CreditAttribution.unitId, unitId))
        .orderBy(asc(CreditAttribution.role), asc(CreditAttribution.sortOrder));
      return hydrateRows(db, rows);
    },

    async createEvidence(input) {
      const db = await getServerDb();
      const [existing] = await db
        .select({
          unitId: CreditAttribution.unitId,
          entityId: CreditAttribution.entityId,
          role: CreditAttribution.role,
          sortOrder: CreditAttribution.sortOrder,
        })
        .from(CreditAttribution)
        .where(
          and(
            eq(CreditAttribution.unitId, input.unitId),
            eq(CreditAttribution.entityId, input.entityId),
            eq(CreditAttribution.role, input.role),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("CreditAttribution not found");

      const [sourceRef] = await db
        .select({ id: UnitExternalRef.id })
        .from(UnitExternalRef)
        .where(eq(UnitExternalRef.id, input.sourceRefId))
        .limit(1);
      if (!sourceRef) throw new Error("UnitExternalRef not found");

      await db.insert(CreditAttributionEvidence).values({
        unitId: input.unitId,
        entityId: input.entityId,
        role: input.role,
        sourceRefId: input.sourceRefId,
        claimPath: input.claimPath ?? null,
        observedUrl: input.observedUrl ?? null,
        observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
        confidence: input.confidence ?? null,
        updatedAt: new Date(),
      });

      return hydrateOne(db, existing);
    },
  };
}

const defaultRepository = createDrizzleCreditAttributionRepository();

export class CreditAttributionService {
  constructor(
    private readonly repository: CreditAttributionRepository = defaultRepository,
  ) {}

  private async assertCreditEligibility(req: LinkCreditAttributionInput) {
    const entity = await this.repository.getCreditEntity(req.entityId);

    if (!entity) {
      throw new AppError(404, "Credit Entity not found", {
        code: "credit_entity_not_found",
        details: { entityId: req.entityId },
      });
    }

    if (!entity.eligibleCreditRoles.includes(req.role)) {
      throw new AppError(400, "Entity is not eligible for credit role", {
        code: "credit_entity_role_ineligible",
        details: { entityId: req.entityId, role: req.role },
      });
    }
  }

  async link(
    req: LinkCreditAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<CreditAttributionDTO> {
    const patchPath = creditRolePatchPath(req.role);
    await this.assertCreditEligibility(req);

    const row = await this.repository.create(req, actor);
    await enqueueContentCreditsSync(req.unitId);
    return mapCreditAttributionToDTO(row);
  }

  async unlink(
    unitId: string,
    entityId: string,
    role: string,
    actor?: RezicsSessionClaims,
  ): Promise<void> {
    await this.repository.delete({
      unitId,
      entityId,
      role,
      actor,
    });
    await enqueueContentCreditsSync(unitId);
  }

  async listByUnit(unitId: string): Promise<CreditAttributionDTO[]> {
    const rows = await this.repository.listByUnit(unitId);
    return rows.map(mapCreditAttributionToDTO);
  }

  async createEvidence(
    input: CreateCreditAttributionEvidenceInput,
  ): Promise<CreditAttributionDTO> {
    const row = await this.repository.createEvidence(input);
    return mapCreditAttributionToDTO(row);
  }
}

export const creditAttributionService = new CreditAttributionService();
