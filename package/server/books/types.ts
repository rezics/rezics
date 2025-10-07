import type {Book, User, Post, Prisma} from '../database-main/client';

/**
 * Internal book type with relations
 */
export type BookWithRelations = Book & {
  post: Post & {user: User};
  authors: User[];
};

/**
 * Request types for API endpoints
 */
export type BookCreateRequest = {
  userId: string;
  title: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
};

export type BookUpdateRequest = {
  title?: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
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
 * Type guards
 */
export function isValidBookCreateRequest(
  req: unknown,
): req is BookCreateRequest {
  const r = req as BookCreateRequest;
  return typeof r === 'object' && r !== null && !!r.userId && !!r.title;
}

/**
 * Prisma include for book relations
 */
export const bookInclude = {
  post: {include: {user: true}},
  authors: true,
} satisfies Prisma.BookInclude;
