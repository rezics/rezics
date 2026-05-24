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
import { prisma } from "#/prisma/client";
import {
  patchContentCreditsToMeili,
  patchContentSubjectsToMeili,
} from "@/meili/content/sync";
import {
  assertCanEditCollaborativeMetadata,
  creditRolePatchPath,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { AppError } from "@/utils/errors";
import { mapCreditAttributionToDTO } from "@/credit-attribution/credit-attribution.mapper";
import { creditAttributionInclude } from "@/credit-attribution/types";
import { mapSubjectAttributionToDTO } from "@/subject-attribution/subject-attribution.mapper";
import { subjectAttributionInclude } from "@/subject-attribution/types";

type BatchTx = any;

type CreditEntry = {
  entityId: string;
  sortOrder: number;
};

type SubjectEntry = CreditEntry & {
  weight: number | null;
};

type ReconcileResult = {
  changed: boolean;
  patchPath: string;
  patchValue: unknown[];
};

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
  return op.entries.map((entry, index) => ({
    entityId: entry.entityId,
    sortOrder: entry.sortOrder ?? index,
  }));
}

function normalizeSubjectEntries(
  op: EntityAttributionBatchSetSubjectsOp,
): SubjectEntry[] {
  assertNoDuplicateEntities(op, op.entries);
  return op.entries.map((entry, index) => ({
    entityId: entry.entityId,
    sortOrder: entry.sortOrder ?? index,
    weight: entry.weight ?? null,
  }));
}

function sameCreditSet(
  rows: readonly { entityId: string; sortOrder: number }[],
  entries: readonly CreditEntry[],
): boolean {
  if (rows.length !== entries.length) return false;
  return entries.every((entry) =>
    rows.some(
      (row) =>
        row.entityId === entry.entityId && row.sortOrder === entry.sortOrder,
    ),
  );
}

function sameSubjectSet(
  rows: readonly {
    entityId: string;
    sortOrder: number;
    weight: number | null;
  }[],
  entries: readonly SubjectEntry[],
): boolean {
  if (rows.length !== entries.length) return false;
  return entries.every((entry) =>
    rows.some(
      (row) =>
        row.entityId === entry.entityId &&
        row.sortOrder === entry.sortOrder &&
        (row.weight ?? null) === entry.weight,
    ),
  );
}

