// Type only used in server, otherwise use contract

import type { Prisma, Tag, Unit, User } from "#/prisma/client";

/**
 * Internal review type with relations (stored in Unit)
 */
export type ReviewWithRelations = Unit & {
  user: User;
  tags: Tag[];
  targetUnit?: Unit & { book?: unknown };
};

/**
 * Prisma include for review relations
 */
export const reviewInclude = {
  user: true,
  tags: true,
  targetUnit: { include: { book: true } },
} satisfies Prisma.UnitInclude;
