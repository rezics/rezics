import {faker} from '@faker-js/faker';
import type {PrismaClient, Prisma} from '../generated/client.js';
import {UnitType, UnitStatus} from '../generated/client.js';
import type {CreatedUser, CreatedUnit} from './types.js';
import {
  randomInt,
  randomBoolean,
  pickN,
  generateTitle,
  generateParagraph,
} from './utils.js';
import {buildUnitTitleByType, generateBookExtra} from './generators.js';
import {getRandomBookCover} from './data.js';
import {
  upsertReactionSummariesForUnit,
  upsertViewCountForUnit,
} from './unitStats.js';

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
    const publishedAt = randomBoolean(0.9) ? faker.date.past({years: 3}) : null;

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
          connect: pickN(tagUnitIds, randomInt(1, 5)).map(unitId => ({unitId})),
        },
      },
      select: {id: true, type: true},
    });

    await prisma.book.create({
      data: {
        unitId: unit.id,
        title,
        author: {
          connect: pickN(users, randomInt(1, 3)).map(u => ({unitId: u.unitId})),
        },
        press: {
          connect: pickN(pressUsers, randomInt(1, 3)).map(u => ({
            unitId: u.unitId,
          })),
        },
        producer: {
          connect: pickN(producerUsers, randomInt(1, 3)).map(u => ({
            unitId: u.unitId,
          })),
        },
        coverUrl: randomBoolean(0.8) ? getRandomBookCover() : null,
        isbn: randomBoolean(0.8) ? faker.commerce.isbn() : null,
        chapterIndex: {
          // Create placeholder JSON; will be updated after we actually create chapter units per book
          create: {index: {} as Prisma.InputJsonValue},
        },
        description: generateParagraph(1, 2),
        extra: generateBookExtra(),
      },
    });

    await upsertViewCountForUnit(prisma, unit.id);
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
    where: {bookUnitId: bookId},
    data: {index: chapterIndex},
  });
}

/**
 * Create chapter Units for a book and build a ChapterTreeIndex JSON referencing those Unit IDs.
 * The structure matches app's generateChapterTree: { chapters: Record<id, {id,title,noContent}>, order: Record<parentId, childIds[]> }.
 */
export async function seedChaptersForBook(
  prisma: PrismaClient,
  bookUnitId: string,
  opts?: {topLevelCount?: number; minChildren?: number; maxChildren?: number},
): Promise<ChapterTreeIndex> {
  const topLevelCount =
    opts?.topLevelCount ?? faker.number.int({min: 1, max: 4});
  const minChildren = opts?.minChildren ?? 20;
  const maxChildren = opts?.maxChildren ?? 100;

  const chapters: Record<string, ChapterIndexChapter> = {};
  const order: Record<string, string[]> = {};

  // Resolve the book's author userId once
  const bookUnit = await prisma.unit.findUnique({
    where: {id: bookUnitId},
    select: {userId: true},
  });
  const bookUserId =
    bookUnit?.userId ??
    (await prisma.unit.findFirst({
      where: {id: bookUnitId},
      select: {userId: true},
    }))!.userId;

  // Create top-level chapter groups (noContent=true)
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
        targetUnitId: bookUnitId, // reference the book
      },
      select: {id: true},
    });

    chapters[parent.id] = {
      id: parent.id,
      title: parentTitle,
      noContent: true,
    };

    // For deterministic title, we can reuse the created Unit's title, but since we generated above, keep as is
    // Generate children under this parent
    const childCount = faker.number.int({min: minChildren, max: maxChildren});
    const childIds: string[] = [];
    for (let i = 0; i < childCount; i++) {
      const noContent = faker.datatype.boolean({probability: 0.2});
      const childTitle = faker.lorem.words({min: 3, max: 6});
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
        select: {id: true /* title not needed here */},
      });

      chapters[child.id] = {
        id: child.id,
        title: childTitle,
        noContent,
      };
      childIds.push(child.id);
    }
    order[parent.id] = childIds;
  }

  return {chapters, order};
}
