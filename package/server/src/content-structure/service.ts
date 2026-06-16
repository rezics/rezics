import type {
  ContentRating,
  ContentStructureBatchOperation,
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import { HistoryOutboxPayloadKind } from "@rezics/contract";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { between, firstKey } from "@/book/position-index";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import {
  buildStructureEventPayload,
  type HistoryOutboxWriter,
  writeSequencedHistoryOutbox,
} from "@/unit/history-outbox";
import { AppError } from "@/utils/errors";
import {
  ContentStructure,
  ContentStructureAnchor,
  ContentStructureNode,
  HistoryOutbox,
} from "../db/schema";
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
    tx: unknown,
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

type ContentStructureContainerRow = {
  ownerUnitId: string;
  createdAt?: Date;
  updatedAt: Date;
};

type FindNodesOptions = {
  isDeleted?: boolean;
  ids?: readonly string[];
  excludeIds?: readonly string[];
  parentIds?: readonly string[];
};

type UpdateNodeData = Partial<{
  parentId: string | null;
  position: string;
  contentUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
  isDeleted: boolean;
  deletedAt: Date | null;
}>;

export type ContentStructureMutationTx = unknown;

export type ContentStructureTx = HistoryOutboxWriter & {
  mutationTx: ContentStructureMutationTx;
  ensureForOwner(ownerUnitId: string): Promise<void>;
  getContainer(ownerUnitId: string): Promise<ContentStructureContainerRow>;
  findNodes(
    ownerUnitId: string,
    options?: FindNodesOptions,
  ): Promise<ContentStructureNodeRow[]>;
  createNode(
    ownerUnitId: string,
    row: PlannedContentStructureNode,
  ): Promise<void>;
  updateNode(nodeId: string, data: UpdateNodeData): Promise<void>;
  updateManyNodes(
    ownerUnitId: string,
    options: FindNodesOptions,
    data: UpdateNodeData,
  ): Promise<void>;
  updateContainer(ownerUnitId: string): Promise<void>;
  deleteAnchors(ownerUnitId: string): Promise<void>;
  createAnchors(rows: readonly ContentStructureAnchorWrite[]): Promise<void>;
};

export type ContentStructureRepository = {
  getByOwnerUnitId(ownerUnitId: string): Promise<{
    container: Required<ContentStructureContainerRow>;
    nodes: ContentStructureNodeRow[];
  }>;
  transaction<T>(fn: (tx: ContentStructureTx) => Promise<T>): Promise<T>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function nodeFilters(ownerUnitId: string, options: FindNodesOptions = {}) {
  return and(
    eq(ContentStructureNode.ownerUnitId, ownerUnitId),
    options.isDeleted === undefined
      ? undefined
      : eq(ContentStructureNode.isDeleted, options.isDeleted),
    options.ids?.length
      ? inArray(ContentStructureNode.id, [...options.ids])
      : undefined,
    options.excludeIds?.length
      ? notInArray(ContentStructureNode.id, [...options.excludeIds])
      : undefined,
    options.parentIds?.length
      ? inArray(ContentStructureNode.parentId, [...options.parentIds])
      : undefined,
  );
}

function mapContentStructureNodeRow(
  row: typeof ContentStructureNode.$inferSelect,
): ContentStructureNodeRow {
  return {
    id: row.id,
    ownerUnitId: row.ownerUnitId,
    parentId: row.parentId,
    position: row.position,
    contentUnitId: row.contentUnitId,
    title: row.title,
    noContent: row.noContent,
    rating: row.rating,
    isDeleted: row.isDeleted,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeExecuteRows<T>(result: unknown): T {
  if (Array.isArray(result)) return result as T;
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: unknown }).rows as T;
  }
  return result as T;
}

function createDrizzleContentStructureTx(rawTx: any): ContentStructureTx {
  return {
    mutationTx: rawTx,
    async $queryRaw<T = unknown>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<T> {
      return normalizeExecuteRows<T>(
        await rawTx.execute(sql(strings, ...values)),
      );
    },
    historyOutbox: {
      async create(input) {
        await rawTx.insert(HistoryOutbox).values({
          unitId: input.data.unitId,
          sequence: Number(input.data.sequence),
          actorUserId: input.data.actorUserId,
          category: input.data.category,
          payload: input.data.payload,
          payloadHash: input.data.payloadHash,
          updatedAt: new Date(),
        });
      },
    },
    async ensureForOwner(ownerUnitId) {
      await rawTx
        .insert(ContentStructure)
        .values({ ownerUnitId, updatedAt: new Date() })
        .onConflictDoNothing();
    },
    async getContainer(ownerUnitId) {
      const [row] = await rawTx
        .select({
          ownerUnitId: ContentStructure.ownerUnitId,
          createdAt: ContentStructure.createdAt,
          updatedAt: ContentStructure.updatedAt,
        })
        .from(ContentStructure)
        .where(eq(ContentStructure.ownerUnitId, ownerUnitId))
        .limit(1);
      if (!row) throw new Error(`ContentStructure not found: ${ownerUnitId}`);
      return row;
    },
    async findNodes(ownerUnitId, options = {}) {
      const rows = await rawTx
        .select()
        .from(ContentStructureNode)
        .where(nodeFilters(ownerUnitId, options))
        .orderBy(ContentStructureNode.parentId, ContentStructureNode.position);
      return rows.map(mapContentStructureNodeRow);
    },
    async createNode(ownerUnitId, row) {
      await rawTx.insert(ContentStructureNode).values({
        id: row.id,
        ownerUnitId,
        parentId: row.parentId,
        position: row.position,
        contentUnitId: row.contentUnitId,
        title: row.title,
        noContent: row.noContent,
        rating: row.rating,
        updatedAt: new Date(),
      });
    },
    async updateNode(nodeId, data) {
      await rawTx
        .update(ContentStructureNode)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(ContentStructureNode.id, nodeId));
    },
    async updateManyNodes(ownerUnitId, options, data) {
      await rawTx
        .update(ContentStructureNode)
        .set({ ...data, updatedAt: new Date() })
        .where(nodeFilters(ownerUnitId, options));
    },
    async updateContainer(ownerUnitId) {
      await rawTx
        .update(ContentStructure)
        .set({ updatedAt: new Date() })
        .where(eq(ContentStructure.ownerUnitId, ownerUnitId));
    },
    async deleteAnchors(ownerUnitId) {
      await rawTx
        .delete(ContentStructureAnchor)
        .where(eq(ContentStructureAnchor.ownerUnitId, ownerUnitId));
    },
    async createAnchors(rows) {
      if (rows.length === 0) return;
      await rawTx.insert(ContentStructureAnchor).values(
        rows.map((anchor) => ({
          nodeId: anchor.nodeId,
          ownerUnitId: anchor.ownerUnitId,
          contentUnitId: anchor.contentUnitId,
          parentNodeId: anchor.parentNodeId,
          ancestorNodeIds: anchor.ancestorNodeIds,
          path: anchor.path,
          depth: anchor.depth,
          position: anchor.position,
          positionPath: anchor.positionPath,
          titlePath: anchor.titlePath,
          updatedAt: new Date(),
        })),
      );
    },
  };
}

