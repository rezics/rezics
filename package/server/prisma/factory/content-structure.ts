import { randomUUID } from "node:crypto";
import type { ContentRating } from "@rezics/contract";
import type { Prisma, PrismaClient } from "../generated/client.js";

const LEXO_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const LEXO_FIRST = "0";
const LEXO_LAST = "z";

function lexoBetween(prev: string | null, next: string | null): string {
  const a = prev ?? "";
  const b = next ?? "";
  let i = 0;
  let result = "";
  while (true) {
    const da = i < a.length ? a[i]! : LEXO_FIRST;
    const db = b === "" ? LEXO_LAST : i < b.length ? b[i]! : LEXO_FIRST;
    if (da === db) {
      result += da;
      i++;
      continue;
    }
    const va = LEXO_ALPHABET.indexOf(da);
    const vb = LEXO_ALPHABET.indexOf(db);
    if (vb - va > 1) {
      result += LEXO_ALPHABET[va + Math.floor((vb - va) / 2)]!;
      return result;
    }
    result += da;
    i++;
    while (true) {
      const ta = i < a.length ? a[i]! : LEXO_FIRST;
      if (ta === LEXO_LAST) {
        result += LEXO_LAST;
        i++;
        continue;
      }
      result += LEXO_ALPHABET[LEXO_ALPHABET.indexOf(ta) + 1]!;
      return result;
    }
  }
}

export interface FactoryContentStructureNodeInput {
  id?: string;
  title: string;
  contentUnitId?: string | null;
  noContent?: boolean;
  rating?: ContentRating | null;
  children?: FactoryContentStructureNodeInput[];
}

export async function ensureFactoryContentStructure(
  prisma: PrismaClient,
  ownerUnitId: string,
) {
  await prisma.contentStructure.upsert({
    where: { ownerUnitId },
    create: { ownerUnitId },
    update: {},
  });
}

export async function createFactoryContentStructureNodes(
  prisma: PrismaClient,
  ownerUnitId: string,
  nodes: FactoryContentStructureNodeInput[],
) {
  await ensureFactoryContentStructure(prisma, ownerUnitId);
  const rows: Prisma.ContentStructureNodeCreateManyInput[] = [];

  function visit(
    siblings: FactoryContentStructureNodeInput[],
    parentId: string | null,
  ) {
    let previousPosition: string | null = null;
    for (const node of siblings) {
      const id = node.id ?? randomUUID();
      const position = lexoBetween(previousPosition, null);
      rows.push({
        id,
        ownerUnitId,
        parentId,
        position,
        contentUnitId: node.contentUnitId ?? null,
        title: node.title,
        noContent: node.noContent === true,
        rating: node.rating ?? null,
      });
      previousPosition = position;
      if (node.children?.length) {
        visit(node.children, id);
      }
    }
  }

  visit(nodes, null);
  if (rows.length > 0) {
    await prisma.contentStructureNode.createMany({ data: rows });
    await rebuildFactoryContentStructureAnchors(prisma, ownerUnitId);
  }
  return rows;
}

type FactoryContentStructureAnchorSourceNode = {
  id: string;
  parentId: string | null;
  position: string;
  contentUnitId: string | null;
  title: string;
};

export type FactoryContentStructureAnchorWrite = {
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

export function buildFactoryContentStructureAnchorRows(
  ownerUnitId: string,
  rows: readonly FactoryContentStructureAnchorSourceNode[],
): FactoryContentStructureAnchorWrite[] {
  const childrenByParentId = new Map<
    string | null,
    FactoryContentStructureAnchorSourceNode[]
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

  const anchors: FactoryContentStructureAnchorWrite[] = [];

  function visit(
    row: FactoryContentStructureAnchorSourceNode,
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

export async function rebuildFactoryContentStructureAnchors(
  prisma: PrismaClient,
  ownerUnitId: string,
): Promise<void> {
  const rows = await prisma.contentStructureNode.findMany({
    where: { ownerUnitId, isDeleted: false },
    select: {
      id: true,
      parentId: true,
      position: true,
      contentUnitId: true,
      title: true,
    },
  });
  const anchors = buildFactoryContentStructureAnchorRows(ownerUnitId, rows);

  await prisma.contentStructureAnchor.deleteMany({ where: { ownerUnitId } });
  if (anchors.length === 0) return;

  await prisma.contentStructureAnchor.createMany({
    data: anchors.map((anchor) => ({
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
    })),
  });
}

export async function createFactoryReleasePartStructure(
  prisma: PrismaClient,
  ownerUnitId: string,
  parts: Array<{ unitId: string; title: string }>,
) {
  return createFactoryContentStructureNodes(
    prisma,
    ownerUnitId,
    parts.map((part) => ({
      title: part.title,
      contentUnitId: part.unitId,
    })),
  );
}

export async function createFactorySeriesMemberStructure(
  prisma: PrismaClient,
  seriesUnitId: string,
  members: Array<{ unitId: string; title: string }>,
) {
  return createFactoryReleasePartStructure(prisma, seriesUnitId, members);
}
