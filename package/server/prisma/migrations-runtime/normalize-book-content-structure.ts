/**
 * One-time runtime migration: convert every legacy
 * `BookContentStructure.nodes` JSON value into normalized
 * `BookContentStructureNode` rows.
 *
 * Must be run BEFORE the `drop_book_content_structure_nodes_json` Prisma
 * migration. Once the column is dropped this script reports zero rows.
 *
 * Usage:
 *   bun --filter=@rezics/server run migrate:content-structure
 *   bun --filter=@rezics/server run migrate:content-structure -- --dry-run
 *
 * The script is non-destructive: it never drops the legacy `nodes` column;
 * that happens in a separate Prisma migration after parity is confirmed.
 */

import { randomUUID } from "node:crypto";
import type { BookContentStructureItem, ContentRating } from "@rezics/contract";
import { prisma } from "../client";
import {
  type BookContentStructureNodeRow,
  buildTree,
} from "../../src/book/book-content-structure";
import { between } from "../../src/book/lexorank";

const BATCH_SIZE = 500;

interface RowInput {
  id: string;
  bookUnitId: string;
  parentId: string | null;
  sortKey: string;
  chapterUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNode(value: unknown): BookContentStructureItem {
  const source = isObject(value) ? value : {};
  const node: BookContentStructureItem = {
    title: typeof source.title === "string" ? source.title : "",
  };
  if (typeof source.chapterUnitId === "string") {
    node.chapterUnitId = source.chapterUnitId;
  }
  if (typeof source.noContent === "boolean") node.noContent = source.noContent;
  if (typeof source.rating === "string") {
    node.rating = source.rating as ContentRating;
  }
  if (Array.isArray(source.children)) {
    node.children = source.children.map(normalizeNode);
  }
  return node;
}

function normalizeJsonNodes(value: unknown): BookContentStructureItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeNode);
}

function flattenJsonTree(
  bookUnitId: string,
  nodes: BookContentStructureItem[],
): RowInput[] {
  const out: RowInput[] = [];

  function visit(
    siblings: BookContentStructureItem[],
    parentId: string | null,
  ): void {
    let prevKey: string | null = null;
    for (const node of siblings) {
      const id = randomUUID();
      const sortKey = between(prevKey, null);
      out.push({
        id,
        bookUnitId,
        parentId,
        sortKey,
        chapterUnitId: node.chapterUnitId ?? null,
        title: node.title,
        noContent: node.noContent === true,
        rating: node.rating ?? null,
      });
      prevKey = sortKey;
      if (node.children && node.children.length > 0) {
        visit(node.children, id);
      }
    }
  }

  visit(nodes, null);
  return out;
}

function stripDerivedFields(
  items: BookContentStructureItem[],
): BookContentStructureItem[] {
  return items.map((item) => {
    const cleaned: BookContentStructureItem = { title: item.title };
    if (item.chapterUnitId) cleaned.chapterUnitId = item.chapterUnitId;
    if (item.noContent === true) cleaned.noContent = item.noContent;
    if (item.rating) cleaned.rating = item.rating;
    if (item.children && item.children.length > 0) {
      cleaned.children = stripDerivedFields(item.children);
    }
    return cleaned;
  });
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ak = Object.keys(a as Record<string, unknown>).sort();
  const bk = Object.keys(b as Record<string, unknown>).sort();
  if (ak.length !== bk.length) return false;
  if (!ak.every((k, i) => k === bk[i])) return false;
  return ak.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

async function readLegacyContainers(): Promise<
  Array<{ bookUnitId: string; nodes: unknown }>
> {
  // Raw query against the legacy column; returns zero rows after the
  // drop_book_content_structure_nodes_json Prisma migration is applied.
  try {
    return await prisma.$queryRawUnsafe<
      Array<{ bookUnitId: string; nodes: unknown }>
    >(`SELECT "bookUnitId", "nodes" FROM "BookContentStructure"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/column .*nodes.* does not exist/i.test(message)) {
      console.log(
        "[migrate-content-structure] legacy `nodes` column already dropped — nothing to migrate",
      );
      return [];
    }
    throw err;
  }
}

async function verifyBook(
  bookUnitId: string,
  source: BookContentStructureItem[],
): Promise<{ ok: boolean; reason?: string }> {
  const rows = await prisma.bookContentStructureNode.findMany({
    where: { bookUnitId },
  });
  const assembled = buildTree(
    rows.map(
      (r): BookContentStructureNodeRow => ({
        id: r.id,
        bookUnitId: r.bookUnitId,
        parentId: r.parentId,
        sortKey: r.sortKey,
        chapterUnitId: r.chapterUnitId,
        title: r.title,
        noContent: r.noContent,
        rating: r.rating,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    ),
  );
  const expected = stripDerivedFields(source);
  const actual = stripDerivedFields(assembled);
  if (!deepEqual(expected, actual)) {
    return {
      ok: false,
      reason: `assembled tree differs from source JSON for book ${bookUnitId}`,
    };
  }
  return { ok: true };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `[migrate-content-structure] starting (${dryRun ? "dry-run" : "real"})`,
  );

  const containers = await readLegacyContainers();
  console.log(
    `[migrate-content-structure] found ${containers.length} BookContentStructure rows`,
  );

  let totalNodes = 0;
  const failures: string[] = [];

  for (const container of containers) {
    const sourceNodes = normalizeJsonNodes(container.nodes);
    const rows = flattenJsonTree(container.bookUnitId, sourceNodes);
    totalNodes += rows.length;

    if (!dryRun) {
      const existingCount = await prisma.bookContentStructureNode.count({
        where: { bookUnitId: container.bookUnitId },
      });
      if (existingCount > 0) {
        console.log(
          `[migrate-content-structure]   skip book ${container.bookUnitId} (already has ${existingCount} rows)`,
        );
      } else {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          await prisma.bookContentStructureNode.createMany({
            data: rows.slice(i, i + BATCH_SIZE),
          });
        }
      }
    }

    if (dryRun) {
      const fakeRows: BookContentStructureNodeRow[] = rows.map((r) => ({
        ...r,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }));
      const assembled = buildTree(fakeRows);
      if (
        !deepEqual(
          stripDerivedFields(sourceNodes),
          stripDerivedFields(assembled),
        )
      ) {
        failures.push(container.bookUnitId);
      }
    } else {
      const result = await verifyBook(container.bookUnitId, sourceNodes);
      if (!result.ok) failures.push(container.bookUnitId);
    }
  }

  console.log(
    `[migrate-content-structure] ${dryRun ? "dry-run " : ""}migrated: ${containers.length} books, ${totalNodes} nodes`,
  );

  if (failures.length > 0) {
    console.error(
      `[migrate-content-structure] FAILED verification for ${failures.length} books:`,
      failures,
    );
    process.exit(1);
  }

  console.log("[migrate-content-structure] verification passed");
}

main()
  .catch((err) => {
    console.error("[migrate-content-structure] error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
