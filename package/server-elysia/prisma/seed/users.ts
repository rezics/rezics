import {faker} from '@faker-js/faker';
import type {PrismaClient} from '../generated/client.js';
import type {CreatedUser} from './types.js';
import {createUsernameGenerator, generateParagraph} from './utils.js';

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

  for (let i = 0; i < total; i++) {
    const username = nextUsername();
    const slug = username.replace(/\s+/g, '_');
    const created = await prisma.user.create({
      data: {
        email: faker.internet.email({firstName: username}),
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
