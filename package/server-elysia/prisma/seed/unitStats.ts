import type {PrismaClient} from '../generated/client.js';
import {faker} from '@faker-js/faker';
import {randomInt} from './utils.js';

export type ReactionCounts = Partial<Record<string, number>>;

/**
 * Upsert a single ReactionSummary counter for a unit.
 */
export async function upsertReactionSummary(
  prisma: PrismaClient,
  params: {
    targetId: string;
    reaction: string;
    count: number;
    targetType?: string;
  },
): Promise<void> {
  const {targetId, reaction, count} = params;
  const targetType = params.targetType ?? 'Unit';
  await prisma.reactionSummary.upsert({
    where: {
      targetType_targetId_reaction: {targetType, targetId, reaction},
    },
    create: {targetType, targetId, reaction, count},
    update: {count},
  });
}

/**
 * Upsert multiple ReactionSummary counters for a unit.
 * Defaults to like/dislike/love random counts if not specified.
 */
export async function upsertReactionSummariesForUnit(
  prisma: PrismaClient,
  unitId: string,
  counts?: ReactionCounts,
  options?: {targetType?: string},
): Promise<void> {
  const targetType = options?.targetType ?? 'Unit';
  const merged: Record<string, number> = {
    like: counts?.like ?? randomInt(0, 300),
    dislike: counts?.dislike ?? randomInt(0, 60),
    love: counts?.love ?? randomInt(0, 220),
    ...counts,
  };
  const tasks = Object.entries(merged).map(([reaction, count]) =>
    upsertReactionSummary(prisma, {
      targetId: unitId,
      reaction,
      count,
      targetType,
    }),
  );
  await Promise.all(tasks);
}

/**
 * Upsert view count via ReactionSummary('view').
 */
export async function upsertViewCountForUnit(
  prisma: PrismaClient,
  unitId: string,
  viewCount?: number,
  options?: {targetType?: string},
): Promise<void> {
  await upsertReactionSummary(prisma, {
    targetId: unitId,
    reaction: 'view',
    count: viewCount ?? faker.number.int({min: 0, max: 10_000}),
    targetType: options?.targetType ?? 'Unit',
  });
}

/**
 * Upsert comment count via ReactionSummary('comment').
 */
export async function upsertCommentCountForUnit(
  prisma: PrismaClient,
  unitId: string,
  commentCount: number,
  options?: {targetType?: string},
): Promise<void> {
  await upsertReactionSummary(prisma, {
    targetId: unitId,
    reaction: 'comment',
    count: commentCount,
    targetType: options?.targetType ?? 'Unit',
  });
}

/**
 * Initialize or update Rating aggregate for a unit under a domain.
 * totalScore should be sum of individual scores; totalCount is number of ratings.
 */
export async function upsertRatingAggregate(
  prisma: PrismaClient,
  params: {
    unitId: string;
    domain?: string;
    totalScore: number;
    totalCount: number;
  },
): Promise<void> {
  const {unitId, totalScore, totalCount} = params;
  const domain = params.domain ?? unitId;
  await prisma.rating.upsert({
    where: {unitId_domain: {unitId, domain}},
    create: {unitId, domain, totalScore, totalCount},
    update: {totalScore, totalCount},
  });
}

/**
 * Convenience: seed a typical stats bundle for a unit (views + reactions).
 */
export async function seedStatsBundleForUnit(
  prisma: PrismaClient,
  unitId: string,
  options?: {targetType?: string},
): Promise<void> {
  await upsertViewCountForUnit(prisma, unitId, undefined, options);
  await upsertReactionSummariesForUnit(prisma, unitId, undefined, options);
}
