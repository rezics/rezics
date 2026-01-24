// Type only used in server, otherwise use contract

import type {
  Book,
  User,
  Unit,
  Prisma,
  Tag,
  ReactionSummary,
} from '@/prisma/client';

/**
 * Internal book type with relations
 */
export type BookWithRelations = Book & {
  unit: Unit & {user: User; tags: Tag[]; reactionSummaries: ReactionSummary[]};
  author: User[];
  press: User[];
  producer: User[];
};

/**
 * Prisma include for book relations
 */
export const bookInclude = {
  unit: {include: {user: true, tags: true, reactionSummaries: true}},
  author: true,
  press: true,
  producer: true,
} satisfies Prisma.BookInclude;
