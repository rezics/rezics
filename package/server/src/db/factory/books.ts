import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  type BookContentStructureItem,
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  markdownContentDoc,
  withCoverUrl,
} from "@rezics/contract";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { ServerDb } from "../client.js";
import {
  Book,
  ContentStructureNode,
  ContentTranslation,
  CreditAttribution,
  Post,
  Unit,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
} from "../schema";
import {
  ensureFactoryContentStructure,
  rebuildFactoryContentStructureAnchors,
} from "./content-structure.js";
import { getRandomBookCover } from "./data.js";
import { generateBookExtra, generateTranslations } from "./generators.js";
import { PostKind, UnitStatus, UnitType } from "./storage-values.js";
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
  withUpdatedAt,
  withUpdatedAtRows,
} from "./utils.js";

const CHUNK_SIZE = 10;

const BOOK_PERSON_ROLES = ["author", "illustrator", "translator", "editor"];
const BOOK_ORG_ROLES = ["publisher", "distributor"];

export type FactoryCreditAttributionInsert =
  typeof CreditAttribution.$inferInsert;
export type FactoryUnitTagInsert = typeof UnitTag.$inferInsert;

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

  const allCreditAttributions: FactoryCreditAttributionInsert[] = [];
  const allTagLinks: FactoryUnitTagInsert[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.BOOK);
      const coverUrl = getRandomBookCover();

      const [unit] = await ctx.db
        .insert(Unit)
        .values(
          withUpdatedAt({
            id: randomUUID(),
            type: UnitType.BOOK,
            userId: author.userId,
            slugScope: author.userId,
            status: randomBoolean(0.85)
              ? UnitStatus.PUBLISHED
              : UnitStatus.DRAFT,
            licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
            defaultLanguage: DEFAULT_LANGUAGE,
            publishedAt: randomBoolean(0.9)
              ? faker.date.past({ years: 3 })
              : null,
          }),
        )
        .returning({ id: Unit.id, type: Unit.type });
      if (!unit) throw new Error("Failed to create seeded book unit.");

      await ctx.db.insert(Book).values(
        withUpdatedAt({
          unitId: unit.id,
          isbn13: randomBoolean(0.8) ? faker.commerce.isbn() : null,
          publicationDate: randomBoolean(0.7)
            ? faker.date.past({ years: 20 })
            : null,
          pageCount: randomInt(80, 1200),
          textLength: randomInt(20000, 500000),
          chapterCount: 0,
          formatKey: faker.helpers.arrayElement([
            "paperback",
            "hardcover",
            "ebook",
          ]),
          extra: generateBookExtra(),
        }),
      );
      await ctx.db.insert(UnitTranslation).values(
        withUpdatedAtRows(
          translations.map((t) => ({
            unitId: unit.id,
            language: t.language,
            title: t.title,
            subtitle: t.subtitle,
            summary: t.summary,
            description: t.description,
            extra:
              t.language === DEFAULT_LANGUAGE
                ? (withCoverUrl(undefined, coverUrl) as never)
                : undefined,
          })),
        ),
      );
      await ctx.db.insert(UnitSupportLanguage).values(
        withUpdatedAtRows(
          translations.map((t, i) => ({
            unitId: unit.id,
            language: t.language,
            isPrimary: i === 0,
            sortOrder: i,
          })),
        ),
      );
      await ensureFactoryContentStructure(ctx.db, unit.id);

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
        allTagLinks.push(withUpdatedAt({ unitId: unit.id, tagUnitId: t.id }));
      }

      return unit;
    },
  );

  await flushCreditAttributionsAndTags(
    ctx.db,
    allCreditAttributions,
    allTagLinks,
  );

  return created;
}

