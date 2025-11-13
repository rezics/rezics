import {faker} from '@faker-js/faker';
import type {PrismaClient} from '../generated/client.js';
import {UnitType as UnitTypeEnum, UnitStatus} from '../generated/client.js';
import type {CreatedUser, CreatedUnit} from './types.js';
import {
  randomInt,
  randomBoolean,
  generateParagraph,
  randomFloat,
} from './utils.js';

import {seedComments} from './comments.js';
import {
  upsertReactionSummariesForUnit,
  upsertViewCountForUnit,
} from './unitStats.js';

/**
 * Seed ReadList units and their Book connections
 * - Creates a Unit with type READLIST per list
 * - Creates a ReadList row connecting selected Book records (by unitId)
 */
export async function seedReadLists(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  bookUnitIds: string[],
  reviewUnitIds: string[],
): Promise<CreatedUnit[]> {
  if (bookUnitIds.length < 3) {
    console.warn(
      '📚 Not enough books to seed read lists (need >= 3). Skipping readlist seeding.',
    );
    return [];
  }

  console.log(`📓 Seeding ${total} read lists...`);
  const created: CreatedUnit[] = [];

  for (let i = 0; i < total; i++) {
    const author = faker.helpers.arrayElement(users);

    // Choose a subset of books for this list
    const pickCount = randomInt(3, Math.min(10, bookUnitIds.length));
    const selectedBooks = faker.helpers.arrayElements(bookUnitIds, {
      min: pickCount,
      max: pickCount,
    });
    // For each selected book, we'll create a corresponding review Unit below

    const title = faker.lorem
      .words({min: 2, max: 4})
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const metadata = {
      coverUrl: faker.image.url({width: 400, height: 600}),
      books: selectedBooks,
    } as const;
    const publishedAt = randomBoolean(0.85)
      ? faker.date.past({years: 2})
      : null;

    const unit = await prisma.unit.create({
      data: {
        userId: author.unitId,
        type: UnitTypeEnum.READLIST,
        status: randomBoolean(0.9) ? UnitStatus.ACTIVE : UnitStatus.DRAFT,
        title,
        content: randomBoolean(0.6) ? generateParagraph(1, 3) : null,
        metadata,
        publishedAt,
      },
      select: {id: true, type: true},
    });

    // Create a review Unit for each selected book and attach both books and reviews to the readlist
    const createdReviewIds = await Promise.all(
      selectedBooks.map(bookUnitId =>
        createReviewUnit(prisma, {
          authorUserUnitId: author.unitId,
          bookUnitId,
        }),
      ),
    );

    const currentReadlist = await prisma.readList.create({
      data: {
        unitId: unit.id,
        book: {
          connect: selectedBooks.map(unitId => ({unitId})),
        },
        review: {
          // Connect by Unit.id for review relations
          connect: createdReviewIds.map(id => ({id})),
        },
      },
    });

    await createCommentTreeForReadlist(prisma, currentReadlist.unitId, users);

    await upsertViewCountForUnit(prisma, unit.id);
    await upsertReactionSummariesForUnit(prisma, unit.id, {
      like: randomInt(0, 200),
      dislike: randomInt(0, 40),
      love: randomInt(0, 160),
    });

    created.push(unit);
  }

  return created;
}

async function createCommentTreeForReadlist(
  prisma: PrismaClient,
  readlistUnitId: string,
  users: CreatedUser[],
): Promise<string> {
  const {perRootCount} = await seedComments(prisma, randomInt(20, 200), users, [
    readlistUnitId,
  ]);
  return '';
}
/**
 * Create a Review Unit for a given Book (by book's Unit ID)
 * and return the created review Unit's ID.
 */
async function createReviewUnit(
  prisma: PrismaClient,
  params: {authorUserUnitId: string; bookUnitId: string},
): Promise<string> {
  const {authorUserUnitId, bookUnitId} = params;

  const rating = Math.round(randomFloat(1, 5) * 10) / 10; // one decimal between 1.0 and 5.0
  const hasTitle = randomBoolean(0.7);
  const reviewTitle = hasTitle
    ? faker.lorem
        .words({min: 2, max: 5})
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : null;

  const review = await prisma.unit.create({
    data: {
      userId: authorUserUnitId,
      type: UnitTypeEnum.REVIEW,
      status: randomBoolean(0.9) ? UnitStatus.ACTIVE : UnitStatus.DRAFT,
      title: reviewTitle,
      content: generateParagraph(40, 400),
      metadata: {rating},
      targetUnitId: bookUnitId,
      publishedAt: faker.date.past({years: 2}),
    },
    select: {id: true},
  });

  await upsertViewCountForUnit(prisma, review.id);
  await upsertReactionSummariesForUnit(prisma, review.id, {
    like: randomInt(0, 120),
    dislike: randomInt(0, 30),
    love: randomInt(0, 100),
  });

  return review.id;
}
