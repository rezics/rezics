import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  type ChapterTreeItem,
  DEFAULT_LANGUAGE,
  withCoverUrl,
} from "@rezics/contract";
import type { Prisma, PrismaClient } from "../generated/client.js";
import { PostKind, UnitStatus, UnitType } from "../generated/client.js";
import { getRandomBookCover } from "./data.js";
import { generateBookExtra, generateTranslations } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type {
  ChapterPlan,
  CreatedEntity,
  CreatedUnit,
  CreatedUser,
} from "./types.js";
import {
  chunkedParallel,
  generateParagraph,
  generateTitle,
  pickN,
  randomBoolean,
  randomInt,
} from "./utils.js";

const CHUNK_SIZE = 10;

const BOOK_PERSON_ROLES = ["author", "illustrator", "translator", "editor"];
const BOOK_ORG_ROLES = ["publisher", "distributor"];

export async function seedBooks(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
  people: CreatedEntity[],
  organizations: CreatedEntity[],
  tags: CreatedUnit[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} books...`);

  const allCreditAttributions: Prisma.CreditAttributionCreateManyInput[] = [];
  const allTagLinks: Prisma.UnitTagCreateManyInput[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.BOOK);
      const coverUrl = getRandomBookCover();

      const unit = await ctx.prisma.unit.create({
        data: {
          type: UnitType.BOOK,
          userId: author.userId,
          slugScope: author.userId,
          status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.9)
            ? faker.date.past({ years: 3 })
            : null,
          book: {
            create: {
              isbn13: randomBoolean(0.8) ? faker.commerce.isbn() : null,
              publicationDate: randomBoolean(0.7)
                ? faker.date.past({ years: 20 })
                : null,
              pageCount: randomInt(80, 1200),
              textLength: randomInt(20000, 500000),
              formatKey: faker.helpers.arrayElement([
                "paperback",
                "hardcover",
                "ebook",
              ]),
              extra: generateBookExtra(),
              contentStructure: {
                create: {},
              },
            },
          },
          translations: {
            create: translations.map((t) => ({
              language: t.language,
              title: t.title,
              subtitle: t.subtitle,
              summary: t.summary,
              description: t.description,
              extra:
                t.language === DEFAULT_LANGUAGE
                  ? (withCoverUrl(undefined, coverUrl) as Prisma.InputJsonValue)
                  : undefined,
            })),
          },
          supportLanguages: {
            create: translations.map((t, i) => ({
              language: t.language,
              isPrimary: i === 0,
              sortOrder: i,
            })),
          },
        },
        select: { id: true, type: true },
      });

      for (const [i, p] of pickN(people, randomInt(1, 3)).entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(BOOK_PERSON_ROLES),
          sortOrder: i,
        });
      }
      for (const [i, o] of pickN(organizations, randomInt(0, 2)).entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: o.unitId,
          role: faker.helpers.arrayElement(BOOK_ORG_ROLES),
          sortOrder: i,
        });
      }
      for (const t of pickN(tags, randomInt(1, 5))) {
        allTagLinks.push({ unitId: unit.id, tagUnitId: t.id });
      }

      return unit;
    },
  );

  await flushCreditAttributionsAndTags(
    ctx.prisma,
    allCreditAttributions,
    allTagLinks,
  );

  return created;
}

async function flushCreditAttributionsAndTags(
  prisma: PrismaClient,
  creditAttributions: Prisma.CreditAttributionCreateManyInput[],
  tagLinks: Prisma.UnitTagCreateManyInput[],
): Promise<void> {
  const BATCH = 500;
  for (let i = 0; i < creditAttributions.length; i += BATCH) {
    await prisma.creditAttribution.createMany({
      data: creditAttributions.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < tagLinks.length; i += BATCH) {
    await prisma.unitTag.createMany({
      data: tagLinks.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }
}

export { flushCreditAttributionsAndTags };

const CHAPTER_BATCH_THRESHOLD = 50;
const CHAPTER_BATCH_SIZE = 500;

export async function seedChaptersForBook(
  ctx: SeedCtx,
  bookUnitId: string,
  bookUserId: string,
  chapterPlan: ChapterPlan,
): Promise<ChapterTreeItem[]> {
  const totalChapters = ctx.draw(chapterPlan.count);
  const topLevelCount = Math.max(1, Math.min(6, Math.ceil(totalChapters / 40)));
  const useBatch = totalChapters > CHAPTER_BATCH_THRESHOLD;

  type FactoryChapterTreeItem = ChapterTreeItem & { id?: string };
  const tree: FactoryChapterTreeItem[] = [];

  // Distribute children as evenly as possible across top-level parents
  const childCounts: number[] = Array.from(
    { length: topLevelCount },
    (_, i) =>
      Math.floor(totalChapters / topLevelCount) +
      (i < totalChapters % topLevelCount ? 1 : 0),
  );

  interface ChapterUnitRow {
    id: string;
    title: string;
    body?: string;
  }
  const parentRows: ChapterUnitRow[] = [];
  const childRows: ChapterUnitRow[] = [];

  for (let t = 0; t < topLevelCount; t++) {
    const parentTitle = generateTitle(2, 4);
    const parentId = randomUUID();
    parentRows.push({ id: parentId, title: parentTitle });

    const children: FactoryChapterTreeItem[] = [];

    const childCount = childCounts[t]!;
    for (let c = 0; c < childCount; c++) {
      const noContent = faker.datatype.boolean({ probability: 0.2 });
      const childTitle = faker.lorem.words({ min: 3, max: 6 });
      const id = randomUUID();
      childRows.push({
        id,
        title: childTitle,
        body: noContent ? undefined : generateParagraph(1, 3),
      });
      children.push({ id, title: childTitle, noContent });
    }

    tree.push({
      id: parentId,
      title: parentTitle,
      noContent: true,
      children,
    });
  }

  // Tree is always fully built; Units are only materialized for a random
  // subset. The rest live as BookContentStructureNode rows with
  // chapterUnitId = NULL and can be lazily promoted to a Unit at runtime
  // when something needs to attach to them (review target, comment, etc.).
  const allRows = [...parentRows, ...childRows];
  const materializedRows = allRows.filter(
    () => Math.random() < chapterPlan.unitProbability,
  );

  function serializeTree(nodes: FactoryChapterTreeItem[]): ChapterTreeItem[] {
    const materializedIds = new Set(materializedRows.map((row) => row.id));
    return nodes.map(({ id, children, ...node }) => ({
      ...node,
      ...(id && materializedIds.has(id) ? { chapterUnitId: id } : {}),
      ...(children ? { children: serializeTree(children) } : {}),
    }));
  }

  if (materializedRows.length === 0) {
    await insertNodeRows(ctx.prisma, bookUnitId, tree, materializedRows);
    return serializeTree(tree);
  }

  if (useBatch) {
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.prisma.unit.createMany({
        data: chunk.map((r) => ({
          id: r.id,
          userId: bookUserId,
          slugScope: bookUserId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
        })),
      });
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.prisma.unitTranslation.createMany({
        data: chunk.map((r) => ({
          unitId: r.id,
          language: DEFAULT_LANGUAGE,
          title: r.title,
        })),
      });
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.prisma.unitSupportLanguage.createMany({
        data: chunk.map((r) => ({
          unitId: r.id,
          language: DEFAULT_LANGUAGE,
          isPrimary: true,
          sortOrder: 0,
        })),
      });
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.prisma.post.createMany({
        data: chunk.map((r) => ({
          unitId: r.id,
          authorUserId: bookUserId,
          targetUnitId: bookUnitId,
          kind: PostKind.CHAPTER,
          body: r.body ?? "",
          rootPostUnitId: r.id,
          depth: 0,
        })),
      });
    }
  } else {
    await chunkedParallel(materializedRows, CHUNK_SIZE, async (row) => {
      await ctx.prisma.unit.create({
        data: {
          id: row.id,
          userId: bookUserId,
          slugScope: bookUserId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          translations: {
            create: {
              language: DEFAULT_LANGUAGE,
              title: row.title,
            },
          },
          supportLanguages: {
            create: { language: DEFAULT_LANGUAGE, isPrimary: true },
          },
          post: {
            create: {
              authorUserId: bookUserId,
              targetUnitId: bookUnitId,
              kind: PostKind.CHAPTER,
              body: row.body ?? "",
              rootPostUnitId: row.id,
              depth: 0,
            },
          },
        },
      });
    });
  }

  // Chapter Units now exist; insert BookContentStructureNode rows referencing them.
  await insertNodeRows(ctx.prisma, bookUnitId, tree, materializedRows);

  if ((chapterPlan.multiLinkChapterProbability ?? 0) > 0) {
    await insertMultiLinkNodes(
      ctx.prisma,
      bookUnitId,
      materializedRows,
      chapterPlan.multiLinkChapterProbability ?? 0,
    );
  }

  return serializeTree(tree);
}

// LexoRank generation — lightweight base36 fractional indexing for sibling
// ordering. Mirrors the runtime utility but kept inline to avoid factory
// importing from server/src.
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

const NODE_BATCH_SIZE = 500;

interface NodeRowInput {
  id: string;
  bookUnitId: string;
  parentId: string | null;
  sortKey: string;
  chapterUnitId: string | null;
  title: string;
  noContent: boolean;
}

interface TreeNode {
  id?: string;
  title: string;
  noContent?: boolean;
  children?: TreeNode[];
}

/**
 * Flatten the in-memory tree into BookContentStructureNode row inputs and
 * batch-insert via createMany. Each sibling gets a sortKey via lexoBetween
 * keyed off its left neighbour.
 */
async function insertNodeRows(
  prisma: PrismaClient,
  bookUnitId: string,
  tree: TreeNode[],
  materializedRows: Array<{ id: string }>,
): Promise<void> {
  const materializedIds = new Set(materializedRows.map((r) => r.id));
  const rows: NodeRowInput[] = [];

  function visit(nodes: TreeNode[], parentId: string | null): void {
    let prevKey: string | null = null;
    for (const node of nodes) {
      const id = node.id ?? randomUUID();
      const key = lexoBetween(prevKey, null);
      rows.push({
        id,
        bookUnitId,
        parentId,
        sortKey: key,
        chapterUnitId: materializedIds.has(id) ? id : null,
        title: node.title,
        noContent: node.noContent === true,
      });
      prevKey = key;
      if (node.children && node.children.length > 0) {
        visit(node.children, id);
      }
    }
  }

  visit(tree, null);

  for (let i = 0; i < rows.length; i += NODE_BATCH_SIZE) {
    await prisma.bookContentStructureNode.createMany({
      data: rows.slice(i, i + NODE_BATCH_SIZE),
    });
  }
}

/**
 * Insert additional multi-link node rows for a sample of materialized
 * chapters. Each picked chapter gets one extra BookContentStructureNode row
 * with the same `chapterUnitId` but a fresh `id` / `parentId` / `sortKey`,
 * exercising the multi-link contract end-to-end.
 */
export async function insertMultiLinkNodes(
  prisma: PrismaClient,
  bookUnitId: string,
  materializedRows: Array<{ id: string; title: string }>,
  multiLinkProbability: number,
): Promise<number> {
  if (multiLinkProbability <= 0 || materializedRows.length === 0) return 0;

  // Fetch root sortKeys for this book so we can append after the last root.
  const roots = await prisma.bookContentStructureNode.findMany({
    where: { bookUnitId, parentId: null },
    select: { sortKey: true },
    orderBy: { sortKey: "desc" },
    take: 1,
  });
  let lastSortKey = roots[0]?.sortKey ?? null;

  const extras: NodeRowInput[] = [];
  for (const row of materializedRows) {
    if (Math.random() >= multiLinkProbability) continue;
    const key = lexoBetween(lastSortKey, null);
    extras.push({
      id: randomUUID(),
      bookUnitId,
      parentId: null,
      sortKey: key,
      chapterUnitId: row.id,
      title: row.title,
      noContent: false,
    });
    lastSortKey = key;
  }

  for (let i = 0; i < extras.length; i += NODE_BATCH_SIZE) {
    await prisma.bookContentStructureNode.createMany({
      data: extras.slice(i, i + NODE_BATCH_SIZE),
    });
  }
  return extras.length;
}
