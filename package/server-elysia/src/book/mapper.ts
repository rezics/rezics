import type {User} from '@/prisma/client';
import type {PublicUser, BookDTO} from '@package/contract';
import type {BookWithRelations} from './types';

/**
 * Sanitize user data for public response
 */
export function sanitizeUser(u: User): PublicUser {
  return {
    id: u.id,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
  };
}

/**
 * Map internal Book model to BookDTO
 */
export function mapBookToDTO(book: BookWithRelations): BookDTO {
  return {
    postId: book.postId,
    title: book.title,
    authors: book.authors.map(sanitizeUser),
    coverUrl: book.coverUrl || undefined,
    isbn: book.isbn || undefined,
    chaptersIndex: book.chaptersIndex || undefined,
    extra: (book.extra as Record<string, unknown>) || undefined,
    userId: book.post.userId,
    user: sanitizeUser(book.post.user),
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    description: book.description || undefined,
  };
}
