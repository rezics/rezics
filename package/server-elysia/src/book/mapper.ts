import type {User} from '@/prisma/client';
import type {PublicUser, BookDTO} from '@package/contract';
import type {BookWithRelations} from './types';

/**
 * Sanitize user data for public response
 */
export function sanitizeUser(u: User): PublicUser {
  return {
    id: u.unitId,
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
    unitId: book.unitId,
    title: book.title,
    author: book.author.map(sanitizeUser),
    press: book.press.map(sanitizeUser),
    producer: book.producer.map(sanitizeUser),
    coverUrl: book.coverUrl || undefined,
    isbn: book.isbn || undefined,
    chaptersIndex: book.chaptersIndex || undefined,
    extra: (book.extra as Record<string, unknown>) || undefined,
    userId: book.unit.userId,
    user: sanitizeUser(book.unit.user),
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    description: book.description || undefined,
  };
}