async function assertCreditEligibility(
  tx: BatchTx,
  role: string,
  entries: readonly CreditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const entityIds = entries.map((entry) => entry.entityId);
  const entities = await tx.entity.findMany({
    where: { unitId: { in: entityIds } },
    select: { unitId: true, eligibleCreditRoles: true },
  });
  const byId = new Map<
    string,
    { unitId: string; eligibleCreditRoles: string[] }
  >(
    entities.map(
      (entity: { unitId: string; eligibleCreditRoles: string[] }) => [
        entity.unitId,
        entity,
      ],
    ),
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
  tx: BatchTx,
  role: string,
  entries: readonly SubjectEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const entityIds = entries.map((entry) => entry.entityId);
  const entities = await tx.entity.findMany({
    where: { unitId: { in: entityIds } },
    select: { unitId: true, eligibleSubjectRoles: true },
  });
  const byId = new Map<
    string,
    { unitId: string; eligibleSubjectRoles: string[] }
  >(
    entities.map(
      (entity: { unitId: string; eligibleSubjectRoles: string[] }) => [
        entity.unitId,
        entity,
      ],
    ),
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
  tx: BatchTx,
  unitId: string,
  op: EntityAttributionBatchSetCreditsOp,
): Promise<ReconcileResult> {
  const entries = normalizeCreditEntries(op);
  await assertCreditEligibility(tx, op.role, entries);

  const existing = await tx.creditAttribution.findMany({
    where: { unitId, role: op.role },
    select: { entityId: true, sortOrder: true },
  });
  const changed = !sameCreditSet(existing, entries);

  if (changed) {
    const keepEntityIds = entries.map((entry) => entry.entityId);
    await tx.creditAttribution.deleteMany({
      where: {
        unitId,
        role: op.role,
        ...(keepEntityIds.length > 0
          ? { entityId: { notIn: keepEntityIds } }
          : {}),
      },
    });
    for (const entry of entries) {
      await tx.creditAttribution.upsert({
        where: {
          unitId_entityId_role: {
            unitId,
            entityId: entry.entityId,
            role: op.role,
          },
        },
        create: {
          unitId,
          entityId: entry.entityId,
          role: op.role,
          sortOrder: entry.sortOrder,
        },
        update: { sortOrder: entry.sortOrder },
      });
    }
  }

  return {
    changed,
    patchPath: creditRolePatchPath(op.role),
    patchValue: entries.map((entry) => ({ ...entry, role: op.role })),
  };
}

async function reconcileSubjects(
  tx: BatchTx,
  unitId: string,
  op: EntityAttributionBatchSetSubjectsOp,
): Promise<ReconcileResult> {
  const entries = normalizeSubjectEntries(op);
  await assertSubjectEligibility(tx, op.role, entries);

  const existing = await tx.subjectAttribution.findMany({
    where: { unitId, role: op.role },
    select: { entityId: true, sortOrder: true, weight: true },
  });
  const changed = !sameSubjectSet(existing, entries);

  if (changed) {
    const keepEntityIds = entries.map((entry) => entry.entityId);
    await tx.subjectAttribution.deleteMany({
      where: {
        unitId,
        role: op.role,
        ...(keepEntityIds.length > 0
          ? { entityId: { notIn: keepEntityIds } }
          : {}),
      },
    });
    for (const entry of entries) {
      await tx.subjectAttribution.upsert({
        where: {
          unitId_entityId_role: {
            unitId,
            entityId: entry.entityId,
            role: op.role,
          },
        },
        create: {
          unitId,
          entityId: entry.entityId,
          role: op.role,
          sortOrder: entry.sortOrder,
          weight: entry.weight,
        },
        update: { sortOrder: entry.sortOrder, weight: entry.weight },
      });
    }
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

async function loadBatchResponseState(
  tx: BatchTx,
  unitId: string,
): Promise<{
  credits: CreditAttributionDTO[];
  subjects: SubjectAttributionDTO[];
}> {
  const [credits, subjects] = await Promise.all([
    tx.creditAttribution.findMany({
      where: { unitId },
      include: creditAttributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    }),
    tx.subjectAttribution.findMany({
      where: { unitId },
      include: subjectAttributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  return {
    credits: credits.map(mapCreditAttributionToDTO),
    subjects: subjects.map(mapSubjectAttributionToDTO),
  };
}

export class EntityAttributionBatchService {
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

    const result = await prisma.$transaction(async (tx) => {
      if (patchPaths.length > 0) {
        await assertCanEditCollaborativeMetadata(
          tx as never,
          actor,
          unitId,
          patchPaths,
        );
      }

      const patch: Record<string, unknown> = {};
      let changed = false;

      for (const op of request.ops) {
        if (op.op === "setCredits") {
          touchedCredits = true;
          const opResult = await reconcileCredits(tx, unitId, op);
          if (opResult.changed) {
            changed = true;
            appendSparsePatch(patch, opResult);
          }
          continue;
        }

        touchedSubjects = true;
        const opResult = await reconcileSubjects(tx, unitId, op);
        if (opResult.changed) {
          changed = true;
          appendSparsePatch(patch, opResult);
        }
      }

      if (changed) {
        await writeEditorialMetadataHistory(tx as never, {
          unitId,
          actorUserId: actor.userId,
          patch,
          message: request.message ?? "entity-attribution.batch",
        });
      }

      const state = await loadBatchResponseState(tx, unitId);
      return { changed, ...state };
    });

    if (result.changed) {
      await Promise.all([
        touchedCredits ? patchContentCreditsToMeili(unitId) : undefined,
        touchedSubjects ? patchContentSubjectsToMeili(unitId) : undefined,
      ]);
    }

    return { unitId, ...result };
  }
}

export const entityAttributionBatchService =
  new EntityAttributionBatchService();