async function flushCreditAttributionsAndTags(
  db: Pick<ServerDb, "insert">,
  creditAttributions: FactoryCreditAttributionInsert[],
  tagLinks: FactoryUnitTagInsert[],
): Promise<void> {
  const BATCH = 500;
  for (let i = 0; i < creditAttributions.length; i += BATCH) {
    const batch = creditAttributions.slice(i, i + BATCH);
    if (batch.length === 0) continue;
    await db.insert(CreditAttribution).values(batch).onConflictDoNothing();
  }
  for (let i = 0; i < tagLinks.length; i += BATCH) {
    const batch = tagLinks.slice(i, i + BATCH);
    if (batch.length === 0) continue;
    await db.insert(UnitTag).values(batch).onConflictDoNothing();
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
): Promise<BookContentStructureItem[]> {
  const totalChapters = ctx.draw(chapterPlan.count);
  const topLevelCount = Math.max(1, Math.min(6, Math.ceil(totalChapters / 40)));
  const useBatch = totalChapters > CHAPTER_BATCH_THRESHOLD;

  type FactoryBookContentStructureItem = BookContentStructureItem & {
    id?: string;
  };
  const tree: FactoryBookContentStructureItem[] = [];

  // Distribute children as evenly as possible across top-level parents
  // 在顶层父节点之间尽量均匀地分配子节点
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

    const children: FactoryBookContentStructureItem[] = [];

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
  // subset. The rest live as ContentStructureNode rows with
  // contentUnitId = NULL and can be lazily promoted to a Unit at runtime
  // when something needs to attach to them (review target, comment, etc.).
  // 树始终完整构建；但只为随机子集物化 Unit。其余的以 contentUnitId = NULL 的
  // ContentStructureNode 行存在，当需要附加到它们的内容（评价目标、评论等）时，
  // 可在运行时惰性提升为 Unit。
  const allRows = [...parentRows, ...childRows];
  const materializedRows = allRows.filter(
    () => Math.random() < chapterPlan.unitProbability,
  );

  function serializeTree(
    nodes: FactoryBookContentStructureItem[],
  ): BookContentStructureItem[] {
    const materializedIds = new Set(materializedRows.map((row) => row.id));
    return nodes.map(({ id, children, ...node }) => ({
      ...node,
      ...(id && materializedIds.has(id) ? { contentUnitId: id } : {}),
      ...(children ? { children: serializeTree(children) } : {}),
    }));
  }

  let chapterCount = 0;

  if (materializedRows.length === 0) {
    chapterCount = await insertNodeRows(
      ctx.db,
      bookUnitId,
      tree,
      materializedRows,
    );
    await ctx.db
      .update(Book)
      .set({ chapterCount })
      .where(eq(Book.unitId, bookUnitId));
    return serializeTree(tree);
  }

  if (useBatch) {
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.db.insert(Unit).values(
        withUpdatedAtRows(
          chunk.map((r) => ({
            id: r.id,
            userId: bookUserId,
            slugScope: bookUserId,
            type: UnitType.POST,
            targetUnitId: bookUnitId,
            status: UnitStatus.PUBLISHED,
            licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
            defaultLanguage: DEFAULT_LANGUAGE,
          })),
        ),
      );
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.db.insert(UnitTranslation).values(
        withUpdatedAtRows(
          chunk.map((r) => ({
            unitId: r.id,
            language: DEFAULT_LANGUAGE,
            title: r.title,
          })),
        ),
      );
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.db.insert(UnitSupportLanguage).values(
        withUpdatedAtRows(
          chunk.map((r) => ({
            unitId: r.id,
            language: DEFAULT_LANGUAGE,
            isPrimary: true,
            sortOrder: 0,
          })),
        ),
      );
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.db.insert(Post).values(
        withUpdatedAtRows(
          chunk.map((r) => ({
            unitId: r.id,
            authorUserId: bookUserId,
            kind: PostKind.CHAPTER,
          })),
        ),
      );
    }
    for (let i = 0; i < materializedRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = materializedRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await ctx.db.insert(ContentTranslation).values(
        withUpdatedAtRows(
          chunk.map((r) => ({
            unitId: r.id,
            language: DEFAULT_LANGUAGE,
            content: markdownContentDoc(r.body ?? "") as never,
            status: "PUBLISHED" as const,
            authorUserId: bookUserId,
            provenance: { importedFrom: "factory-book-chapter-seed" },
          })),
        ),
      );
    }
  } else {
    await chunkedParallel(materializedRows, CHUNK_SIZE, async (row) => {
      await ctx.db.insert(Unit).values(
        withUpdatedAt({
          id: row.id,
          userId: bookUserId,
          slugScope: bookUserId,
          type: UnitType.POST,
          targetUnitId: bookUnitId,
          status: UnitStatus.PUBLISHED,
          licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          defaultLanguage: DEFAULT_LANGUAGE,
        }),
      );
      await ctx.db.insert(UnitTranslation).values(
        withUpdatedAt({
          unitId: row.id,
          language: DEFAULT_LANGUAGE,
          title: row.title,
        }),
      );
      await ctx.db.insert(UnitSupportLanguage).values(
        withUpdatedAt({
          unitId: row.id,
          language: DEFAULT_LANGUAGE,
          isPrimary: true,
        }),
      );
      await ctx.db.insert(Post).values(
        withUpdatedAt({
          unitId: row.id,
          authorUserId: bookUserId,
          kind: PostKind.CHAPTER,
        }),
      );
      await ctx.db.insert(ContentTranslation).values(
        withUpdatedAt({
          unitId: row.id,
          language: DEFAULT_LANGUAGE,
          content: markdownContentDoc(row.body ?? "") as never,
          status: "PUBLISHED" as const,
          authorUserId: bookUserId,
          provenance: { importedFrom: "factory-book-chapter-seed" },
        }),
      );
    });
  }

  // Chapter Units now exist; insert ContentStructureNode rows referencing them.
  // 章节 Unit 现已存在；插入引用它们的 ContentStructureNode 行。
  chapterCount = await insertNodeRows(
    ctx.db,
    bookUnitId,
    tree,
    materializedRows,
  );

  if ((chapterPlan.multiLinkChapterProbability ?? 0) > 0) {
    chapterCount += await insertMultiLinkNodes(
      ctx.db,
      bookUnitId,
      materializedRows,
      chapterPlan.multiLinkChapterProbability ?? 0,
    );
  }

  await ctx.db
    .update(Book)
    .set({ chapterCount })
    .where(eq(Book.unitId, bookUnitId));

  for (const row of materializedRows) {
    await ctx.sync.post(row.id);
  }

  return serializeTree(tree);
}