function createDrizzleContentStructureRepository(): ContentStructureRepository {
  return {
    async getByOwnerUnitId(ownerUnitId) {
      const db = await getServerDb();
      const [container, nodes] = await Promise.all([
        db
          .select({
            ownerUnitId: ContentStructure.ownerUnitId,
            createdAt: ContentStructure.createdAt,
            updatedAt: ContentStructure.updatedAt,
          })
          .from(ContentStructure)
          .where(eq(ContentStructure.ownerUnitId, ownerUnitId))
          .limit(1),
        db
          .select()
          .from(ContentStructureNode)
          .where(
            and(
              eq(ContentStructureNode.ownerUnitId, ownerUnitId),
              eq(ContentStructureNode.isDeleted, false),
            ),
          )
          .orderBy(
            ContentStructureNode.parentId,
            ContentStructureNode.position,
          ),
      ]);
      const row = container[0];
      if (!row) throw new Error(`ContentStructure not found: ${ownerUnitId}`);
      return {
        container: row,
        nodes: nodes.map(mapContentStructureNodeRow),
      };
    },
    async transaction(fn) {
      const db = await getServerDb();
      return db.transaction((tx) => fn(createDrizzleContentStructureTx(tx)));
    },
  };
}

export class ContentStructureService {
  constructor(
    private readonly repository: ContentStructureRepository = createDrizzleContentStructureRepository(),
  ) {}

