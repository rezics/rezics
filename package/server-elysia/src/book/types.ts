// Type only used in server, otherwise use contract

import type {Book, User, Unit, Prisma} from '@/prisma/client';

/**
 * Internal book type with relations
 */
export type BookWithRelations = Book & {
  unit: Unit & {user: User};
  author: User[];
  press: User[];
  producer: User[];
};

/**
 * Query filter types
 */
export type BookFilterOptions = {
  q?: string;
  tag?: string;
  tags?: string;
  authorId?: string;
  authorIds?: string;
  pressId?: string;
  pressIds?: string;
  producerId?: string;
  producerIds?: string;
  userId?: string;
  isbn?: string;
  page?: number;
  limit?: number;
};

/**
 * Prisma include for book relations
 */
export const bookInclude = {
  unit: {include: {user: true}},
  author: true,
  press: true,
  producer: true,
} satisfies Prisma.BookInclude;
