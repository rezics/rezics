import {prisma} from '#/prisma/client';
import type {Tag, User} from '#/prisma/client';
import {searchClient} from '../search-client';
import type {BookSearchDocument} from './index';
import {bookInclude} from '../../book/types';

/**
 * Sync a single book (by its unitId) into the Meilisearch `books` index.
 */
export async function syncBookToMeili(unitId: string): Promise<void> {
  const book = await prisma.book.findUnique({
    where: {unitId},
    include: bookInclude,
  });

  if (!book) return;

  const tagSearch: string[] = [
    ...(book.tags ?? []),
    ...(book.unit?.tags?.map((t: Tag) => t.name) ?? []),
  ];

  const doc: BookSearchDocument = {
    id: book.unitId,
    // search fields
    title: book.title,
    description: book.description ?? null,
    coverUrl: book.coverUrl ?? null,
    isbn: book.isbn ?? null,
    tagSearch,
    authors: book.author?.map((a: User) => a.name) ?? [],
    presses: book.press?.map((p: User) => p.name) ?? [],
    producers: book.producer?.map((p: User) => p.name) ?? [],
    nsfw: book.unit?.nsfw ?? false,
    isLicensed: book.isLicensed ?? false,
    authorIds: book.author?.map((a: User) => a.unitId) ?? [],
    pressIds: book.press?.map((p: User) => p.unitId) ?? [],
    producerIds: book.producer?.map((p: User) => p.unitId) ?? [],
    textLength: Number(book.textLength) ?? 0,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    extra: book.extra ?? null,
    metadata: book.unit?.metadata ?? null,
    // result fields
    unitId: book.unitId,
    author: book.author,
    press: book.press,
    producer: book.producer,
    tags: book.unit?.tags ?? [],
  };

  await searchClient.bookIndex.addDocuments([doc]);
}

/**
 * Remove a single book (by its unitId) from the Meilisearch `books` index.
 */
export async function deleteBookFromMeili(unitId: string): Promise<void> {
  await searchClient.bookIndex.deleteDocuments([unitId]);
}