  async getByOwnerUnitId(
    ownerUnitId: string,
  ): Promise<ContentStructureResponse> {
    const { container, nodes } =
      await this.repository.getByOwnerUnitId(ownerUnitId);

    return {
      ownerUnitId: container.ownerUnitId,
      nodes: buildContentStructureTree(nodes),
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
    };
  }

  async ensureForOwner(
    tx: ContentStructureTx,
    ownerUnitId: string,
  ): Promise<void> {
    await tx.ensureForOwner(ownerUnitId);
  }

  async update(
    ownerUnitId: string,
    submitted: ContentStructureItem[],
    options: SaveOptions = {},
  ): Promise<ContentStructureResponse> {
    await this.repository.transaction(async (tx) => {
      await this.ensureForOwner(tx, ownerUnitId);
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
      const allRows = await tx.findNodes(ownerUnitId);
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
          await tx.createNode(ownerUnitId, plan);
          mutated = true;
          continue;
        }

        if (
          existing.parentId !== plan.parentId ||
          existing.position !== plan.position ||
          (existing.contentUnitId ?? null) !== (plan.contentUnitId ?? null) ||
          existing.title !== plan.title ||
          existing.noContent !== plan.noContent ||
          (existing.rating ?? null) !== (plan.rating ?? null)
        ) {
          await tx.updateNode(plan.id, {
            parentId: plan.parentId,
            position: plan.position,
            contentUnitId: plan.contentUnitId ?? null,
            title: plan.title,
            noContent: plan.noContent,
            rating: plan.rating ?? null,
          });
          mutated = true;
        }
      }

      if (mutated) {
        // Container `updatedAt` bumps only on structural node changes
        // (insert/delete/move/rename, rating or noContent toggle) — never on
        // chapter body edits, which propagate to the node's own `updatedAt`
        // separately.
        // 容器的 `updatedAt` 仅在节点结构变更时更新
        //（插入/删除/移动/重命名、rating 或 noContent 切换）——绝不在
        // 章节正文编辑时更新，正文编辑会单独传播到节点自身的 `updatedAt`。
        await tx.updateContainer(ownerUnitId);
        await rebuildContentStructureAnchors(tx, ownerUnitId);
        await options.afterMutate?.(tx.mutationTx, { ownerUnitId, submitted });
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
    await this.repository.transaction(async (tx) => {
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
      const targets = await tx.findNodes(ownerUnitId, { ids: targetIds });
      const aliveTargets = targets.filter((row) => !row.isDeleted);
      if (aliveTargets.length === 0) return;
      const aliveTargetIds = aliveTargets.map((row) => row.id);

      const promotedChildren = await tx.findNodes(ownerUnitId, {
        isDeleted: false,
        parentIds: aliveTargetIds,
        excludeIds: aliveTargetIds,
      });
      const promotedChildIds = promotedChildren.map((row) => row.id);

      await softDeleteNodesInTx(tx, ownerUnitId, aliveTargetIds);
      await tx.updateContainer(ownerUnitId);
      await rebuildContentStructureAnchors(tx, ownerUnitId);

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
                placement: { parentId: row.parentId, position: row.position },
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
    await this.repository.transaction(async (tx) => {
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
      const candidates = await tx.findNodes(ownerUnitId, { ids: targetIds });
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
          : await tx.findNodes(ownerUnitId, { ids: parentIds });
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
        await tx.updateNode(target.id, {
          isDeleted: false,
          deletedAt: null,
          parentId: restoredParentId,
        });
        operations.push({
          op: "node.restore",
          nodeId: target.id,
          placement: {
            parentId: restoredParentId,
            position: target.position,
          },
          fallbackToRoot,
        });
      }

      await tx.updateContainer(ownerUnitId);
      await rebuildContentStructureAnchors(tx, ownerUnitId);

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
    tx: ContentStructureTx,
    ownerUnitId: string,
    path: readonly number[],
  ): Promise<{
    container: { ownerUnitId: string; updatedAt: Date };
    node: ContentStructureNodeRow | null;
  }> {
    const container = await tx.getContainer(ownerUnitId);
    const nodeRows = await tx.findNodes(ownerUnitId, { isDeleted: false });
    return {
      container,
      node: resolveContentStructurePath(nodeRows, path),
    };
  }
}

export const contentStructureService = new ContentStructureService();

type ContentStructureAnchorSourceNode = {
  id: string;
  parentId: string | null;
  position: string;
  contentUnitId: string | null;
  title: string;
};

export type ContentStructureAnchorWrite = {
  nodeId: string;
  ownerUnitId: string;
  contentUnitId: string;
  parentNodeId: string | null;
  ancestorNodeIds: string[];
  path: string[];
  depth: number;
  position: string;
  positionPath: string;
  titlePath: string[];
};

export function buildContentStructureAnchorRows(
  ownerUnitId: string,
  rows: readonly ContentStructureAnchorSourceNode[],
): ContentStructureAnchorWrite[] {
  const childrenByParentId = new Map<
    string | null,
    ContentStructureAnchorSourceNode[]
  >();
  for (const row of rows) {
    const bucket = childrenByParentId.get(row.parentId) ?? [];
    bucket.push(row);
    childrenByParentId.set(row.parentId, bucket);
  }
  for (const bucket of childrenByParentId.values()) {
    bucket.sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  }

  const anchors: ContentStructureAnchorWrite[] = [];

  function visit(
    row: ContentStructureAnchorSourceNode,
    ancestorNodeIds: string[],
    ancestorPositions: string[],
    ancestorTitles: string[],
  ): void {
    const path = [...ancestorNodeIds, row.id];
    const titlePath = [...ancestorTitles, row.title];
    const positionPath = [...ancestorPositions, row.position].join(".");
    if (row.contentUnitId) {
      anchors.push({
        nodeId: row.id,
        ownerUnitId,
        contentUnitId: row.contentUnitId,
        parentNodeId: row.parentId,
        ancestorNodeIds,
        path,
        depth: ancestorNodeIds.length,
        position: row.position,
        positionPath,
        titlePath,
      });
    }

    for (const child of childrenByParentId.get(row.id) ?? []) {
      visit(child, path, [...ancestorPositions, row.position], titlePath);
    }
  }

  for (const root of childrenByParentId.get(null) ?? []) {
    visit(root, [], [], []);
  }

  return anchors;
}

export async function rebuildContentStructureAnchors(
  tx: ContentStructureTx,
  ownerUnitId: string,
): Promise<void> {
  const rows = await tx.findNodes(ownerUnitId, { isDeleted: false });
  const anchors = buildContentStructureAnchorRows(ownerUnitId, rows);

  await tx.deleteAnchors(ownerUnitId);
  await tx.createAnchors(anchors);
}

async function softDeleteNodesInTx(
  tx: ContentStructureTx,
  ownerUnitId: string,
  nodeIds: readonly string[],
): Promise<void> {
  if (nodeIds.length === 0) return;
  await tx.updateManyNodes(
    ownerUnitId,
    { isDeleted: false, parentIds: nodeIds, excludeIds: nodeIds },
    { parentId: null },
  );
  await tx.updateManyNodes(
    ownerUnitId,
    { ids: nodeIds, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
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
    position: row.position,
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
      existing.position !== plan.position
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

    const positions = allocatePositions(siblings, ids, parentId, existingById);

    for (let i = 0; i < siblings.length; i++) {
      const node = siblings[i]!;
      const id = ids[i]!;
      out.push({
        id,
        parentId,
        position: positions[i]!,
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

function allocatePositions(
  siblings: readonly ContentStructureItem[],
  assignedIds: readonly string[],
  parentId: string | null,
  existingById: ReadonlyMap<string, ExistingContentStructureRow>,
): string[] {
  const existingPositions = assignedIds.map((id, i) => {
    const node = siblings[i]!;
    if (!node.id) return null;
    const existing = existingById.get(id);
    if (!existing || existing.parentId !== parentId) return null;
    return existing.position;
  });

  const result: string[] = [];
  for (let i = 0; i < siblings.length; i++) {
    const prev = result[i - 1] ?? null;
    const candidate = existingPositions[i] ?? null;

    if (candidate !== null && (prev === null || candidate > prev)) {
      result.push(candidate);
      continue;
    }

    let upper: string | null = null;
    for (let j = i + 1; j < siblings.length; j++) {
      const e = existingPositions[j] ?? null;
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
