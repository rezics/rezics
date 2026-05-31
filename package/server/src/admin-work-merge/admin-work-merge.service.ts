import type {
  AdminWorkMergeMembershipMove,
  AdminWorkMergePreview,
  AdminWorkMergeRequest,
} from "@rezics/contract";
import {
  createMaintenanceCommand,
  createSearchCommand,
  MAINTENANCE_COMMAND_KINDS,
  SEARCH_COMMAND_KINDS,
} from "@rezics/job";
import { prisma, UnitWorkRole } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";

const source = { type: "server" as const, service: "admin-work-merge" };

type PrismaTx = any;

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function tagKey(unitId: string, tagUnitId: string): string {
  return `${unitId}:${tagUnitId}`;
}

function parseTagKey(
  key: string,
): { unitId: string; tagUnitId: string } | null {
  const [unitId, tagUnitId] = key.split(":");
  return unitId && tagUnitId ? { unitId, tagUnitId } : null;
}

async function enqueueMergeRepair(unitIds: string[]) {
  const commands = [
    ...unitIds.map((unitId) =>
      createSearchCommand(SEARCH_COMMAND_KINDS.contentSync, { unitId }, source),
    ),
    ...unitIds.map((unitId) =>
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId: unitId },
        source,
      ),
    ),
  ];

  for (const command of commands) {
    await serverJobProducer.enqueue(command);
  }

  return commands.length;
}

export class AdminWorkMergeService {
  async preview(input: AdminWorkMergeRequest): Promise<AdminWorkMergePreview> {
    await this.assertMergeableWorks(
      input.sourceWorkUnitId,
      input.targetWorkUnitId,
    );

    const [
      sourceMemberships,
      targetMemberships,
      sourceTags,
      targetTags,
      sourceAliases,
      targetAliases,
    ] = await Promise.all([
      prisma.unitWork.findMany({
        where: { workUnitId: input.sourceWorkUnitId },
        orderBy: [{ role: "asc" }, { unitId: "asc" }],
      }),
      prisma.unitWork.findMany({
        where: { workUnitId: input.targetWorkUnitId },
        select: { unitId: true, role: true },
      }),
      prisma.unitTag.findMany({
        where: { unitId: input.sourceWorkUnitId },
        select: { tagUnitId: true },
        orderBy: { tagUnitId: "asc" },
      }),
      prisma.unitTag.findMany({
        where: { unitId: input.targetWorkUnitId },
        select: { tagUnitId: true },
        orderBy: { tagUnitId: "asc" },
      }),
      prisma.unitAlias.findMany({
        where: { unitId: input.sourceWorkUnitId },
        select: { normalizedValue: true },
        orderBy: { normalizedValue: "asc" },
      }),
      prisma.unitAlias.findMany({
        where: { unitId: input.targetWorkUnitId },
        select: { normalizedValue: true },
        orderBy: { normalizedValue: "asc" },
      }),
    ]);

    const targetKeys = new Set(
      targetMemberships.map((row) => `${row.unitId}:${row.role}`),
    );
    const moves = sourceMemberships.map((row) => ({
      unitId: row.unitId,
      role: row.role,
      fromWorkUnitId: row.workUnitId,
      toWorkUnitId: input.targetWorkUnitId,
      action: targetKeys.has(`${row.unitId}:${row.role}`) ? "dedupe" : "move",
    })) satisfies AdminWorkMergeMembershipMove[];

    const sourceTagIds = sourceTags.map((row) => row.tagUnitId);
    const targetTagIds = new Set(targetTags.map((row) => row.tagUnitId));
    const sourceAliasValues = sourceAliases.map((row) => row.normalizedValue);
    const targetAliasValues = new Set(
      targetAliases.map((row) => row.normalizedValue),
    );

    const releaseUnitIds = unique([
      ...moves
        .filter((row) => row.role === UnitWorkRole.RELEASE)
        .map((row) => row.unitId),
    ]);
    const contentMembershipUnitIds = unique(
      moves
        .filter((row) => row.role !== UnitWorkRole.RELEASE)
        .map((row) => row.unitId),
    );
    const shelfUnitIds = unique(
      moves
        .filter((row) => row.role === UnitWorkRole.SHELF)
        .map((row) => row.unitId),
    );

    return {
      sourceWorkUnitId: input.sourceWorkUnitId,
      targetWorkUnitId: input.targetWorkUnitId,
      releaseMembershipMoves: moves.filter(
        (row) => row.role === UnitWorkRole.RELEASE,
      ),
      contentMembershipMoves: moves.filter(
        (row) => row.role !== UnitWorkRole.RELEASE,
      ),
      legacyReleaseUnitIds: [],
      metadataCopy: {
        tags: {
          missing: sourceTagIds.filter((id) => !targetTagIds.has(id)),
          duplicates: sourceTagIds.filter((id) => targetTagIds.has(id)),
        },
        aliases: {
          missing: sourceAliasValues.filter(
            (value) => !targetAliasValues.has(value),
          ),
          duplicates: sourceAliasValues.filter((value) =>
            targetAliasValues.has(value),
          ),
        },
      },
      repairScope: {
        contentSearchUnitIds: unique([
          input.sourceWorkUnitId,
          input.targetWorkUnitId,
          ...releaseUnitIds,
          ...contentMembershipUnitIds,
        ]),
        postSearchUnitIds: unique(contentMembershipUnitIds),
        shelfUnitIds,
        uswnReleaseUnitIds: releaseUnitIds,
        contentMembershipUnitIds,
      },
      affectedBehavior: [
        "Release DTO metadata.uswn resolves to the target work Unit after repair.",
        "Content and post search group by the target work domain after queued sync.",
        "Shelf and content memberships that pointed at the source work are repaired to the target work.",
        "The source work Unit and its tags, aliases, external references, attribution, and history are preserved.",
      ],
    };
  }