// Base36 fractional-index position generation for sibling ordering.
// Mirrors the runtime utility but kept inline to avoid factory importing from
// server/src.
// 用于同级排序的 Base36 分数索引位置生成。
// 与运行时工具保持一致，但保留为内联实现，以避免 factory 从 server/src 导入。
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
  ownerUnitId: string;
  parentId: string | null;
  position: string;
  contentUnitId: string | null;
  title: string;
  noContent: boolean;
  updatedAt: Date;
}

interface TreeNode {
  id?: string;
  title: string;
  noContent?: boolean;
  children?: TreeNode[];
}

/**
 * Flatten the in-memory tree into ContentStructureNode row inputs and
 * batch-insert via createMany. Each sibling gets a position via lexoBetween
 * keyed off its left neighbour.
 * 将内存中的树展平为 ContentStructureNode 行输入，并通过 createMany 批量插入。
 * 每个同级节点都以其左邻居为基准，通过 lexoBetween 获得一个 position。
 */
async function insertNodeRows(
  db: Pick<ServerDb, "delete" | "insert" | "select">,
  bookUnitId: string,
  tree: TreeNode[],
  materializedRows: Array<{ id: string }>,
): Promise<number> {
  const materializedIds = new Set(materializedRows.map((r) => r.id));
  const rows: NodeRowInput[] = [];

  function visit(nodes: TreeNode[], parentId: string | null): void {
    let prevKey: string | null = null;
    for (const node of nodes) {
      const id = node.id ?? randomUUID();
      const key = lexoBetween(prevKey, null);
      rows.push({
        id,
        ownerUnitId: bookUnitId,
        parentId,
        position: key,
        contentUnitId: materializedIds.has(id) ? id : null,
        title: node.title,
        noContent: node.noContent === true,
        updatedAt: new Date(),
      });
      prevKey = key;
      if (node.children && node.children.length > 0) {
        visit(node.children, id);
      }
    }
  }

  visit(tree, null);

  for (let i = 0; i < rows.length; i += NODE_BATCH_SIZE) {
    await db
      .insert(ContentStructureNode)
      .values(rows.slice(i, i + NODE_BATCH_SIZE));
  }
  await rebuildFactoryContentStructureAnchors(db, bookUnitId);

  return rows.filter((row) => !row.noContent).length;
}

/**
 * Insert additional multi-link node rows for a sample of materialized
 * chapters. Each picked chapter gets one extra ContentStructureNode row with
 * the same `contentUnitId` but a fresh `id` / `parentId` / `position`,
 * exercising the multi-link contract end-to-end.
 * 为部分已物化的章节插入额外的多链接节点行。每个被选中的章节获得一个额外的
 * ContentStructureNode 行，其 `contentUnitId` 相同，但 `id` / `parentId` /
 * `position` 全新，从而端到端地演练多链接契约。
 */
export async function insertMultiLinkNodes(
  db: Pick<ServerDb, "delete" | "insert" | "select">,
  bookUnitId: string,
  materializedRows: Array<{ id: string; title: string }>,
  multiLinkProbability: number,
): Promise<number> {
  if (multiLinkProbability <= 0 || materializedRows.length === 0) return 0;

  // Fetch root positions for this book so we can append after the last root.
  // 获取该书的根节点 position，以便可以追加到最后一个根节点之后。
  const roots = await db
    .select({ position: ContentStructureNode.position })
    .from(ContentStructureNode)
    .where(
      and(
        eq(ContentStructureNode.ownerUnitId, bookUnitId),
        isNull(ContentStructureNode.parentId),
      ),
    )
    .orderBy(desc(ContentStructureNode.position))
    .limit(1);
  let lastPosition = roots[0]?.position ?? null;

  const extras: NodeRowInput[] = [];
  for (const row of materializedRows) {
    if (Math.random() >= multiLinkProbability) continue;
    const key = lexoBetween(lastPosition, null);
    extras.push({
      id: randomUUID(),
      ownerUnitId: bookUnitId,
      parentId: null,
      position: key,
      contentUnitId: row.id,
      title: row.title,
      noContent: false,
      updatedAt: new Date(),
    });
    lastPosition = key;
  }

  for (let i = 0; i < extras.length; i += NODE_BATCH_SIZE) {
    await db
      .insert(ContentStructureNode)
      .values(extras.slice(i, i + NODE_BATCH_SIZE));
  }
  if (extras.length > 0) {
    await rebuildFactoryContentStructureAnchors(db, bookUnitId);
  }
  return extras.length;
}
