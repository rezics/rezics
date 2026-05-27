import type {
  ContentStructureBatchOperation,
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import { HistoryOutboxPayloadKind } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, type ContentRating } from "#/prisma/client";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
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
        where: { ownerUnitId },
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
      const current = await tx.contentStructureNode.findMany({
        where: { ownerUnitId },
        select: {
          id: true,
          parentId: true,
          sortKey: true,
          contentUnitId: true,
          title: true,
          noContent: true,
          rating: true,
        },
      });

      const currentById = new Map(current.map((row) => [row.id, row]));
      const planned = planSubmittedContentStructureTree(submitted, currentById);
      const operations = planContentStructureOperations(current, planned);
      const submittedIds = new Set(planned.map((p) => p.id));
      let mutated = false;

      const toDelete = current
        .map((row) => row.id)
        .filter((id) => !submittedIds.has(id));
      if (toDelete.length > 0) {
        await tx.contentStructureNode.deleteMany({
          where: { id: { in: toDelete } },
        });
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
      where: { ownerUnitId },
      orderBy: [{ parentId: "asc" }, { sortKey: "asc" }],
    });
    return {
      container,
      node: resolveContentStructurePath(nodeRows, path),
    };
  }
}

export const contentStructureService = new ContentStructureService();

function nodeSnapshot(
  row: ExistingContentStructureRow | PlannedContentStructureNode,
) {
  return {
    nodeId: row.id,
    title: row.title,
    contentUnitId: row.contentUnitId,
    chapterUnitId: row.contentUnitId,
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
          beforeChapterUnitId: beforeContentUnitId,
        });
      }
      if (afterContentUnitId) {
        operations.push({
          op: "node.link",
          nodeId: plan.id,
          beforeContentUnitId,
          afterContentUnitId,
          beforeChapterUnitId: beforeContentUnitId,
          afterChapterUnitId: afterContentUnitId,
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
        contentUnitId: node.contentUnitId ?? node.chapterUnitId ?? null,
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
