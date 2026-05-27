import {
  type AnyJobCommand,
  createSearchCommand,
  SEARCH_COMMAND_KINDS,
} from "@rezics/job";
import type {
  PrismaClient,
  UnitWorkRole,
} from "@rezics/server/prisma/generated/client";
import type { HandlerContext } from "../../worker";

type MergeMove = {
  unitId: string;
  role: UnitWorkRole;
  fromWorkUnitId: string;
  toWorkUnitId: string;
  action: "move" | "dedupe";
};

type MergeOperationRow = Awaited<
  ReturnType<PrismaClient["adminWorkMergeOperation"]["findUniqueOrThrow"]>
>;

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function tagKey(unitId: string, tagUnitId: string): string {
  return `${unitId}:${tagUnitId}`;
}

function readMoves(row: Pick<MergeOperationRow, "movedMemberships">) {
  return Array.isArray(row.movedMemberships)
    ? (row.movedMemberships as MergeMove[])
    : [];
}

function readProgress(row: Pick<MergeOperationRow, "itemProgress">) {
  return row.itemProgress && typeof row.itemProgress === "object"
    ? (row.itemProgress as Record<string, unknown>)
    : {};
}

function progressJson(value: Record<string, unknown>) {
  return value as never;
}

async function updateProgress(
  prisma: PrismaClient,
  operationId: string,
  patch: Record<string, unknown>,
) {
  const current = await prisma.adminWorkMergeOperation.findUniqueOrThrow({
    where: { id: operationId },
    select: { itemProgress: true },
  });
  return prisma.adminWorkMergeOperation.update({
    where: { id: operationId },
    data: {
      itemProgress: progressJson({
        ...readProgress(current as Pick<MergeOperationRow, "itemProgress">),
        ...patch,
      }),
    },
  });
}

async function appendMove(
  prisma: PrismaClient,
  operationId: string,
  move: MergeMove,
) {
  const current = await prisma.adminWorkMergeOperation.findUniqueOrThrow({
    where: { id: operationId },
    select: { movedMemberships: true, itemProgress: true },
  });
  const moves = readMoves(
    current as Pick<MergeOperationRow, "movedMemberships">,
  );
  await prisma.adminWorkMergeOperation.update({
    where: { id: operationId },
    data: {
      movedMemberships: [...moves, move],
      itemProgress: progressJson({
        ...readProgress(current as Pick<MergeOperationRow, "itemProgress">),
        membershipMovesCompleted: moves.length + 1,
      }),
    },
  });
}

async function applyMembershipMove(
  prisma: PrismaClient,
  operationId: string,
  move: MergeMove,
) {
  const completed = await prisma.$transaction(async (tx) => {
    const existingTarget = await tx.unitWork.findUnique({
      where: {
        unitId_workUnitId_role: {
          unitId: move.unitId,
          workUnitId: move.toWorkUnitId,
          role: move.role,
        },
      },
    });

    if (existingTarget) {
      await tx.unitWork.deleteMany({
        where: {
          unitId: move.unitId,
          workUnitId: move.fromWorkUnitId,
          role: move.role,
        },
      });
      return { ...move, action: "dedupe" as const };
    }

    await tx.unitWork.updateMany({
      where: {
        unitId: move.unitId,
        workUnitId: move.fromWorkUnitId,
        role: move.role,
      },
      data: { workUnitId: move.toWorkUnitId },
    });
    return { ...move, action: "move" as const };
  });

  await appendMove(prisma, operationId, completed);
}

async function copyMissingTags(
  prisma: PrismaClient,
  operation: MergeOperationRow,
) {
  if (!operation.copyTagsRequested) return;
  const sourceTags = await prisma.unitTag.findMany({
    where: { unitId: operation.sourceWorkUnitId },
  });
  const targetTags = await prisma.unitTag.findMany({
    where: { unitId: operation.targetWorkUnitId },
    select: { tagUnitId: true },
  });
  const targetTagIds = new Set(targetTags.map((row) => row.tagUnitId));
  const created = new Set(operation.createdTagKeys);

  for (const row of sourceTags) {
    if (targetTagIds.has(row.tagUnitId)) continue;
    const key = tagKey(operation.targetWorkUnitId, row.tagUnitId);
    if (created.has(key)) continue;
    await prisma.unitTag.create({
      data: {
        unitId: operation.targetWorkUnitId,
        tagUnitId: row.tagUnitId,
        score: row.score,
        voteCount: row.voteCount,
        pinned: row.pinned,
        position: row.position,
      },
    });
    created.add(key);
    await prisma.adminWorkMergeOperation.update({
      where: { id: operation.id },
      data: {
        createdTagKeys: [...created],
        itemProgress: progressJson({
          ...readProgress(operation),
          tagCopiesCreated: created.size,
        }),
      },
    });
  }
}

async function copyMissingAliases(
  prisma: PrismaClient,
  operation: MergeOperationRow,
) {
  if (!operation.copyAliasesRequested) return;
  const sourceAliases = await prisma.unitAlias.findMany({
    where: { unitId: operation.sourceWorkUnitId },
  });
  const targetAliases = await prisma.unitAlias.findMany({
    where: { unitId: operation.targetWorkUnitId },
    select: { normalizedValue: true },
  });
  const targetValues = new Set(targetAliases.map((row) => row.normalizedValue));
  const created = new Set(operation.createdAliasIds);

  for (const row of sourceAliases) {
    if (targetValues.has(row.normalizedValue)) continue;
    if (created.has(row.id)) continue;
    const alias = await prisma.unitAlias.create({
      data: {
        unitId: operation.targetWorkUnitId,
        value: row.value,
        normalizedValue: row.normalizedValue,
        language: row.language,
        kind: row.kind,
        status: row.status,
        score: row.score,
        voteCount: row.voteCount,
        pinned: row.pinned,
        position: row.position,
        createdById: operation.actorUserId,
        updatedById: operation.actorUserId,
      },
    });
    created.add(alias.id);
    await prisma.adminWorkMergeOperation.update({
      where: { id: operation.id },
      data: {
        createdAliasIds: [...created],
        itemProgress: progressJson({
          ...readProgress(operation),
          aliasCopiesCreated: created.size,
        }),
      },
    });
  }
}

