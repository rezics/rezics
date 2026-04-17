import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE, type ChapterTreeItem } from "@rezics/contract";
import type { Prisma, PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { getRandomBookCover } from "./data.js";
import { generateBookExtra, generateTranslations } from "./generators.js";
import type {
  CreatedEntity,
  CreatedUnit,
  CreatedUser,
} from "./types.js";
import {
  chunkedParallel,
  generateParagraph,
  generateTitle,
  pickN,
  powerLaw,
  randomBoolean,
  randomInt,
} from "./utils.js";

const CHUNK_SIZE = 10;

/**
 * Seed books using chunked Promise.all.
 * Each book = Unit + Book extension + UnitTranslation + UnitSupportLanguage + credits + tags.
 */
const BOOK_PERSON_ROLES = ["author", "illustrator", "translator", "editor"];
const BOOK_ORG_ROLES = ["publisher", "distributor"];

export async function seedBooks(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  people: CreatedEntity[],
  organizations: CreatedEntity[],
  tags: CreatedUnit[],
): Promise<CreatedUnit[]> {
  console.log(`[Seed] Seeding ${total} books...`);

  const allAttributions: Prisma.AttributionCreateManyInput[] = [];
  const allTagLinks: Prisma.UnitTagCreateManyInput[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.BOOK);

      const unit = await prisma.unit.create({
        data: {
          type: UnitType.BOOK,
          userId: author.unitId,
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
              coverUrl: getRandomBookCover(),
              extra: generateBookExtra(),
              chapterIndex: {
                create: { index: {} as Prisma.InputJsonValue },
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
        allAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(BOOK_PERSON_ROLES),
          sortOrder: i,
        });
      }
      for (const [i, o] of pickN(organizations, randomInt(0, 2)).entries()) {
        allAttributions.push({
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

  await flushAttributionsAndTags(prisma, allAttributions, allTagLinks);

  return created;
}

async function flushAttributionsAndTags(
  prisma: PrismaClient,
  attributions: Prisma.AttributionCreateManyInput[],
  tagLinks: Prisma.UnitTagCreateManyInput[],
): Promise<void> {
  const BATCH = 500;
  for (let i = 0; i < attributions.length; i += BATCH) {
    await prisma.attribution.createMany({
      data: attributions.slice(i, i + BATCH),
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

export { flushAttributionsAndTags };

/**
 * Create chapters for a book and return a nested tree structure.
 * Chapters are Unit(type=CHAPTER) + UnitTranslation. The tree is stored in BookIndex.
 */
const CHAPTER_BATCH_THRESHOLD = 50;
const CHAPTER_BATCH_SIZE = 500;

export async function seedChaptersForBook(
  prisma: PrismaClient,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: <bookUnitId>
  bookUnitId: string,
  bookUserId: string,
): Promise<ChapterTreeItem[]> {
  // Power-law: most books small, rare mega-books with 500+ chapters
  const totalChapters = powerLaw(5, 1200, 2.0);
  const topLevelCount = Math.max(1, Math.min(6, Math.ceil(totalChapters / 40)));
  const useBatch = totalChapters > CHAPTER_BATCH_THRESHOLD;

  const tree: ChapterTreeItem[] = [];

  // Distribute children as evenly as possible across top-level parents
  const childCounts: number[] = Array.from({ length: topLevelCount }, (_, i) =>
    Math.floor(totalChapters / topLevelCount) +
    (i < totalChapters % topLevelCount ? 1 : 0),
  );

  interface ChapterUnitRow {
    id: string;
    title: string;
    description?: string;
  }
  const parentRows: ChapterUnitRow[] = [];
  const childRows: ChapterUnitRow[] = [];
  const childTreeByParent: ChapterTreeItem[][] = [];

  for (let t = 0; t < topLevelCount; t++) {
    const parentTitle = generateTitle(2, 4);
    const parentId = randomUUID();
    parentRows.push({ id: parentId, title: parentTitle });

    const children: ChapterTreeItem[] = [];
    childTreeByParent.push(children);

    const childCount = childCounts[t]!;
    for (let c = 0; c < childCount; c++) {
      const noContent = faker.datatype.boolean({ probability: 0.2 });
      const childTitle = faker.lorem.words({ min: 3, max: 6 });
      const id = randomUUID();
      childRows.push({
        id,
        title: childTitle,
        description: noContent ? undefined : generateParagraph(1, 3),
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

  const allRows = [...parentRows, ...childRows];

  if (useBatch) {
    for (let i = 0; i < allRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = allRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await prisma.unit.createMany({
        data: chunk.map((r) => ({
          id: r.id,
          userId: bookUserId,
          type: UnitType.CHAPTER,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
        })),
      });
    }
    for (let i = 0; i < allRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = allRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await prisma.unitTranslation.createMany({
        data: chunk.map((r) => ({
          unitId: r.id,
          language: DEFAULT_LANGUAGE,
          title: r.title,
          description: r.description,
        })),
      });
    }
    for (let i = 0; i < allRows.length; i += CHAPTER_BATCH_SIZE) {
      const chunk = allRows.slice(i, i + CHAPTER_BATCH_SIZE);
      await prisma.unitSupportLanguage.createMany({
        data: chunk.map((r) => ({
          unitId: r.id,
          language: DEFAULT_LANGUAGE,
          isPrimary: true,
          sortOrder: 0,
        })),
      });
    }
  } else {
    await chunkedParallel(allRows, CHUNK_SIZE, async (row) => {
      await prisma.unit.create({
        data: {
          id: row.id,
          userId: bookUserId,
          type: UnitType.CHAPTER,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          translations: {
            create: {
              language: DEFAULT_LANGUAGE,
              title: row.title,
              description: row.description,
            },
          },
          supportLanguages: {
            create: { language: DEFAULT_LANGUAGE, isPrimary: true },
          },
        },
      });
    });
  }

  return tree;
}

/**
 * Update BookIndex with the chapter tree JSON.
 */
export async function updateChapterIndex(
  prisma: PrismaClient,
  bookId: string,
  chapterIndex: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.bookIndex.update({
    where: { bookUnitId: bookId },
    data: { index: chapterIndex },
  });
}
