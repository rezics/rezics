import {faker} from '@faker-js/faker';
import type {PrismaClient} from '../generated/client.js';
import type {CreatedUser} from './types.js';
import {createUsernameGenerator, generateParagraph} from './utils.js';
import {getRandomPressUserName, getRandomProducerUserName} from './data.js';
import {randomUUID} from 'crypto';

function generateSlug(name: string) {
  let slug = name.replace(/\s+/g, '_');
  const uuid = randomUUID();
  slug += `_${uuid}`;
  return slug;
}

/**
 * Seed users into database
 * @param prisma - Prisma client instance
 * @param total - Number of users to create
 * @returns Array of created users
 */
export async function seedUsers(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedUser[]> {
  console.log(`👥 Seeding ${total} users...`);
  const nextUsername = createUsernameGenerator();
  const users: CreatedUser[] = [];

  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: faker.internet.password({length: 32}),
      slug: 'admin',
      name: 'Admin',
      avatar: faker.image.avatar(),
      bio: generateParagraph(1, 2),
      description: generateParagraph(5, 10),
      joinDate: faker.date.past({years: 4}),
      permissions: {
        roles: ['ADMIN'],
      },
    },
    select: {unitId: true, name: true},
  });

  for (let i = 0; i < total; i++) {
    const username = nextUsername();
    const slug = generateSlug(username);
    const created = await prisma.user.create({
      data: {
        email: `${slug}@example.com`,
        passwordHash: faker.internet.password({length: 32}),
        slug,
        name: username,
        avatar: faker.image.avatar(),
        bio: generateParagraph(1, 2),
        description: generateParagraph(5, 10),
        joinDate: faker.date.past({years: 4}),
      },
      select: {unitId: true, name: true},
    });
    users.push(created);
  }

  return users;
}

export async function seedPressUsers(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedUser[]> {
  console.log(`👥 Seeding ${total} press users...`);
  const users: CreatedUser[] = [];

  for (let i = 0; i < total; i++) {
    const username = getRandomPressUserName();
    const slug = generateSlug(username);
    const created = await prisma.user.create({
      data: {
        email: `${slug}@example.com`,
        passwordHash: faker.internet.password({length: 32}),
        slug,
        name: username,
        avatar: faker.image.avatar(),
        bio: generateParagraph(1, 2),
        joinDate: faker.date.past({years: 4}),
      },
      select: {unitId: true, name: true},
    });
    users.push(created);
  }

  return users;
}

export async function seedProducerUsers(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedUser[]> {
  console.log(`👥 Seeding ${total} producer users...`);
  const users: CreatedUser[] = [];

  for (let i = 0; i < total; i++) {
    const username = getRandomProducerUserName();
    const slug = generateSlug(username);
    const created = await prisma.user.create({
      data: {
        email: `${slug}@example.com`,
        passwordHash: faker.internet.password({length: 32}),
        slug,
        name: username,
        avatar: faker.image.avatar(),
        bio: generateParagraph(1, 2),
        joinDate: faker.date.past({years: 4}),
      },
      select: {unitId: true, name: true},
    });
    users.push(created);
  }

  return users;
}
