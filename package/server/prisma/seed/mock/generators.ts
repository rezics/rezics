import {faker} from '@faker-js/faker';
import type {UnitType, Prisma} from '#/prisma/generated/client.js';
import {UnitType as UnitTypeEnum} from '#/prisma/generated/client.js';
import {
  randomInt,
  randomFloat,
  randomBoolean,
  pickN,
  generateTitle,
} from './utils.js';

/**
 * Generate book extra metadata
 * @returns Book metadata object
 */
export function generateBookExtra(): Prisma.InputJsonValue {
  return {
    publisher: faker.company.name(),
    year: faker.date.past({years: 45}).getFullYear(),
    language: faker.helpers.arrayElement(['en', 'zh', 'es', 'fr', 'de', 'jp']),
    format: faker.helpers.arrayElement(['paperback', 'hardcover', 'ebook']),
  };
}

/**
 * Generate chapters index as JSON string
 * @returns JSON string of chapter array
 * TODO Need refactor, chapter structure has changed
 */
export function generateChapters(): Prisma.InputJsonValue {
  // const chapterCount = randomInt(5, 20);
  // return JSON.stringify(
  //   Array.from({length: chapterCount}, (_, i) => ({
  //     index: i + 1,
  //     title: generateTitle(2, 4),
  //     pages: randomInt(5, 30),
  //   })),
  // );
  // return chapterList01;
  return [];
}

/**
 * Build unit title based on unit type
 * @param type - Unit type
 * @returns Title string or null for types without titles
 */
export function buildUnitTitleByType(type: UnitType): string | null {
  switch (type) {
    case UnitTypeEnum.BOOK:
      return generateTitle(2, 5);
    case UnitTypeEnum.REVIEW:
      return generateTitle(3, 6);
    case UnitTypeEnum.QUOTE:
      return null;
    case UnitTypeEnum.NOTE:
      return generateTitle(2, 6);
    case UnitTypeEnum.READLIST:
      return generateTitle(2, 4);
    case UnitTypeEnum.IMAGE:
    case UnitTypeEnum.VIDEO:
      return generateTitle(2, 5);
    case UnitTypeEnum.COMMENT:
      return null;
    default:
      return generateTitle(2, 6);
  }
}

/**
 * Build metadata object based on unit type
 * @param type - Unit type
 * @param context - Context with available book IDs
 * @returns Metadata object
 */
export function buildMetadataByType(
  type: UnitType,
  context: {bookIds: string[]},
): Prisma.InputJsonValue {
  switch (type) {
    case UnitTypeEnum.REVIEW:
      return {
        rating: Math.round(randomFloat(1, 5) * 10) / 10,
        title: generateTitle(2, 5),
      };
    case UnitTypeEnum.REMARK:
      return {
        rating: Math.round(randomFloat(1, 5) * 10) / 10,
        title: generateTitle(2, 5),
      };
    case UnitTypeEnum.QUOTE:
      return {
        source: faker.lorem.sentence(),
      };
    case UnitTypeEnum.READLIST: {
      const count = randomInt(3, Math.min(10, context.bookIds.length));
      const selected = pickN(context.bookIds, count);
      return {
        coverUrl: faker.image.url({width: 400, height: 600}),
        books: selected,
      };
    }
    case UnitTypeEnum.IMAGE:
      return {
        url: faker.image.url({width: 800, height: 600}),
      };
    case UnitTypeEnum.VIDEO:
      return {url: faker.internet.url()};
    case UnitTypeEnum.NOTE:
      return {pinned: randomBoolean(0.1)};
    default:
      return {} as Prisma.InputJsonValue;
  }
}
