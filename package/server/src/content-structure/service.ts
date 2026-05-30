import type {
  ContentStructureBatchOperation,
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import { HistoryOutboxPayloadKind } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, type ContentRating } from "#/prisma/client";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { AppError } from "@/utils/errors";
import {
  buildStructureEventPayload,
  writeSequencedHistoryOutbox,
} from "@/unit/history-outbox";
import { between, firstKey } from "@/book/lexorank";
import {
  buildContentStructureTree,
  resolveContentStructurePath,
} from "./mapper";
import type {
  ContentStructureNodeRow,
  ExistingContentStructureRow,
  PlannedContentStructureNode,
} from "./types";

type SaveOptions = {
  actorUserId?: string;
  message?: string | null;
  eventType?: string;
  changedFieldKeys?: string[];
  afterMutate?: (
    tx: Prisma.TransactionClient,
    context: {
      ownerUnitId: string;
      submitted: readonly ContentStructureItem[];
    },
  ) => Promise<void>;
};

type SoftDeleteOptions = {
  actorUserId?: string;
  message?: string | null;
  eventType?: string;
};

type RestoreOptions = SoftDeleteOptions;

const EXISTING_ROW_SELECT = {
  id: true,
  parentId: true,
  sortKey: true,
  contentUnitId: true,
  title: true,
  noContent: true,
  rating: true,
  isDeleted: true,
  deletedAt: true,
} as const;

export class ContentStructureService {
  async getByOwnerUnitId(
    ownerUnitId: string,
  ): Promise<ContentStructureResponse> {
    const [container, nodeRows] = await Promise.all([
      prisma.contentStructure.findUniqueOrThrow({
        where: { ownerUnitId },
        select: { ownerUnitId: true, createdAt: true, updatedAt: true },
      }),
      prisma.contentStructureNode.findMany({
        where: { ownerUnitId, isDeleted: false },
        orderBy: [{ parentId: "asc" }, { sortKey: "asc" }],
      }),
    ]);

    return {
      ownerUnitId: container.ownerUnitId,
      nodes: buildContentStructureTree(nodeRows),
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
    };
  }

  async ensureForOwner(
    tx: Prisma.TransactionClient,
    ownerUnitId: string,
  ): Promise<void> {
    await tx.contentStructure.upsert({
      where: { ownerUnitId },
      create: { ownerUnitId },
      update: {},
    });
  }

  async update(
    ownerUnitId: string,
    submitted: ContentStructureItem[],
    options: SaveOptions = {},
  ): Promise<ContentStructureResponse> {
    await prisma.$transaction(async (tx) => {
      await this.ensureForOwner(tx, ownerUnitId);
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
      const allRows = await tx.contentStructureNode.findMany({
        where: { ownerUnitId },
        select: EXISTING_ROW_SELECT,
      });
      const current = allRows.filter((row) => !row.isDeleted);
      const deletedById = new Map(
        allRows.filter((row) => row.isDeleted).map((row) => [row.id, row]),
      );

      for (const node of submitted) {
        rejectResurrectedIds(node, deletedById);
      }

      const currentById = new Map(current.map((row) => [row.id, row]));
      const planned = planSubmittedContentStructureTree(submitted, currentById);
      const submittedIds = new Set(planned.map((p) => p.id));
      const removedIds = current
        .map((row) => row.id)
        .filter((id) => !submittedIds.has(id));
      const promotedChildIds = new Set<string>();
      for (const row of current) {
        if (row.parentId && removedIds.includes(row.parentId)) {
          if (!removedIds.includes(row.id)) {
            promotedChildIds.add(row.id);
          }
        }
      }

      const operations = planContentStructureOperations(
        current,
        planned,
        promotedChildIds,
      );
      let mutated = false;

      if (removedIds.length > 0) {
        await softDeleteNodesInTx(tx, ownerUnitId, removedIds);
        mutated = true;
      }

      for (const plan of planned) {
        const existing = currentById.get(plan.id);
        if (!existing) {
          await tx.contentStructureNode.create({
            data: {
              id: plan.id,
              ownerUnitId,
              parentId: plan.parentId,
              sortKey: plan.sortKey,
              contentUnitId: plan.contentUnitId ?? null,
              title: plan.title,
              noContent: plan.noContent,
              rating: plan.rating ?? null,
            },
          });
          mutated = true;
          continue;
        }

        if (
          existing.parentId !== plan.parentId ||
          existing.sortKey !== plan.sortKey ||
          (existing.contentUnitId ?? null) !== (plan.contentUnitId ?? null) ||
          existing.title !== plan.title ||
          existing.noContent !== plan.noContent ||
          (existing.rating ?? null) !== (plan.rating ?? null)
        ) {
          await tx.contentStructureNode.update({
            where: { id: plan.id },
            data: {
              parentId: plan.parentId,
              sortKey: plan.sortKey,
              contentUnitId: plan.contentUnitId ?? null,
              title: plan.title,
              noContent: plan.noContent,
              rating: plan.rating ?? null,
            },
          });
          mutated = true;
        }
      }

      if (mutated) {
        // Container `updatedAt` bumps only on structural node changes
        // (insert/delete/move/rename, rating or noContent toggle) — never on
        // chapter body edits, which propagate to the node's own `updatedAt`
        // separately.
        await tx.contentStructure.update({
          where: { ownerUnitId },
          data: { updatedAt: new Date() },
        });
        await options.afterMutate?.(tx, { ownerUnitId, submitted });
        await writeSequencedHistoryOutbox(tx, {
          unitId: ownerUnitId,
          actorUserId,
          buildPayload: (sequence) => ({
            kind: HistoryOutboxPayloadKind.STRUCTURE_EVENT,
            event: buildStructureEventPayload({
              unitId: ownerUnitId,
              sequence,
              actorUserId,
              eventType: options.eventType ?? "contentStructure.content.batch",
              changedFieldKeys: options.changedFieldKeys ?? [
                "contentStructure",
              ],
              payload: { ownerUnitId, operations },
              message: options.message ?? null,
            }),
          }),
        });
      }
    });

    return this.getByOwnerUnitId(ownerUnitId);
  }

