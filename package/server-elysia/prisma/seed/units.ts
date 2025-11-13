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
 * Unit types to generate (excluding BOOK and COMMENT)
 */
const UNIT_TYPES: UnitType[] = [
  UnitTypeEnum.NOTE,
  UnitTypeEnum.REVIEW,
  UnitTypeEnum.QUOTE,
  UnitTypeEnum.IMAGE,
  UnitTypeEnum.VIDEO,
];

/**
 * Seed other units (non-book, non-comment units)
 * @param prisma - Prisma client instance
 * @param total - Number of units to create
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
  console.log(`📝 Seeding ${total} other units...`);
  const created: CreatedUnit[] = [];

  for (let i = 0; i < total; i++) {
    const author = faker.helpers.arrayElement(users);
    const type = faker.helpers.arrayElement(UNIT_TYPES);
    const title = buildUnitTitleByType(type);
    const metadata = buildMetadataByType(type, {bookIds: bookUnitIds});
    const publishedAt = randomBoolean(0.8) ? faker.date.past({years: 2}) : null;

    // Set target unit for reviews, quotes, and chapters
    let targetUnitId: string | null = null;
    if (
      (type === UnitTypeEnum.REVIEW ||
        type === UnitTypeEnum.QUOTE ||
        type === UnitTypeEnum.CHAPTER) &&
      bookUnitIds.length > 0
    ) {
      targetUnitId = faker.helpers.arrayElement(bookUnitIds);
    }

    const unit = await prisma.unit.create({
      data: {
        userId: author.unitId,
        type,
        status: randomBoolean(0.9) ? UnitStatus.ACTIVE : UnitStatus.DRAFT,
        title,
        content: randomBoolean(0.8) ? generateParagraph(1, 4) : null,
        metadata,
        targetUnitId: targetUnitId ?? undefined,
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