async function enqueueRepair(
  command: AnyJobCommand,
  context: HandlerContext,
  unitIds: string[],
  postUnitIds: string[],
  workUnitIds: string[],
) {
  let count = 0;
  for (const unitId of unitIds) {
    await context.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentSync,
        { unitId },
        command.source,
      ),
    );
    count++;
  }
  for (const postId of postUnitIds) {
    await context.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId },
        command.source,
      ),
    );
    count++;
  }
  for (const targetId of workUnitIds) {
    await context.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentSyncWorkReleases,
        { targetId },
        command.source,
      ),
    );
    count++;
  }
  return count;
}

export async function executeAdminWorkMerge(
  prisma: PrismaClient,
  operationId: string,
  command: AnyJobCommand,
  context: HandlerContext,
) {
  const operation = await prisma.adminWorkMergeOperation.findUniqueOrThrow({
    where: { id: operationId },
  });
  if (!["QUEUED", "RUNNING", "FAILED"].includes(operation.status)) {
    return { status: operation.status, skipped: true };
  }

  await prisma.adminWorkMergeOperation.update({
    where: { id: operationId },
    data: { status: "RUNNING", errorMessage: null },
  });

  try {
    const [sourceMemberships, targetMemberships, legacyReleases] =
      await Promise.all([
        prisma.unitWork.findMany({
          where: { workUnitId: operation.sourceWorkUnitId },
          orderBy: [{ role: "asc" }, { unitId: "asc" }],
        }),
        prisma.unitWork.findMany({
          where: { workUnitId: operation.targetWorkUnitId },
          select: { unitId: true, role: true },
        }),
        prisma.unit.findMany({
          where: { workUnitId: operation.sourceWorkUnitId },
          select: { id: true },
          orderBy: { id: "asc" },
        }),
      ]);

    const targetKeys = new Set(
      targetMemberships.map((row) => `${row.unitId}:${row.role}`),
    );
    const plannedMoves: MergeMove[] = sourceMemberships.map((row) => ({
      unitId: row.unitId,
      role: row.role,
      fromWorkUnitId: row.workUnitId,
      toWorkUnitId: operation.targetWorkUnitId,
      action: targetKeys.has(`${row.unitId}:${row.role}`) ? "dedupe" : "move",
    }));

    await updateProgress(prisma, operationId, {
      plannedMembershipMoves: plannedMoves.length,
      plannedLegacyReleaseMoves: legacyReleases.length,
    });

    const movedKeys = new Set(
      readMoves(operation).map((row) => `${row.unitId}:${row.role}`),
    );
    for (const move of plannedMoves) {
      const key = `${move.unitId}:${move.role}`;
      if (movedKeys.has(key)) continue;
      await applyMembershipMove(prisma, operationId, move);
      movedKeys.add(key);
    }

    const legacyReleaseIds = legacyReleases.map((row) => row.id);
    const movedLegacy = unique([
      ...operation.movedLegacyReleaseUnitIds,
      ...legacyReleaseIds,
    ]);
    if (legacyReleaseIds.length > 0) {
      await prisma.unit.updateMany({
        where: { id: { in: legacyReleaseIds } },
        data: { workUnitId: operation.targetWorkUnitId },
      });
      await prisma.adminWorkMergeOperation.update({
        where: { id: operationId },
        data: {
          movedLegacyReleaseUnitIds: movedLegacy,
          itemProgress: progressJson({
            ...readProgress(operation),
            legacyReleaseMovesCompleted: movedLegacy.length,
          }),
        },
      });
    }

    const latest = await prisma.adminWorkMergeOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    await copyMissingTags(prisma, latest);
    const afterTags = await prisma.adminWorkMergeOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    await copyMissingAliases(prisma, afterTags);

    const postUnitIds = unique(
      plannedMoves
        .filter((row) => row.role !== "RELEASE")
        .map((row) => row.unitId),
    );
    const repairUnitIds = unique([
      operation.sourceWorkUnitId,
      operation.targetWorkUnitId,
      ...plannedMoves.map((row) => row.unitId),
      ...legacyReleaseIds,
    ]);
    const repairCommandCount = await enqueueRepair(
      command,
      context,
      repairUnitIds,
      postUnitIds,
      [operation.sourceWorkUnitId, operation.targetWorkUnitId],
    );

    await prisma.adminWorkMergeOperation.update({
      where: { id: operationId },
      data: {
        status: "COMPLETED",
        repairUnitIds,
        repairCommandCount,
        itemProgress: progressJson({
          ...readProgress(operation),
          membershipMovesCompleted: movedKeys.size,
          legacyReleaseMovesCompleted: movedLegacy.length,
          repairCommandsEnqueued: repairCommandCount,
        }),
      },
    });

    return {
      status: "COMPLETED",
      membershipMovesCompleted: movedKeys.size,
      legacyReleaseMovesCompleted: movedLegacy.length,
      repairCommandCount,
    };
  } catch (error) {
    await prisma.adminWorkMergeOperation.update({
      where: { id: operationId },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown merge failure",
      },
    });
    throw error;
  }
}