  async softDeleteNodes(
    ownerUnitId: string,
    nodeIds: readonly string[],
    options: SoftDeleteOptions = {},
  ): Promise<void> {
    const targetIds = [...new Set(nodeIds)];
    if (targetIds.length === 0) return;
    await prisma.$transaction(async (tx) => {
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
      const targets = await tx.contentStructureNode.findMany({
        where: { ownerUnitId, id: { in: targetIds } },
        select: EXISTING_ROW_SELECT,
      });
      const aliveTargets = targets.filter((row) => !row.isDeleted);
      if (aliveTargets.length === 0) return;
      const aliveTargetIds = aliveTargets.map((row) => row.id);

      const promotedChildren = await tx.contentStructureNode.findMany({
        where: {
          ownerUnitId,
          isDeleted: false,
          parentId: { in: aliveTargetIds },
          id: { notIn: aliveTargetIds },
        },
        select: { id: true },
      });
      const promotedChildIds = promotedChildren.map((row) => row.id);

      await softDeleteNodesInTx(tx, ownerUnitId, aliveTargetIds);
      await tx.contentStructure.update({
        where: { ownerUnitId },
        data: { updatedAt: new Date() },
      });

      await writeSequencedHistoryOutbox(tx, {
        unitId: ownerUnitId,
        actorUserId,
        buildPayload: (sequence) => ({
          kind: HistoryOutboxPayloadKind.STRUCTURE_EVENT,
          event: buildStructureEventPayload({
            unitId: ownerUnitId,
            sequence,
            actorUserId,
            eventType: options.eventType ?? "contentStructure.node.delete",
            changedFieldKeys: ["contentStructure"],
            payload: {
              ownerUnitId,
              operations: aliveTargets.map((row) => ({
                op: "node.delete" as const,
                node: {
                  nodeId: row.id,
                  title: row.title,
                  contentUnitId: row.contentUnitId,
                  noContent: row.noContent,
                  rating: row.rating,
                },
                placement: { parentId: row.parentId, sortKey: row.sortKey },
                descendantCount: 0,
                softDelete: true,
                promotedChildIds,
              })),
            },
            message: options.message ?? null,
          }),
        }),
      });
    });
  }

