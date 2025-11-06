import {faker} from '@faker-js/faker';
import type {PrismaClient} from '../generated/client.js';
import {UnitType, UnitStatus} from '../generated/client.js';
import type {CreatedUser} from './types.js';
import {pickN, randomInt} from './utils.js';

/**
 * Tag types available in the system
 */
// const TAG_TYPES = ['general', 'genre', 'author', 'system'] as const;
const TAG_TYPES = ['book'] as const;

export async function seedTagDomains(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
): Promise<string[]> {
  console.log(`🏷️ Seeding ${total} tag domains...`);
  const tagDomainIds: string[] = [];

  for (let i = 0; i < total; i++) {
    const user = faker.helpers.arrayElement(users);
    const name = `${faker.word.adjective()} ${faker.word.noun()}`;
    const unit = await prisma.unit.create({
      data: {
        userId: user.unitId,
        type: UnitType.DOMAIN,
        status: UnitStatus.ACTIVE,
        title: `Tag Domain: ${name}`,
        content: `This is a tag domain`,
        metadata: {},
        publishedAt: faker.date.past({years: 1}),
      },
    });
    tagDomainIds.push(unit.id);
  }

  return tagDomainIds;
}

/**
 * Seed tags into database
 * @param prisma - Prisma client instance
 * @param total - Number of tags to create
 * @param users - Array of created users
 * @returns Array of tag unit IDs
 */
export async function seedTags(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
): Promise<string[]> {
  const tagDomainIds = await seedTagDomains(prisma, 20, users);

  console.log(`🏷️ Seeding ${total} tags...`);
  const tagUnitIds: string[] = [];

  for (let i = 0; i < total; i++) {
    const user = faker.helpers.arrayElement(users);
    const name = `${faker.word.adjective()} ${faker.word.noun()}`;
    const type = faker.helpers.arrayElement(TAG_TYPES);

    // Create a unit for the tag
    const unit = await prisma.unit.create({
      data: {
        userId: user.unitId,
        type: UnitType.TAG,
        status: UnitStatus.ACTIVE,
        title: `Tag: ${name}`,
        content: `This is a ${type} tag`,
        metadata: {},
        publishedAt: faker.date.past({years: 1}),
        domains: {
          connect: pickN(tagDomainIds, randomInt(1, 4)).map(unitId => ({
            id: unitId,
          })),
        },
      },
    });

    // Create the tag
    await prisma.tag.create({
      data: {
        unitId: unit.id,
        name,
        type,
      },
    });

    tagUnitIds.push(unit.id);
  }

  return tagUnitIds;
}
