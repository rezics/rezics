import {faker} from '@faker-js/faker';
import type {PrismaClient} from '../generated/client.js';
import {UnitType, UnitStatus} from '../generated/client.js';
import type {CreatedUser, CreatedUnit} from './types.js';
import {
  randomInt,
  randomBoolean,
  pickN,
  generateTitle,
  generateParagraph,
} from './utils.js';
import {
  buildUnitTitleByType,
  generateBookExtra,
  generateChapters,
} from './generators.js';
import {getRandomBookCover} from './data.js';

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
          connect: pickN(tagUnitIds, randomInt(0, 3)).map(unitId => ({unitId})),
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
          create: {index: ''},
        },
        description: generateParagraph(1, 2),
        extra: generateBookExtra(),
      },
    });

    await prisma.unitStats.create({data: {unitId: unit.id}});
    await prisma.unitReactions.create({
      data: {
        unitId: unit.id,
        likeCount: randomInt(0, 250),
        dislikeCount: randomInt(0, 50),
        loveCount: randomInt(0, 180),
      },
    });

    created.push(unit);
  }

  return created;
}

export async function updateChapterIndex(
  prisma: PrismaClient,
  bookId: string,
  chapterIndex: string,
): Promise<void> {
  await prisma.bookIndex.update({
    where: {bookUnitId: bookId},
    data: {index: chapterIndex},
  });
}