  async restoreNodes(
    ownerUnitId: string,
    nodeIds: readonly string[],
    options: RestoreOptions = {},
  ): Promise<void> {
    const targetIds = [...new Set(nodeIds)];
    if (targetIds.length === 0) return;
    await prisma.$transaction(async (tx) => {
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
      const candidates = await tx.contentStructureNode.findMany({
        where: { ownerUnitId, id: { in: targetIds } },
        select: EXISTING_ROW_SELECT,
      });
      const deletedTargets = candidates.filter((row) => row.isDeleted);
      if (deletedTargets.length === 0) return;

      const parentIds = [
        ...new Set(
          deletedTargets
            .map((row) => row.parentId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const parents =
        parentIds.length === 0
          ? []
          : await tx.contentStructureNode.findMany({
              where: { id: { in: parentIds } },
              select: { id: true, isDeleted: true },
            });
      const parentById = new Map(parents.map((row) => [row.id, row]));

      const operations: ContentStructureBatchOperation[] = [];
      for (const target of deletedTargets) {
        const originalParent = target.parentId
          ? parentById.get(target.parentId)
          : null;
        const fallbackToRoot =
          target.parentId !== null &&
          (!originalParent || originalParent.isDeleted);
        const restoredParentId = fallbackToRoot ? null : target.parentId;
        await tx.contentStructureNode.update({
          where: { id: target.id },
          data: {
            isDeleted: false,
            deletedAt: null,
            parentId: restoredParentId,
          },
        });
        operations.push({
          op: "node.restore",
          nodeId: target.id,
          placement: {
            parentId: restoredParentId,
            sortKey: target.sortKey,
          },
          fallbackToRoot,
        });
      }

      await tx.contentStructure.update({
        where: { ownerUnitId },
        data: { updatedAt: new Date() },
      });

      await writeSequencedHistoryOutbox(tx, {
        unitId: ownerUnitId,
        actorUserId,
        buildPayload: (sequence) => ({
          kind: HistoryOutboxPayloadKind.STRUCTURE_EVENT,
          event: buildStructureEventPayload({
            unitId: ownerUnitId,
            sequence,
            actorUserId,
            eventType: options.eventType ?? "contentStructure.node.restore",
            changedFieldKeys: ["contentStructure"],
            payload: { ownerUnitId, operations },
            message: options.message ?? null,
          }),
        }),
      });
    });
  }

  async getNodeByPath(
    tx: Prisma.TransactionClient,
    ownerUnitId: string,
    path: readonly number[],
  ): Promise<{
    container: { ownerUnitId: string; updatedAt: Date };
    node: ContentStructureNodeRow | null;
  }> {
    const container = await tx.contentStructure.findUniqueOrThrow({
      where: { ownerUnitId },
      select: { ownerUnitId: true, updatedAt: true },
    });
    const nodeRows = await tx.contentStructureNode.findMany({
      where: { ownerUnitId, isDeleted: false },
      orderBy: [{ parentId: "asc" }, { sortKey: "asc" }],
    });
    return {
      container,
      node: resolveContentStructurePath(nodeRows, path),
    };
  }
}

export const contentStructureService = new ContentStructureService();

async function softDeleteNodesInTx(
  tx: Prisma.TransactionClient,
  ownerUnitId: string,
  nodeIds: readonly string[],
): Promise<void> {
  if (nodeIds.length === 0) return;
  await tx.contentStructureNode.updateMany({
    where: {
      ownerUnitId,
      isDeleted: false,
      parentId: { in: [...nodeIds] },
      id: { notIn: [...nodeIds] },
    },
    data: { parentId: null },
  });
  await tx.contentStructureNode.updateMany({
    where: { ownerUnitId, id: { in: [...nodeIds] }, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

function rejectResurrectedIds(
  node: ContentStructureItem,
  deletedById: ReadonlyMap<string, unknown>,
): void {
  if (node.id && deletedById.has(node.id)) {
    throw new AppError(
      409,
      `Content structure node ${node.id} is deleted and cannot be updated`,
      { code: "content_structure_node_deleted" },
    );
  }
  if (node.children) {
    for (const child of node.children) {
      rejectResurrectedIds(child, deletedById);
    }
  }
}

function nodeSnapshot(
  row: ExistingContentStructureRow | PlannedContentStructureNode,
) {
  return {
    nodeId: row.id,
    title: row.title,
    contentUnitId: row.contentUnitId,
    noContent: row.noContent,
    rating: row.rating,
  };
}

function nodePlacement(
  row: ExistingContentStructureRow | PlannedContentStructureNode,
) {
  return {
    parentId: row.parentId,
    sortKey: row.sortKey,
  };
}

function countDescendants(
  nodeId: string,
  rowsByParentId: ReadonlyMap<
    string | null,
    readonly ExistingContentStructureRow[]
  >,
): number {
  const children = rowsByParentId.get(nodeId) ?? [];
  return children.reduce(
    (total, child) => total + 1 + countDescendants(child.id, rowsByParentId),
    0,
  );
}

export function planContentStructureOperations(
  current: readonly ExistingContentStructureRow[],
  planned: readonly PlannedContentStructureNode[],
  promotedChildIds: ReadonlySet<string> = new Set(),
): ContentStructureBatchOperation[] {
  const currentById = new Map(current.map((row) => [row.id, row]));
  const plannedById = new Map(planned.map((row) => [row.id, row]));
  const rowsByParentId = new Map<
    string | null,
    ExistingContentStructureRow[]
  >();
  for (const row of current) {
    const siblings = rowsByParentId.get(row.parentId) ?? [];
    siblings.push(row);
    rowsByParentId.set(row.parentId, siblings);
  }

  const operations: ContentStructureBatchOperation[] = [];

  for (const row of current) {
    if (plannedById.has(row.id)) continue;
    operations.push({
      op: "node.delete",
      node: nodeSnapshot(row),
      placement: nodePlacement(row),
      descendantCount: countDescendants(row.id, rowsByParentId),
      softDelete: true,
      promotedChildIds: [...promotedChildIds].filter((id) => {
        const child = currentById.get(id);
        return child?.parentId === row.id;
      }),
    });
  }

  for (const plan of planned) {
    const existing = currentById.get(plan.id);
    if (!existing) {
      operations.push({
        op: "node.create",
        node: nodeSnapshot(plan),
        placement: nodePlacement(plan),
      });
      continue;
    }

    const beforeUpdate: Partial<ReturnType<typeof nodeSnapshot>> = {};
    const afterUpdate: Partial<ReturnType<typeof nodeSnapshot>> = {};
    if (existing.title !== plan.title) {
      beforeUpdate.title = existing.title;
      afterUpdate.title = plan.title;
    }
    if (existing.noContent !== plan.noContent) {
      beforeUpdate.noContent = existing.noContent;
      afterUpdate.noContent = plan.noContent;
    }
    if ((existing.rating ?? null) !== (plan.rating ?? null)) {
      beforeUpdate.rating = existing.rating;
      afterUpdate.rating = plan.rating;
    }
    if (Object.keys(afterUpdate).length > 0) {
      operations.push({
        op: "node.update",
        nodeId: plan.id,
        before: beforeUpdate,
        after: afterUpdate,
      });
    }

    if (
      existing.parentId !== plan.parentId ||
      existing.sortKey !== plan.sortKey
    ) {
      operations.push({
        op: "node.move",
        nodeId: plan.id,
        before: nodePlacement(existing),
        after: nodePlacement(plan),
      });
    }

    const beforeContentUnitId = existing.contentUnitId ?? null;
    const afterContentUnitId = plan.contentUnitId ?? null;
    if (beforeContentUnitId !== afterContentUnitId) {
      if (beforeContentUnitId) {
        operations.push({
          op: "node.unlink",
          nodeId: plan.id,
          beforeContentUnitId,
        });
      }
      if (afterContentUnitId) {
        operations.push({
          op: "node.link",
          nodeId: plan.id,
          beforeContentUnitId,
          afterContentUnitId,
        });
      }
    }
  }

  return operations;
}

function planSubmittedContentStructureTree(
  submitted: readonly ContentStructureItem[],
  existingById: ReadonlyMap<string, ExistingContentStructureRow>,
): PlannedContentStructureNode[] {
  const out: PlannedContentStructureNode[] = [];
  const claimedIds = new Set<string>();

  function visit(
    siblings: readonly ContentStructureItem[],
    parentId: string | null,
  ): void {
    const ids = siblings.map((node) => {
      const claimed = node.id && !claimedIds.has(node.id) ? node.id : undefined;
      const fresh =
        claimed && existingById.has(claimed)
          ? claimed
          : (claimed ?? crypto.randomUUID());
      claimedIds.add(fresh);
      return fresh;
    });

    const sortKeys = allocateSortKeys(siblings, ids, parentId, existingById);

    for (let i = 0; i < siblings.length; i++) {
      const node = siblings[i]!;
      const id = ids[i]!;
      out.push({
        id,
        parentId,
        sortKey: sortKeys[i]!,
        title: node.title,
        noContent: node.noContent === true,
        rating: (node.rating as ContentRating | undefined) ?? null,
        contentUnitId: node.contentUnitId ?? null,
      });
      if (node.children && node.children.length > 0) {
        visit(node.children, id);
      }
    }
  }

  visit(submitted, null);
  return out;
}

function allocateSortKeys(
  siblings: readonly ContentStructureItem[],
  assignedIds: readonly string[],
  parentId: string | null,
  existingById: ReadonlyMap<string, ExistingContentStructureRow>,
): string[] {
  const existingKeys = assignedIds.map((id, i) => {
    const node = siblings[i]!;
    if (!node.id) return null;
    const existing = existingById.get(id);
    if (!existing || existing.parentId !== parentId) return null;
    return existing.sortKey;
  });

  const result: string[] = [];
  for (let i = 0; i < siblings.length; i++) {
    const prev = result[i - 1] ?? null;
    const candidate = existingKeys[i] ?? null;

    if (candidate !== null && (prev === null || candidate > prev)) {
      result.push(candidate);
      continue;
    }

    let upper: string | null = null;
    for (let j = i + 1; j < siblings.length; j++) {
      const e = existingKeys[j] ?? null;
      if (e !== null && (prev === null || e > prev)) {
        upper = e;
        break;
      }
    }
    result.push(
      prev === null && upper === null ? firstKey() : between(prev, upper),
    );
  }
  return result;
}