  async start(input: AdminWorkMergeRequest, actorUserId: string) {
    const preview = await this.preview(input);
    const copyTags = Boolean(input.options?.copyMissingTags);
    const copyAliases = Boolean(input.options?.copyMissingAliases);

    const operation = await prisma.adminWorkMergeOperation.create({
      data: {
        sourceWorkUnitId: input.sourceWorkUnitId,
        targetWorkUnitId: input.targetWorkUnitId,
        status: "QUEUED",
        actorUserId,
        reason: input.reason?.trim() || null,
        copyTagsRequested: copyTags,
        copyAliasesRequested: copyAliases,
        repairUnitIds: preview.repairScope.contentSearchUnitIds,
        itemProgress: {
          plannedMembershipMoves:
            preview.releaseMembershipMoves.length +
            preview.contentMembershipMoves.length,
          plannedLegacyReleaseMoves: preview.legacyReleaseUnitIds.length,
          plannedTagCopies: copyTags
            ? preview.metadataCopy.tags.missing.length
            : 0,
          plannedAliasCopies: copyAliases
            ? preview.metadataCopy.aliases.missing.length
            : 0,
        },
      },
    });

    await serverJobProducer.enqueue(
      createMaintenanceCommand(
        MAINTENANCE_COMMAND_KINDS.fanoutContinuation,
        {
          fanout: "admin-work-merge.execute",
          targetId: operation.id,
          cursor: "start",
        },
        source,
      ),
    );

    return operation;
  }

