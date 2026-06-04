import type {
  LinkSubjectAttributionInput,
  RezicsSessionClaims,
  SubjectAttributionBySubjectQuery,
  SubjectAttributionByUnitQuery,
  SubjectAttributionDTO,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { serverJobProducer } from "../job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  createDrizzleCollaborativeMetadataTx,
  writeEditorialMetadataHistory,
} from "../unit/collaborative-metadata";
import {
  Entity,
  SubjectAttribution,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import { AppError } from "../utils/errors";
import { mapSubjectAttributionToDTO } from "./subject-attribution.mapper";
import type { SubjectAttributionWithRelations } from "./types";

function enqueueContentSubjects(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchSubjects,
      { unitId },
      { type: "server", service: "subject-attribution" },
    ),
  );
}

type EntityUnitProbe = { id: string; type: string };
type SubjectEntityProbe = { eligibleSubjectRoles: string[] };
type SubjectAttributionRow = typeof SubjectAttribution.$inferSelect;
type SubjectAttributionTx = Awaited<ReturnType<typeof getServerDb>>;

export interface SubjectAttributionRepository {
  getEntityUnit(entityId: string): Promise<EntityUnitProbe | null>;
  getSubjectEntity(entityId: string): Promise<SubjectEntityProbe | null>;
  create(
    input: LinkSubjectAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<SubjectAttributionWithRelations>;
  delete(input: {
    unitId: string;
    entityId: string;
    role: string;
    actor?: RezicsSessionClaims;
  }): Promise<void>;
  listByUnit(
    unitId: string,
    query: SubjectAttributionByUnitQuery,
  ): Promise<SubjectAttributionWithRelations[]>;
  listBySubject(
    entityId: string,
    query: SubjectAttributionBySubjectQuery,
  ): Promise<SubjectAttributionWithRelations[]>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

async function hydrateRows(
  db: Pick<SubjectAttributionTx, "select">,
  rows: SubjectAttributionRow[],
): Promise<SubjectAttributionWithRelations[]> {
  if (rows.length === 0) return [];
  const entityIds = unique(rows.map((row) => row.entityId));
  const unitIds = unique(rows.map((row) => row.unitId));
  const allUnitIds = unique([...entityIds, ...unitIds]);

  const [units, entities, translations, supportLanguages] = await Promise.all([
    db.select().from(Unit).where(sqlIn(Unit.id, allUnitIds)),
    db.select().from(Entity).where(sqlIn(Entity.unitId, entityIds)),
    db
      .select()
      .from(UnitTranslation)
      .where(sqlIn(UnitTranslation.unitId, allUnitIds)),
    db
      .select()
      .from(UnitSupportLanguage)
      .where(sqlIn(UnitSupportLanguage.unitId, unitIds)),
  ]);

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const entityById = new Map(entities.map((entity) => [entity.unitId, entity]));
  const translationsByUnitId = new Map<string, typeof translations>();
  for (const translation of translations) {
    const list = translationsByUnitId.get(translation.unitId) ?? [];
    list.push(translation);
    translationsByUnitId.set(translation.unitId, list);
  }
  const supportByUnitId = new Map<string, typeof supportLanguages>();
  for (const language of supportLanguages) {
    const list = supportByUnitId.get(language.unitId) ?? [];
    list.push(language);
    supportByUnitId.set(language.unitId, list);
  }

  return rows.map((row) => {
    const entityUnit = unitById.get(row.entityId);
    const unit = unitById.get(row.unitId);
    if (!entityUnit || !unit) {
      throw new Error("SubjectAttribution relation hydration failed");
    }
    return {
      ...row,
      entity: {
        ...entityUnit,
        entity: entityById.get(row.entityId) ?? null,
        translations: translationsByUnitId.get(row.entityId) ?? [],
      },
      unit: {
        ...unit,
        translations: translationsByUnitId.get(row.unitId) ?? [],
        supportLanguages: supportByUnitId.get(row.unitId) ?? [],
      },
    };
  });
}

function sqlIn(column: any, values: readonly string[]): SQL {
  return values.length === 1
    ? eq(column, values[0]!)
    : inArray(column, [...values]);
}

function createDrizzleSubjectAttributionRepository(): SubjectAttributionRepository {
  async function hydrateOne(
    db: Pick<SubjectAttributionTx, "select">,
    row: SubjectAttributionRow,
  ) {
    return (await hydrateRows(db, [row]))[0]!;
  }

  return {
    async getEntityUnit(entityId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(eq(Unit.id, entityId))
        .limit(1);
      return unit ?? null;
    },

    async getSubjectEntity(entityId) {
      const db = await getServerDb();
      const [entity] = await db
        .select({ eligibleSubjectRoles: Entity.eligibleSubjectRoles })
        .from(Entity)
        .where(eq(Entity.unitId, entityId))
        .limit(1);
      return entity ?? null;
    },

    async create(input, actor) {
      const db = await getServerDb();
      if (!actor) {
        const [row] = await db
          .insert(SubjectAttribution)
          .values({
            unitId: input.unitId,
            entityId: input.entityId,
            role: input.role,
            sortOrder: input.sortOrder ?? 0,
            weight: input.weight ?? null,
          })
          .returning();
        if (!row) throw new Error("Failed to create SubjectAttribution");
        return hydrateOne(db, row);
      }

      return db.transaction(async (tx) => {
        const metadataTx = createDrizzleCollaborativeMetadataTx(tx);
        await assertCanEditCollaborativeMetadata(
          metadataTx,
          actor,
          input.unitId,
          [`subjects.${input.role}`],
        );
        const [row] = await tx
          .insert(SubjectAttribution)
          .values({
            unitId: input.unitId,
            entityId: input.entityId,
            role: input.role,
            sortOrder: input.sortOrder ?? 0,
            weight: input.weight ?? null,
          })
          .returning();
        if (!row) throw new Error("Failed to create SubjectAttribution");
        await writeEditorialMetadataHistory(metadataTx, {
          unitId: input.unitId,
          actorUserId: actor.userId,
          patch: {
            subjects: {
              [input.role]: [
                {
                  entityId: input.entityId,
                  sortOrder: input.sortOrder ?? 0,
                  weight: input.weight ?? null,
                },
              ],
            },
          },
          message: "subject-attribution.link",
        });
        return hydrateOne(tx, row);
      });
    },

    async delete(input) {
      const db = await getServerDb();
      if (!input.actor) {
        await db
          .delete(SubjectAttribution)
          .where(
            and(
              eq(SubjectAttribution.unitId, input.unitId),
              eq(SubjectAttribution.entityId, input.entityId),
              eq(SubjectAttribution.role, input.role),
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
          [`subjects.${input.role}`],
        );
        await tx
          .delete(SubjectAttribution)
          .where(
            and(
              eq(SubjectAttribution.unitId, input.unitId),
              eq(SubjectAttribution.entityId, input.entityId),
              eq(SubjectAttribution.role, input.role),
            ),
          );
        await writeEditorialMetadataHistory(metadataTx, {
          unitId: input.unitId,
          actorUserId: input.actor!.userId,
          patch: { $unset: [`subjects.${input.role}`] },
          message: "subject-attribution.unlink",
        });
      });
    },

    async listByUnit(unitId, query) {
      const db = await getServerDb();
      const filters = [
        eq(SubjectAttribution.unitId, unitId),
        query.role ? eq(SubjectAttribution.role, query.role) : undefined,
      ].filter(Boolean) as SQL[];
      const rows = await db
        .select()
        .from(SubjectAttribution)
        .where(and(...filters))
        .orderBy(
          asc(SubjectAttribution.role),
          asc(SubjectAttribution.sortOrder),
        );
      return hydrateRows(db, rows);
    },

    async listBySubject(entityId, query) {
      const db = await getServerDb();
      const filters = [
        eq(SubjectAttribution.entityId, entityId),
        query.role ? eq(SubjectAttribution.role, query.role) : undefined,
        query.unitType ? eq(Unit.type, query.unitType as never) : undefined,
        query.status ? eq(Unit.status, query.status as never) : undefined,
        query.visibility
          ? eq(Unit.visibility, query.visibility as never)
          : undefined,
      ].filter(Boolean) as SQL[];
      const rows = await db
        .select({
          unitId: SubjectAttribution.unitId,
          entityId: SubjectAttribution.entityId,
          role: SubjectAttribution.role,
          sortOrder: SubjectAttribution.sortOrder,
          weight: SubjectAttribution.weight,
        })
        .from(SubjectAttribution)
        .innerJoin(Unit, eq(Unit.id, SubjectAttribution.unitId))
        .where(and(...filters))
        .orderBy(
          asc(SubjectAttribution.role),
          asc(SubjectAttribution.sortOrder),
        );
      return hydrateRows(db, rows);
    },
  };
}

const defaultRepository = createDrizzleSubjectAttributionRepository();

export class SubjectAttributionService {
  constructor(
    private readonly repository: SubjectAttributionRepository = defaultRepository,
  ) {}

  private async assertEntityUnit(entityId: string): Promise<void> {
    const entityUnit = await this.repository.getEntityUnit(entityId);

    if (!entityUnit) {
      throw new AppError(404, "Subject Entity not found", {
        code: "subject_entity_not_found",
        details: { entityId },
      });
    }

    if (entityUnit.type !== "ENTITY") {
      throw new AppError(
        400,
        "Subject attribution entityId must reference an ENTITY Unit",
        {
          code: "subject_entity_must_be_entity_unit",
          details: { entityId, type: entityUnit.type },
        },
      );
    }
  }

  private async assertSubjectEligibility(
    req: LinkSubjectAttributionInput,
  ): Promise<void> {
    const entity = await this.repository.getSubjectEntity(req.entityId);

    if (!entity) {
      throw new AppError(404, "Subject Entity not found", {
        code: "subject_entity_not_found",
        details: { entityId: req.entityId },
      });
    }

    if (!entity.eligibleSubjectRoles.includes(req.role)) {
      throw new AppError(400, "Entity is not eligible for subject role", {
        code: "subject_entity_role_ineligible",
        details: { entityId: req.entityId, role: req.role },
      });
    }
  }

  async link(
    req: LinkSubjectAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<SubjectAttributionDTO> {
    await this.assertEntityUnit(req.entityId);
    await this.assertSubjectEligibility(req);

    const row = await this.repository.create(req, actor);
    await enqueueContentSubjects(req.unitId);
    return mapSubjectAttributionToDTO(row);
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
    await enqueueContentSubjects(unitId);
  }

  async listByUnit(
    unitId: string,
    query: SubjectAttributionByUnitQuery = {},
  ): Promise<SubjectAttributionDTO[]> {
    const rows = await this.repository.listByUnit(unitId, query);
    return rows.map(mapSubjectAttributionToDTO);
  }

  async listBySubject(
    entityId: string,
    query: SubjectAttributionBySubjectQuery = {},
  ): Promise<SubjectAttributionDTO[]> {
    await this.assertEntityUnit(entityId);

    const rows = await this.repository.listBySubject(entityId, query);
    return rows.map(mapSubjectAttributionToDTO);
  }
}

export const subjectAttributionService = new SubjectAttributionService();
