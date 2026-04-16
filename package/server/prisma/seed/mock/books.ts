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

      // Batch attributions + tags for this unit
      const personAttributions = pickN(people, randomInt(1, 3)).map((p, i) => ({
        unitId: unit.id,
        entityId: p.unitId,
        role: faker.helpers.arrayElement(BOOK_PERSON_ROLES),
        sortOrder: i,
      }));

      const orgAttributions = pickN(organizations, randomInt(0, 2)).map((o, i) => ({
        unitId: unit.id,
        entityId: o.unitId,
        role: faker.helpers.arrayElement(BOOK_ORG_ROLES),
        sortOrder: i,
      }));

      const attributions = [...personAttributions, ...orgAttributions];

      const tagLinks = pickN(tags, randomInt(1, 5)).map((t) => ({
        unitId: unit.id,
        tagUnitId: t.id,
      }));

      await Promise.all([
        attributions.length > 0
          ? prisma.attribution.createMany({ data: attributions })
          : Promise.resolve(),
        tagLinks.length > 0
          ? prisma.unitTag.createMany({ data: tagLinks })
          : Promise.resolve(),
      ]);

      return unit;
    },
  );

  return created;
}

/**
 * Create chapters for a book and return a nested tree structure.
 * Chapters are Unit(type=CHAPTER) + UnitTranslation. The tree is stored in BookIndex.
 */
export async function seedChaptersForBook(
  prisma: PrismaClient,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: <bookUnitId>
  bookUnitId: string,
  bookUserId: string,
  opts?: {
    topLevelCount?: number;
    minChildren?: number;
    maxChildren?: number;
  },
): Promise<ChapterTreeItem[]> {
  const topLevelCount =
    opts?.topLevelCount ?? faker.number.int({ min: 1, max: 4 });
  const minChildren = opts?.minChildren ?? 5;
  const maxChildren = opts?.maxChildren ?? 20;

  const tree: ChapterTreeItem[] = [];

  for (let t = 0; t < topLevelCount; t++) {
    const parentTitle = generateTitle(2, 4);
    const parentId = randomUUID();

    await prisma.unit.create({
      data: {
        id: parentId,
        userId: bookUserId,
        type: UnitType.CHAPTER,
        status: UnitStatus.PUBLISHED,
        defaultLanguage: DEFAULT_LANGUAGE,
        translations: {
          create: { language: DEFAULT_LANGUAGE, title: parentTitle },
        },
        supportLanguages: {
          create: { language: DEFAULT_LANGUAGE, isPrimary: true },
        },
      },
    });

    const childCount = faker.number.int({ min: minChildren, max: maxChildren });
    const children: ChapterTreeItem[] = [];

    // Batch create child chapter Units + translations
    const childData = Array.from({ length: childCount }, () => {
      const noContent = faker.datatype.boolean({ probability: 0.2 });
      const childTitle = faker.lorem.words({ min: 3, max: 6 });
      return { id: randomUUID(), title: childTitle, noContent };
    });

    // Create child units in chunks
    await chunkedParallel(childData, CHUNK_SIZE, async (child) => {
      await prisma.unit.create({
        data: {
          id: child.id,
          userId: bookUserId,
          type: UnitType.CHAPTER,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          translations: {
            create: {
              language: DEFAULT_LANGUAGE,
              title: child.title,
              description: child.noContent
                ? undefined
                : generateParagraph(1, 3),
            },
          },
          supportLanguages: {
            create: { language: DEFAULT_LANGUAGE, isPrimary: true },
          },
        },
      });

      children.push({
        id: child.id,
        title: child.title,
        noContent: child.noContent,
      });
    });

    tree.push({
      id: parentId,
      title: parentTitle,
      noContent: true,
      children,
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