  async execute(operationId: string) {
    const current = await this.get(operationId);
    if (!["QUEUED", "RUNNING", "FAILED"].includes(current.status)) {
      return current;
    }

    await prisma.adminWorkMergeOperation.update({
      where: { id: operationId },
      data: { status: "RUNNING", errorMessage: null },
    });

    try {
      const input: AdminWorkMergeRequest = {
        sourceWorkUnitId: current.sourceWorkUnitId,
        targetWorkUnitId: current.targetWorkUnitId,
        reason: current.reason,
        options: {
          copyMissingTags: current.copyTagsRequested,
          copyMissingAliases: current.copyAliasesRequested,
        },
      };
      const preview = await this.preview(input);

      const operation = await prisma.$transaction(async (tx) => {
        const movedMemberships = await this.applyMembershipMoves(tx, [
          ...preview.releaseMembershipMoves,
          ...preview.contentMembershipMoves,
        ]);
        const createdTagKeys = current.copyTagsRequested
          ? await this.copyMissingTags(
              tx,
              current.sourceWorkUnitId,
              current.targetWorkUnitId,
            )
          : [];
        const createdAliasIds = current.copyAliasesRequested
          ? await this.copyMissingAliases(
              tx,
              current.sourceWorkUnitId,
              current.targetWorkUnitId,
              current.actorUserId,
            )
          : [];

        return tx.adminWorkMergeOperation.update({
          where: { id: operationId },
          data: {
            status: "RUNNING",
            movedMemberships,
            movedLegacyReleaseUnitIds: preview.legacyReleaseUnitIds,
            createdTagKeys,
            createdAliasIds,
            repairUnitIds: preview.repairScope.contentSearchUnitIds,
            itemProgress: {
              ...(current.itemProgress as Record<string, unknown>),
              membershipMovesCompleted: movedMemberships.length,
              legacyReleaseMovesCompleted: preview.legacyReleaseUnitIds.length,
              tagCopiesCreated: createdTagKeys.length,
              aliasCopiesCreated: createdAliasIds.length,
            },
          },
        });
      });

      const commandCount = await enqueueMergeRepair(operation.repairUnitIds);

      return prisma.adminWorkMergeOperation.update({
        where: { id: operationId },
        data: { status: "COMPLETED", repairCommandCount: commandCount },
      });
    } catch (error) {
      return prisma.adminWorkMergeOperation.update({
        where: { id: operationId },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown merge failure",
        },
      });
    }
  }

  async get(operationId: string) {
    return prisma.adminWorkMergeOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
  }

  async revert(operationId: string, actorUserId: string) {
    const current = await this.get(operationId);
    if (current.status !== "COMPLETED") {
      throw new AppError(
        409,
        "Only completed merge operations can be reverted",
        {
          code: "admin_work_merge_not_revertible",
        },
      );
    }

    const membershipMoves = Array.isArray(current.movedMemberships)
      ? (current.movedMemberships as AdminWorkMergeMembershipMove[])
      : [];

    const row = await prisma.$transaction(async (tx) => {
      for (const move of membershipMoves) {
        await this.revertMembershipMove(tx, move);
      }

      const tagKeys = current.createdTagKeys
        .map(parseTagKey)
        .filter((key): key is { unitId: string; tagUnitId: string } =>
          Boolean(key),
        );
      for (const key of tagKeys) {
        await tx.unitTag.deleteMany({ where: key });
      }
      if (current.createdAliasIds.length > 0) {
        await tx.unitAlias.deleteMany({
          where: { id: { in: current.createdAliasIds } },
        });
      }

      return tx.adminWorkMergeOperation.update({
        where: { id: operationId },
        data: {
          status: "REVERTED",
          revertedAt: new Date(),
          revertedByUserId: actorUserId,
          itemProgress: {
            ...(current.itemProgress as Record<string, unknown>),
            revertedMembershipMoves: membershipMoves.length,
            revertedLegacyReleaseMoves:
              current.movedLegacyReleaseUnitIds.length,
            revertedTagCopies: current.createdTagKeys.length,
            revertedAliasCopies: current.createdAliasIds.length,
          },
        },
      });
    });

    await enqueueMergeRepair(current.repairUnitIds);

    return row;
  }

  private async assertMergeableWorks(
    sourceWorkUnitId: string,
    targetWorkUnitId: string,
  ) {
    if (sourceWorkUnitId === targetWorkUnitId) {
      throw new AppError(400, "Source and target work Units must differ", {
        code: "admin_work_merge_same_work",
      });
    }

    const [sourceWork, targetWork] = await Promise.all([
      prisma.unit.findUnique({
        where: { id: sourceWorkUnitId },
        select: { id: true },
      }),
      prisma.unit.findUnique({
        where: { id: targetWorkUnitId },
        select: { id: true },
      }),
    ]);

    if (!sourceWork || !targetWork) {
      throw new AppError(404, "Source or target work Unit not found", {
        code: "admin_work_merge_work_not_found",
      });
    }
  }

  private async applyMembershipMoves(
    tx: PrismaTx,
    moves: AdminWorkMergeMembershipMove[],
  ): Promise<AdminWorkMergeMembershipMove[]> {
    const completed: AdminWorkMergeMembershipMove[] = [];
    for (const move of moves) {
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
        await tx.unitWork.delete({
          where: {
            unitId_workUnitId_role: {
              unitId: move.unitId,
              workUnitId: move.fromWorkUnitId,
              role: move.role,
            },
          },
        });
        completed.push({ ...move, action: "dedupe" });
        continue;
      }

      await tx.unitWork.update({
        where: {
          unitId_workUnitId_role: {
            unitId: move.unitId,
            workUnitId: move.fromWorkUnitId,
            role: move.role,
          },
        },
        data: { workUnitId: move.toWorkUnitId },
      });
      completed.push({ ...move, action: "move" });
    }
    return completed;
  }

  private async revertMembershipMove(
    tx: PrismaTx,
    move: AdminWorkMergeMembershipMove,
  ) {
    if (move.action === "dedupe") {
      await tx.unitWork.upsert({
        where: {
          unitId_workUnitId_role: {
            unitId: move.unitId,
            workUnitId: move.fromWorkUnitId,
            role: move.role,
          },
        },
        update: {},
        create: {
          unitId: move.unitId,
          workUnitId: move.fromWorkUnitId,
          role: move.role,
        },
      });
      return;
    }

    const existingSource = await tx.unitWork.findUnique({
      where: {
        unitId_workUnitId_role: {
          unitId: move.unitId,
          workUnitId: move.fromWorkUnitId,
          role: move.role,
        },
      },
    });
    if (existingSource) return;

    await tx.unitWork.updateMany({
      where: {
        unitId: move.unitId,
        workUnitId: move.toWorkUnitId,
        role: move.role,
      },
      data: { workUnitId: move.fromWorkUnitId },
    });
  }

  private async copyMissingTags(
    tx: PrismaTx,
    sourceWorkUnitId: string,
    targetWorkUnitId: string,
  ): Promise<string[]> {
    const [sourceTags, targetTags] = await Promise.all([
      tx.unitTag.findMany({ where: { unitId: sourceWorkUnitId } }),
      tx.unitTag.findMany({
        where: { unitId: targetWorkUnitId },
        select: { tagUnitId: true },
      }),
    ]);
    const targetTagIds = new Set(targetTags.map((row: any) => row.tagUnitId));
    const created: string[] = [];

    for (const row of sourceTags) {
      if (targetTagIds.has(row.tagUnitId)) continue;
      await tx.unitTag.create({
        data: {
          unitId: targetWorkUnitId,
          tagUnitId: row.tagUnitId,
          score: row.score,
          voteCount: row.voteCount,
          pinned: row.pinned,
          position: row.position,
        },
      });
      created.push(tagKey(targetWorkUnitId, row.tagUnitId));
    }
    return created;
  }

  private async copyMissingAliases(
    tx: PrismaTx,
    sourceWorkUnitId: string,
    targetWorkUnitId: string,
    actorUserId: string,
  ): Promise<string[]> {
    const [sourceAliases, targetAliases] = await Promise.all([
      tx.unitAlias.findMany({ where: { unitId: sourceWorkUnitId } }),
      tx.unitAlias.findMany({
        where: { unitId: targetWorkUnitId },
        select: { normalizedValue: true },
      }),
    ]);
    const targetValues = new Set(
      targetAliases.map((row: any) => row.normalizedValue),
    );
    const created: string[] = [];

    for (const row of sourceAliases) {
      if (targetValues.has(row.normalizedValue)) continue;
      const alias = await tx.unitAlias.create({
        data: {
          unitId: targetWorkUnitId,
          value: row.value,
          normalizedValue: row.normalizedValue,
          language: row.language,
          kind: row.kind,
          status: row.status,
          score: row.score,
          voteCount: row.voteCount,
          pinned: row.pinned,
          position: row.position,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      created.push(alias.id);
    }
    return created;
  }
}

export const adminWorkMergeService = new AdminWorkMergeService();
