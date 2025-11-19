import {faker} from '@faker-js/faker';
import type {PrismaClient, UnitType} from '../generated/client.js';
import {UnitType as UnitTypeEnum, UnitStatus} from '../generated/client.js';
import type {CreatedUser, CreatedUnit} from './types.js';
import {randomInt, randomBoolean, pickN, generateParagraph} from './utils.js';
import {buildUnitTitleByType, buildMetadataByType} from './generators.js';
import {
  upsertReactionSummariesForUnit,
  upsertViewCountForUnit,
} from './unitStats.js';

/**
 * Per-book unit types to generate
 */
const PER_BOOK_TYPES: UnitType[] = [
  UnitTypeEnum.QUOTE,
  UnitTypeEnum.REVIEW,
  UnitTypeEnum.REMARK,
];

/**
 * Seed units:
 * 1) For each book in bookUnitIds, generate 10-100 of each: QUOTE, REVIEW, REMARK
 * 2) Then generate `total` CHAPTER units across random books
 * @param prisma - Prisma client instance
 * @param total - Number of CHAPTER units to create
 * @param users - Array of created users
 * @param bookUnitIds - Array of book unit IDs
 * @param tagUnitIds - Array of tag unit IDs
 * @returns Array of created units
 */
export async function seedOtherUnits(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  bookUnitIds: string[],
  tagUnitIds: string[],
): Promise<CreatedUnit[]> {
  console.log(
    `📝 Seeding per-book QUOTE/REVIEW/REMARK and ${total} CHAPTER units...`,
  );
  const created: CreatedUnit[] = [];

  if (bookUnitIds.length === 0) {
    console.warn(
      '⚠️ No bookUnitIds provided; skipping unit seeding tied to books.',
    );
    return created;
  }

  // 1) For each book, generate 10-100 of each: QUOTE, REVIEW, REMARK
  for (const bookUnitId of bookUnitIds) {
    for (const type of PER_BOOK_TYPES) {
      const countForType = randomInt(10, 100);
      for (let i = 0; i < countForType; i++) {
        const author = faker.helpers.arrayElement(users);
        const title = buildUnitTitleByType(type);
        const metadata = buildMetadataByType(type, {bookIds: [bookUnitId]});
        const publishedAt = randomBoolean(0.8)
          ? faker.date.past({years: 2})
          : null;

        const unit = await prisma.unit.create({
          data: {
            userId: author.unitId,
            type,
            status: randomBoolean(0.9) ? UnitStatus.ACTIVE : UnitStatus.DRAFT,
            title,
            content: randomBoolean(0.8) ? generateParagraph(1, 4) : null,
            metadata,
            targetUnitId: bookUnitId,
            publishedAt,
            tags: {
              connect: pickN(tagUnitIds, randomInt(0, 4)).map(unitId => ({
                unitId,
              })),
            },
          },
          select: {id: true, type: true},
        });

        if (type === UnitTypeEnum.REMARK || type === UnitTypeEnum.REVIEW) {
          const rating = (metadata as {rating: number}).rating;
          await prisma.rating.upsert({
            where: {unitId_domain: {unitId: bookUnitId, domain: bookUnitId}},
            update: {
              domain: bookUnitId,
              totalScore: {
                increment: rating,
              },
              totalCount: {
                increment: 1,
              },
            },
            create: {
              unitId: bookUnitId,
              domain: bookUnitId,
              totalScore: rating,
              totalCount: 1,
            },
          });
        }

        await upsertViewCountForUnit(prisma, unit.id, randomInt(0, 10_000));
        await upsertReactionSummariesForUnit(prisma, unit.id, {
          like: randomInt(0, 300),
          dislike: randomInt(0, 60),
          love: randomInt(0, 220),
        });

        created.push(unit);
      }
    }
  }

  // 2) Generate `total` CHAPTER units across random books
  for (let i = 0; i < total; i++) {
    const author = faker.helpers.arrayElement(users);
    const bookUnitId = faker.helpers.arrayElement(bookUnitIds);
    const type = UnitTypeEnum.CHAPTER;
    const title = buildUnitTitleByType(type);
    const metadata = buildMetadataByType(type, {bookIds: [bookUnitId]});
    const publishedAt = randomBoolean(0.8) ? faker.date.past({years: 2}) : null;

    const unit = await prisma.unit.create({
      data: {
        userId: author.unitId,
        type,
        status: randomBoolean(0.9) ? UnitStatus.ACTIVE : UnitStatus.DRAFT,
        title,
        content: randomBoolean(0.8) ? generateParagraph(1, 4) : null,
        metadata,
        targetUnitId: bookUnitId,
        publishedAt,
        tags: {
          connect: pickN(tagUnitIds, randomInt(0, 4)).map(unitId => ({unitId})),
        },
      },
      select: {id: true, type: true},
    });

    await upsertViewCountForUnit(prisma, unit.id, randomInt(0, 10_000));
    await upsertReactionSummariesForUnit(prisma, unit.id, {
      like: randomInt(0, 300),
      dislike: randomInt(0, 60),
      love: randomInt(0, 220),
    });

    created.push(unit);
  }

  return created;
}
