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

export function sanitizeUserWithBio(u: User): PublicUser {
  return {
    ...sanitizeUser(u),
    bio: u.bio ?? undefined,
  };
}

/**
 * Map internal Book model to BookDTO
 */
export function mapBaseBookToDTO(book: BookWithRelations): BookDTO {
  return {
    unitId: book.unitId,
    title: book.title,
    author: book.author.map(sanitizeUser),
    press: book.press.map(sanitizeUser),
    producer: book.producer.map(sanitizeUser),
    coverUrl: book.coverUrl || undefined,
    isbn: book.isbn || undefined,
    userId: book.unit.userId,
    user: sanitizeUser(book.unit.user),
    tags: book.unit.tags?.map(tag => tag.name) || [],
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    description: book.description || undefined,
  };
}

export function mapBookToDTO(book: BookWithRelations): BookDTO {
  return {
    ...mapBaseBookToDTO(book),
    chaptersIndex: book.chaptersIndex || undefined,
    author: book.author.map(sanitizeUserWithBio),
    extra: (book.extra as Record<string, unknown>) || undefined,
  };
}
