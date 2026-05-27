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
    let previousSortKey: string | null = null;
    for (const node of siblings) {
      const id = node.id ?? randomUUID();
      const sortKey = lexoBetween(previousSortKey, null);
      rows.push({
        id,
        ownerUnitId,
        parentId,
        sortKey,
        contentUnitId: node.contentUnitId ?? null,
        title: node.title,
        noContent: node.noContent === true,
        rating: node.rating ?? null,
      });
      previousSortKey = sortKey;
      if (node.children?.length) {
        visit(node.children, id);
      }
    }
  }

  visit(nodes, null);
  if (rows.length > 0) {
    await prisma.contentStructureNode.createMany({ data: rows });
  }
  return rows;
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
