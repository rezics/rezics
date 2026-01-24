// Type only used in server, otherwise use contract

import type {Unit, User, Prisma, Tag, ReactionSummary} from '@/prisma/client';

/**
 * Internal Unit type with relations
 */
export type UnitWithRelations = Unit & {
  user: User;
  tags: Tag[];
  reactionSummaries: ReactionSummary[];
};

/**
 * Prisma include for unit relations
 */
export const unitInclude = {
  user: true,
  tags: true,
  reactionSummaries: true,
} satisfies Prisma.UnitInclude;
