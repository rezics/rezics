import {faker} from '@faker-js/faker';
import type {PrismaClient} from '../generated/client.js';
import {UnitType, UnitStatus} from '../generated/client.js';
import type {CreatedUser} from './types.js';
import {randomInt, randomBoolean, generateParagraph} from './utils.js';

/**
 * Result of seeding comments
 */
export interface SeedCommentsResult {
  perRootCount: Map<string, number>;
}

/**
 * Seed comments into database
 * @param prisma - Prisma client instance
 * @param total - Number of comments to create
 * @param users - Array of created users
 * @param allRootUnitIds - Array of unit IDs that can have comments
 * @returns Comment count per root unit
 */
export async function seedComments(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  allRootUnitIds: string[],
): Promise<SeedCommentsResult> {
  console.log(`💬 Seeding ${total} comments...`);
  const perRootComments: Map<string, string[]> = new Map();
  const perRootCount: Map<string, number> = new Map();

  for (let i = 0; i < total; i++) {
    const root = faker.helpers.arrayElement(allRootUnitIds);
    const author = faker.helpers.arrayElement(users);
    const existing = perRootComments.get(root) ?? [];
    const hasParent = existing.length > 0 && randomBoolean(0.6);
    const parentCommentId = hasParent
      ? faker.helpers.arrayElement(existing)
      : null;
    const depth = parentCommentId ? randomInt(1, 4) : 0;

    const commentUnit = await prisma.unit.create({
      data: {
        userId: author.unitId,
        type: UnitType.COMMENT,
        status: UnitStatus.ACTIVE,
        title: null,
        content: generateParagraph(2, 5),
        metadata: {},
        targetUnitId: null,
        publishedAt: faker.date.past({years: 1}),
      },
      select: {id: true},
    });

    await prisma.commentIndex.create({
      data: {
        unitId: commentUnit.id,
        rootUnitId: root,
        parentCommentId: parentCommentId ?? undefined,
        depth,
      },
    });

    existing.push(commentUnit.id);
    perRootComments.set(root, existing);
    perRootCount.set(root, (perRootCount.get(root) ?? 0) + 1);
  }

  return {perRootCount};
}

/**
 * Update unit stats with comment counts
 * @param prisma - Prisma client instance
 * @param perRootCount - Map of unit IDs to comment counts
 */
export async function updateStatsWithCommentCounts(
  prisma: PrismaClient,
  perRootCount: Map<string, number>,
): Promise<void> {
  console.log('📊 Updating unit stats with comment counts...');
  const updates: Promise<unknown>[] = [];
  perRootCount.forEach((count, unitId) => {
    updates.push(
      prisma.unitStats.upsert({
        where: {unitId},
        create: {unitId, commentCount: count},
        update: {commentCount: count},
      }),
    );
  });
  await Promise.all(updates);
}
