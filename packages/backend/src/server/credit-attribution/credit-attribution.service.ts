import type {
  CreateCreditAttributionEvidenceInput,
  CreditAttributionDTO,
  LinkCreditAttributionInput,
  RezicsSessionClaims,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/contract/job";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  Unit,
  UnitExternalLink,
  UnitTranslation,
} from "../db/schema";
import { serverJobProducer } from "../job/job-boundary";
import { generateBetween } from "../shelf/fractional-index";
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

async function nextCreditAttributionPosition(
  db: Pick<CreditAttributionTx, "select">,
  input: Pick<LinkCreditAttributionInput, "unitId" | "role">,
): Promise<string> {
  const [last] = await db
    .select({ position: CreditAttribution.position })
    .from(CreditAttribution)
    .where(
      and(
        eq(CreditAttribution.unitId, input.unitId),
        eq(CreditAttribution.role, input.role),
      ),
    )
    .orderBy(desc(CreditAttribution.position), desc(CreditAttribution.entityId))
    .limit(1);
  return generateBetween(last?.position, undefined);
}

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

  const sourceExternalLinkIds = unique(
    evidenceRows.map((row) => row.sourceExternalLinkId),
  );
  const sourceExternalLinks =
    sourceExternalLinkIds.length > 0
      ? await db
          .select()
          .from(UnitExternalLink)
          .where(sqlIn(UnitExternalLink.id, sourceExternalLinkIds))
      : [];
  const sourceEntityUnitIds = unique(
    sourceExternalLinks.map((row) => row.sourceEntityUnitId),
  );
  const [sourceEntities, sourceEntityUnits, sourceEntityTranslations] =
    sourceEntityUnitIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(Entity)
            .where(sqlIn(Entity.unitId, sourceEntityUnitIds)),
          db.select().from(Unit).where(sqlIn(Unit.id, sourceEntityUnitIds)),
          db
            .select()
            .from(UnitTranslation)
            .where(sqlIn(UnitTranslation.unitId, sourceEntityUnitIds)),
        ])
      : [[], [], []];

  const unitById = new Map(entityUnits.map((unit) => [unit.id, unit]));
  const entityById = new Map(entities.map((entity) => [entity.unitId, entity]));
  const translationsByUnitId = new Map<string, typeof translations>();
  for (const translation of translations) {
    const list = translationsByUnitId.get(translation.unitId) ?? [];
    list.push(translation);
    translationsByUnitId.set(translation.unitId, list);
  }

  const sourceExternalLinkById = new Map(
    sourceExternalLinks.map((link) => [link.id, link]),
  );
  const sourceEntityById = new Map(
    sourceEntities.map((entity) => [entity.unitId, entity]),
  );
  const sourceEntityUnitById = new Map(
    sourceEntityUnits.map((unit) => [unit.id, unit]),
  );
  const sourceEntityTranslationsByUnitId = new Map<
    string,
    typeof sourceEntityTranslations
  >();
  for (const translation of sourceEntityTranslations) {
    const list = sourceEntityTranslationsByUnitId.get(translation.unitId) ?? [];
    list.push(translation);
    sourceEntityTranslationsByUnitId.set(translation.unitId, list);
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
      const sourceExternalLink = sourceExternalLinkById.get(
        evidence.sourceExternalLinkId,
      );
      const sourceEntity = sourceExternalLink
        ? sourceEntityById.get(sourceExternalLink.sourceEntityUnitId)
        : undefined;
      const sourceEntityUnit = sourceExternalLink
        ? sourceEntityUnitById.get(sourceExternalLink.sourceEntityUnitId)
        : undefined;
      return {
        ...evidence,
        sourceExternalLink: sourceExternalLink
          ? {
              ...sourceExternalLink,
              sourceEntity: sourceEntity
                ? {
                    ...sourceEntity,
                    unit: sourceEntityUnit
                      ? {
                          ...sourceEntityUnit,
                          translations:
                            sourceEntityTranslationsByUnitId.get(
                              sourceEntityUnit.id,
                            ) ?? [],
                        }
                      : undefined,
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
        const position =
          input.position ?? (await nextCreditAttributionPosition(db, input));
        const [row] = await db
          .insert(CreditAttribution)
          .values({
            unitId: input.unitId,
            entityId: input.entityId,
            role: input.role,
            position,
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
            position:
              input.position ??
              (await nextCreditAttributionPosition(tx, input)),
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
                  position: row.position,
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
        .orderBy(
          asc(CreditAttribution.role),
          asc(CreditAttribution.position),
          asc(CreditAttribution.entityId),
        );
      return hydrateRows(db, rows);
    },

    async createEvidence(input) {
      const db = await getServerDb();
      const [existing] = await db
        .select({
          unitId: CreditAttribution.unitId,
          entityId: CreditAttribution.entityId,
          role: CreditAttribution.role,
          position: CreditAttribution.position,
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

      const [sourceExternalLink] = await db
        .select({ id: UnitExternalLink.id, unitId: UnitExternalLink.unitId })
        .from(UnitExternalLink)
        .where(eq(UnitExternalLink.id, input.sourceExternalLinkId))
        .limit(1);
      if (!sourceExternalLink) throw new Error("UnitExternalLink not found");
      if (sourceExternalLink.unitId !== input.unitId) {
        throw new Error(
          "CreditAttributionEvidence sourceExternalLinkId must reference the same Unit",
        );
      }

      await db.insert(CreditAttributionEvidence).values({
        unitId: input.unitId,
        entityId: input.entityId,
        role: input.role,
        sourceExternalLinkId: input.sourceExternalLinkId,
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
