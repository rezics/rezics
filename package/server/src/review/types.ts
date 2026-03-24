// Type only used in server, otherwise use contract

import type {Prisma, Unit, User, Tag, ReactionSummary} from '#/prisma/client';

/**
 * Internal review type with relations (stored in Unit)
 */
export type ReviewWithRelations = Unit & {
  user: User;
  tags: Tag[];
  targetUnit?: Unit & {book?: unknown};
  reactionSummaries: ReactionSummary[];
};

/**
 * Prisma include for review relations
 */
export const reviewInclude = {
  user: true,
  tags: true,
  reactionSummaries: true,
  targetUnit: {include: {book: true, reactionSummaries: true}},
} satisfies Prisma.UnitInclude;
