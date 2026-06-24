import type {
  CreditAttributionDTO,
  EntityAttributionBatchOp,
  EntityAttributionBatchRequest,
  EntityAttributionBatchResponse,
  EntityAttributionBatchSetCreditsOp,
  EntityAttributionBatchSetSubjectsOp,
  RezicsSessionClaims,
  SubjectAttributionDTO,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { creditAttributionService } from "../credit-attribution/credit-attribution.service";
import { CreditAttribution, Entity, SubjectAttribution } from "../db/schema";
import { serverJobProducer } from "../job/job-boundary";
import { rebalance } from "../shelf/fractional-index";
import { subjectAttributionService } from "../subject-attribution/subject-attribution.service";
import {
  assertCanEditCollaborativeMetadata,
  createDrizzleCollaborativeMetadataTx,
  creditRolePatchPath,
  writeEditorialMetadataHistory,
} from "../unit/collaborative-metadata";
import { AppError } from "../utils/errors";

type CreditEntry = {
  entityId: string;
  position: string;
};

type SubjectEntry = CreditEntry & {
  weight: number | null;
};

type ReconcileResult = {
  changed: boolean;
  patchPath: string;
  patchValue: unknown[];
};

function enqueueContentAttribution(
  kind: "credits" | "subjects",
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      kind === "credits"
        ? SEARCH_COMMAND_KINDS.contentPatchCredits
        : SEARCH_COMMAND_KINDS.contentPatchSubjects,
      { unitId },
      { type: "server", service: "entity-attribution" },
    ),
  );
}

export function entityAttributionBatchPatchPaths(
  ops: readonly EntityAttributionBatchOp[],
): string[] {
  return [
    ...new Set(
      ops.map((op) =>
        op.op === "setCredits"
          ? creditRolePatchPath(op.role)
          : `subjects.${op.role}`,
      ),
    ),
  ];
}

function assertNoDuplicateEntities(
  op: EntityAttributionBatchOp,
  entries: readonly { entityId: string }[],
): void {
  const seen = new Set<string>();
  const duplicate = entries.find((entry) => {
    if (seen.has(entry.entityId)) return true;
    seen.add(entry.entityId);
    return false;
  });

  if (!duplicate) return;

  throw new AppError(
    400,
    "Entity attribution batch contains duplicate entity",
    {
      code: "entity_attribution_duplicate_entity",
      details: { op: op.op, role: op.role, entityId: duplicate.entityId },
    },
  );
}

function normalizeCreditEntries(
  op: EntityAttributionBatchSetCreditsOp,
): CreditEntry[] {
  assertNoDuplicateEntities(op, op.entries);
  const positions = rebalance(op.entries.length);
  return op.entries.map((entry, index) => ({
    entityId: entry.entityId,
    position: entry.position ?? positions[index]!,
  }));
}

function normalizeSubjectEntries(
  op: EntityAttributionBatchSetSubjectsOp,
): SubjectEntry[] {
  assertNoDuplicateEntities(op, op.entries);
  const positions = rebalance(op.entries.length);
  return op.entries.map((entry, index) => ({
    entityId: entry.entityId,
    position: entry.position ?? positions[index]!,
    weight: entry.weight ?? null,
  }));
}

function sameCreditSet(
  rows: readonly { entityId: string; position: string }[],
  entries: readonly CreditEntry[],
): boolean {
  if (rows.length !== entries.length) return false;
  return entries.every((entry) =>
    rows.some(
      (row) =>
        row.entityId === entry.entityId && row.position === entry.position,
    ),
  );
}

function sameSubjectSet(
  rows: readonly {
    entityId: string;
    position: string;
    weight: number | null;
  }[],
  entries: readonly SubjectEntry[],
): boolean {
  if (rows.length !== entries.length) return false;
  return entries.every((entry) =>
    rows.some(
      (row) =>
        row.entityId === entry.entityId &&
        row.position === entry.position &&
        (row.weight ?? null) === entry.weight,
    ),
  );
}

async function assertCreditEligibility(
  repository: EntityAttributionBatchRepository,
  role: string,
  entries: readonly CreditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const entityIds = entries.map((entry) => entry.entityId);
  const entities = await repository.listCreditEligibility(entityIds);
  const byId = new Map(
    entities.map((entity) => [
      entity.unitId,
      { ...entity, eligibleCreditRoles: entity.eligibleCreditRoles ?? [] },
    ]),
  );

  for (const entityId of entityIds) {
    const entity = byId.get(entityId);
    if (!entity) {
      throw new AppError(404, "Credit Entity not found", {
        code: "credit_entity_not_found",
        details: { entityId },
      });
    }
    if (!entity.eligibleCreditRoles.includes(role)) {
      throw new AppError(400, "Entity is not eligible for credit role", {
        code: "credit_entity_role_ineligible",
        details: { entityId, role },
      });
    }
  }
}

