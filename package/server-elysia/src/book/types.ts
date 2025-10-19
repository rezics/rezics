import type {Book, User, Post, Prisma} from '@/prisma/client';

/**
 * Internal book type with relations
 */
export type BookWithRelations = Book & {
  post: Post & {user: User};
  authors: User[];
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
  userId?: string;
  isbn?: string;
  page?: number;
  limit?: number;
};

/**
 * Prisma include for book relations
 */
export const bookInclude = {
  post: {include: {user: true}},
  authors: true,
} satisfies Prisma.BookInclude;
