import { faker } from "@faker-js/faker";
import type { Prisma, PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { getRandomBookCover } from "./data.js";
import { buildUnitTitleByType, generateBookExtra } from "./generators.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import {
  upsertBookmarkCountForUnit,
  upsertReactionSummariesForUnit,
} from "./unitStats.js";
import {
  generateParagraph,
  generateTitle,
  pickN,
  randomBoolean,
  randomInt,
} from "./utils.js";

// Chapter tree structure to store into BookIndex.index
interface ChapterIndexChapter {
  id: string;
  title: string;
  noContent: boolean;
}

export interface ChapterTreeIndex {
  chapters: Record<string, ChapterIndexChapter>;
  order: Record<string, string[]>; // parentId -> children ids
}

/**
 * Seed books into database
 * @param prisma - Prisma client instance
 * @param total - Number of books to create
 * @param users - Array of created users
 * @param tagUnitIds - Array of tag unit IDs
 * @returns Array of created book units
 */
export async function seedBooks(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  pressUsers: CreatedUser[],
  producerUsers: CreatedUser[],
  tagUnitIds: string[],
): Promise<CreatedUnit[]> {
  console.log(`📚 Seeding ${total} books...`);
  const created: CreatedUnit[] = [];

  for (let i = 0; i < total; i++) {
    const author = faker.helpers.arrayElement(users);
    const title = buildUnitTitleByType(UnitType.BOOK) ?? generateTitle(2, 5);
    const publishedAt = randomBoolean(0.9)
      ? faker.date.past({ years: 3 })
      : null;

    const unit = await prisma.unit.create({
      data: {
        userId: author.unitId,
        type: UnitType.BOOK,
        status: randomBoolean(0.85) ? UnitStatus.ACTIVE : UnitStatus.DRAFT,
        title,
        content: generateParagraph(2, 5),
        metadata: {},
        publishedAt,
        tags: {
          connect: pickN(tagUnitIds, randomInt(1, 5)).map((unitId) => ({
            unitId,
          })),
        },
      },
      select: { id: true, type: true },
    });

    await prisma.book.create({
      data: {
        unitId: unit.id,
        title,
        author: {
          connect: pickN(users, randomInt(1, 3)).map((u) => ({
            unitId: u.unitId,
          })),
        },
        press: {
          connect: pickN(pressUsers, randomInt(1, 3)).map((u) => ({
            unitId: u.unitId,
          })),
        },
        producer: {
          connect: pickN(producerUsers, randomInt(1, 3)).map((u) => ({
            unitId: u.unitId,
          })),
        },
        coverUrl: randomBoolean(0.8) ? getRandomBookCover() : null,
        isbn: randomBoolean(0.8) ? faker.commerce.isbn() : null,
        chapterIndex: {
          // Create placeholder JSON; will be updated after we actually create chapter units per book
          create: { index: {} as Prisma.InputJsonValue },
        },
        description: generateParagraph(1, 2),
        extra: generateBookExtra(),
      },
    });

    await upsertBookmarkCountForUnit(prisma, unit.id, randomInt(0, 100));
    await upsertReactionSummariesForUnit(prisma, unit.id, {
      like: randomInt(0, 250),
      dislike: randomInt(0, 50),
      love: randomInt(0, 180),
    });

    created.push(unit);
  }

  return created;
}

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

import type { ChapterTreeItem } from "@rezics/contract";

/**
 * Create chapters for a book and return a nested tree structure array.
 * The structure is `ChapterTreeItem[]`
 */
export async function seedChaptersForBook(
  prisma: PrismaClient,
  bookUnitId: string,
  opts?: { topLevelCount?: number; minChildren?: number; maxChildren?: number },
): Promise<ChapterTreeItem[]> {
  const topLevelCount =
    opts?.topLevelCount ?? faker.number.int({ min: 1, max: 4 });
  const minChildren = opts?.minChildren ?? 20;
  const maxChildren = opts?.maxChildren ?? 100;

  // Get the book's userId (optimized redundant query)
  const bookUnit = await prisma.unit.findUnique({
    where: { id: bookUnitId },
    select: { userId: true },
  });

  if (!bookUnit) {
    throw new Error("Book unit not found");
  }

  const bookUserId = bookUnit.userId;
  const tree: ChapterTreeItem[] = [];

  // Create top-level chapters (usually noContent is true)
  for (let t = 0; t < topLevelCount; t++) {
    const parentTitle = generateTitle(2, 4);
    const parent = await prisma.unit.create({
      data: {
        userId: bookUserId,
        type: UnitType.CHAPTER,
        status: UnitStatus.ACTIVE,
        title: parentTitle,
        content: null,
        metadata: {},
        targetUnitId: bookUnitId,
      },
      select: { id: true },
    });

    // Loop to generate subchapters under the current parent chapter
    const childCount = faker.number.int({ min: minChildren, max: maxChildren });
    const children: ChapterTreeItem[] = [];

    for (let i = 0; i < childCount; i++) {
      const noContent = faker.datatype.boolean({ probability: 0.2 });
      const childTitle = faker.lorem.words({ min: 3, max: 6 });
      const child = await prisma.unit.create({
        data: {
          userId: bookUserId,
          type: UnitType.CHAPTER,
          status: UnitStatus.ACTIVE,
          title: childTitle,
          content: noContent ? null : generateParagraph(1, 3),
          metadata: {},
          targetUnitId: bookUnitId,
        },
        select: { id: true },
      });

      // Push the subchapter into the local children array
      children.push({
        id: child.id,
        title: childTitle,
        noContent,
      });
    }

    // Put the assembled parent chapter and its children into the final tree
    tree.push({
      id: parent.id,
      title: parentTitle,
      noContent: true,
      children,
    });
  }

  return tree;
}