async function assertSubjectEligibility(
  repository: EntityAttributionBatchRepository,
  role: string,
  entries: readonly SubjectEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const entityIds = entries.map((entry) => entry.entityId);
  const entities = await repository.listSubjectEligibility(entityIds);
  const byId = new Map(
    entities.map((entity) => [
      entity.unitId,
      { ...entity, eligibleSubjectRoles: entity.eligibleSubjectRoles ?? [] },
    ]),
  );

  for (const entityId of entityIds) {
    const entity = byId.get(entityId);
    if (!entity) {
      throw new AppError(404, "Subject Entity not found", {
        code: "subject_entity_not_found",
        details: { entityId },
      });
    }
    if (!entity.eligibleSubjectRoles.includes(role)) {
      throw new AppError(400, "Entity is not eligible for subject role", {
        code: "subject_entity_role_ineligible",
        details: { entityId, role },
      });
    }
  }
}

async function reconcileCredits(
  repository: EntityAttributionBatchRepository,
  unitId: string,
  op: EntityAttributionBatchSetCreditsOp,
): Promise<ReconcileResult> {
  const entries = normalizeCreditEntries(op);
  await assertCreditEligibility(repository, op.role, entries);

  const existing = await repository.listCreditRows(unitId, op.role);
  const changed = !sameCreditSet(existing, entries);

  if (changed) {
    await repository.replaceCredits(unitId, op.role, entries);
  }

  return {
    changed,
    patchPath: creditRolePatchPath(op.role),
    patchValue: entries.map((entry) => ({ ...entry, role: op.role })),
  };
}

async function reconcileSubjects(
  repository: EntityAttributionBatchRepository,
  unitId: string,
  op: EntityAttributionBatchSetSubjectsOp,
): Promise<ReconcileResult> {
  const entries = normalizeSubjectEntries(op);
  await assertSubjectEligibility(repository, op.role, entries);

  const existing = await repository.listSubjectRows(unitId, op.role);
  const changed = !sameSubjectSet(existing, entries);

  if (changed) {
    await repository.replaceSubjects(unitId, op.role, entries);
  }

  return {
    changed,
    patchPath: `subjects.${op.role}`,
    patchValue: entries.map((entry) => ({ ...entry, role: op.role })),
  };
}

function appendSparsePatch(
  patch: Record<string, unknown>,
  result: ReconcileResult,
): void {
  const [root, leaf] = result.patchPath.split(".");
  if (!root || !leaf) return;
  const rootPatch = (patch[root] ?? {}) as Record<string, unknown>;
  rootPatch[leaf] = result.patchValue;
  patch[root] = rootPatch;
}

type EligibilityRow = {
  unitId: string;
  eligibleCreditRoles?: string[];
  eligibleSubjectRoles?: string[];
};

export interface EntityAttributionBatchRepository {
  listCreditEligibility(
    entityIds: readonly string[],
  ): Promise<EligibilityRow[]>;
  listSubjectEligibility(
    entityIds: readonly string[],
  ): Promise<EligibilityRow[]>;
  listCreditRows(
    unitId: string,
    role: string,
  ): Promise<Array<{ entityId: string; position: string }>>;
  listSubjectRows(
    unitId: string,
    role: string,
  ): Promise<
    Array<{ entityId: string; position: string; weight: number | null }>
  >;
  replaceCredits(
    unitId: string,
    role: string,
    entries: readonly CreditEntry[],
  ): Promise<void>;
  replaceSubjects(
    unitId: string,
    role: string,
    entries: readonly SubjectEntry[],
  ): Promise<void>;
  assertCanEdit(
    actor: RezicsSessionClaims,
    unitId: string,
    patchPaths: readonly string[],
  ): Promise<void>;
  writeHistory(input: {
    unitId: string;
    actorUserId: string;
    patch: Record<string, unknown>;
    message: string;
  }): Promise<void>;
  loadState(unitId: string): Promise<{
    credits: CreditAttributionDTO[];
    subjects: SubjectAttributionDTO[];
  }>;
  transaction<T>(
    callback: (repository: EntityAttributionBatchRepository) => Promise<T>,
  ): Promise<T>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleEntityAttributionBatchRepository(
  tx?: any,
): EntityAttributionBatchRepository {
  async function database() {
    return tx ?? (await getServerDb());
  }

  return {
    async listCreditEligibility(entityIds) {
      if (entityIds.length === 0) return [];
      const db = await database();
      return db
        .select({
          unitId: Entity.unitId,
          eligibleCreditRoles: Entity.eligibleCreditRoles,
        })
        .from(Entity)
        .where(inArray(Entity.unitId, [...entityIds]));
    },

    async listSubjectEligibility(entityIds) {
      if (entityIds.length === 0) return [];
      const db = await database();
      return db
        .select({
          unitId: Entity.unitId,
          eligibleSubjectRoles: Entity.eligibleSubjectRoles,
        })
        .from(Entity)
        .where(inArray(Entity.unitId, [...entityIds]));
    },

    async listCreditRows(unitId, role) {
      const db = await database();
      return db
        .select({
          entityId: CreditAttribution.entityId,
          position: CreditAttribution.position,
        })
        .from(CreditAttribution)
        .where(
          and(
            eq(CreditAttribution.unitId, unitId),
            eq(CreditAttribution.role, role),
          ),
        );
    },

    async listSubjectRows(unitId, role) {
      const db = await database();
      return db
        .select({
          entityId: SubjectAttribution.entityId,
          position: SubjectAttribution.position,
          weight: SubjectAttribution.weight,
        })
        .from(SubjectAttribution)
        .where(
          and(
            eq(SubjectAttribution.unitId, unitId),
            eq(SubjectAttribution.role, role),
          ),
        );
    },

    async replaceCredits(unitId, role, entries) {
      const db = await database();
      const keepEntityIds = entries.map((entry) => entry.entityId);
      await db
        .delete(CreditAttribution)
        .where(
          and(
            eq(CreditAttribution.unitId, unitId),
            eq(CreditAttribution.role, role),
            keepEntityIds.length > 0
              ? notInArray(CreditAttribution.entityId, keepEntityIds)
              : undefined,
          ),
        );
      for (const entry of entries) {
        await db
          .insert(CreditAttribution)
          .values({
            unitId,
            entityId: entry.entityId,
            role,
            position: entry.position,
          })
          .onConflictDoUpdate({
            target: [
              CreditAttribution.unitId,
              CreditAttribution.entityId,
              CreditAttribution.role,
            ],
            set: { position: entry.position },
          });
      }
    },

    async replaceSubjects(unitId, role, entries) {
      const db = await database();
      const keepEntityIds = entries.map((entry) => entry.entityId);
      await db
        .delete(SubjectAttribution)
        .where(
          and(
            eq(SubjectAttribution.unitId, unitId),
            eq(SubjectAttribution.role, role),
            keepEntityIds.length > 0
              ? notInArray(SubjectAttribution.entityId, keepEntityIds)
              : undefined,
          ),
        );
      for (const entry of entries) {
        await db
          .insert(SubjectAttribution)
          .values({
            unitId,
            entityId: entry.entityId,
            role,
            position: entry.position,
            weight: entry.weight,
          })
          .onConflictDoUpdate({
            target: [
              SubjectAttribution.unitId,
              SubjectAttribution.entityId,
              SubjectAttribution.role,
            ],
            set: { position: entry.position, weight: entry.weight },
          });
      }
    },

    async assertCanEdit(actor, unitId, patchPaths) {
      const db = await database();
      await assertCanEditCollaborativeMetadata(
        createDrizzleCollaborativeMetadataTx(db),
        actor,
        unitId,
        patchPaths,
      );
    },

    async writeHistory(input) {
      const db = await database();
      await writeEditorialMetadataHistory(
        createDrizzleCollaborativeMetadataTx(db),
        {
          unitId: input.unitId,
          actorUserId: input.actorUserId,
          patch: input.patch,
          message: input.message,
        },
      );
    },

    async loadState(unitId) {
      const [credits, subjects] = await Promise.all([
        creditAttributionService.listByUnit(unitId),
        subjectAttributionService.listByUnit(unitId),
      ]);
      return { credits, subjects };
    },

    async transaction(callback) {
      const db = await getServerDb();
      return db.transaction((inner) =>
        callback(createDrizzleEntityAttributionBatchRepository(inner)),
      );
    },
  };
}

const defaultRepository = createDrizzleEntityAttributionBatchRepository();

export class EntityAttributionBatchService {
  constructor(
    private readonly repository: EntityAttributionBatchRepository = defaultRepository,
  ) {}

  async batchUpdate(
    unitId: string,
    request: EntityAttributionBatchRequest,
    actor?: RezicsSessionClaims,
  ): Promise<EntityAttributionBatchResponse> {
    if (!actor) {
      throw new AppError(401, "Login is required to edit entity attributions", {
        code: "entity_attribution_login_required",
      });
    }

    const patchPaths = entityAttributionBatchPatchPaths(request.ops);
    let touchedCredits = false;
    let touchedSubjects = false;

    const result = await this.repository.transaction(async (repository) => {
      if (patchPaths.length > 0) {
        await repository.assertCanEdit(actor, unitId, patchPaths);
      }

      const patch: Record<string, unknown> = {};
      let changed = false;

      for (const op of request.ops) {
        if (op.op === "setCredits") {
          touchedCredits = true;
          const opResult = await reconcileCredits(repository, unitId, op);
          if (opResult.changed) {
            changed = true;
            appendSparsePatch(patch, opResult);
          }
          continue;
        }

        touchedSubjects = true;
        const opResult = await reconcileSubjects(repository, unitId, op);
        if (opResult.changed) {
          changed = true;
          appendSparsePatch(patch, opResult);
        }
      }

      if (changed) {
        await repository.writeHistory({
          unitId,
          actorUserId: actor.userId,
          patch,
          message: request.message ?? "entity-attribution.batch",
        });
      }

      return { changed };
    });

    if (result.changed) {
      await Promise.all([
        touchedCredits
          ? enqueueContentAttribution("credits", unitId)
          : undefined,
        touchedSubjects
          ? enqueueContentAttribution("subjects", unitId)
          : undefined,
      ]);
    }

    const state = await this.repository.loadState(unitId);
    return { unitId, ...result, ...state };
  }
}

export const entityAttributionBatchService =
  new EntityAttributionBatchService();
