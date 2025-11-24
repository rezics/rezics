// meili.index.ts
import {meili} from './client';

// ANCHOR: Books index
export const bookIndex = meili.index('books');

/**
 * Initialize or update the Meilisearch `books` index settings.
 *
 * - `searchableAttributes`: fields used for full-text search
 * - `filterableAttributes`: fields usable in filter expressions
 * - `sortableAttributes`: fields usable in sort expressions
 */
export async function initBookIndex() {
  await bookIndex.updateSettings({
    searchableAttributes: [
      'title',
      'description',
      'tagSearch',
      'authors',
      'presses',
      'isbn',
      'producers',
    ],
    filterableAttributes: [
      'nsfw',
      'tagSearch',
      'authorIds',
      'pressIds',
      'producerIds',
    ],
    sortableAttributes: ['createdAt', 'updatedAt'],
  });
  bookIndex.addDocuments([], {primaryKey: 'id'});
}

// ANCHOR: Units index
export const unitIndex = meili.index('units');

/**
 * Initialize or update the Meilisearch `units` index settings.
 *
 * - `searchableAttributes`: fields used for full-text search
 * - `filterableAttributes`: fields usable in filter expressions
 * - `sortableAttributes`: fields usable in sort expressions
 */
export async function initUnitIndex() {
  await unitIndex.updateSettings({
    searchableAttributes: ['title', 'content', 'tags'],
    filterableAttributes: [
      'type',
      'status',
      'userId',
      'domainIds',
      'nsfw',
      'tags',
    ],
    sortableAttributes: ['createdAt', 'updatedAt'],
  });
  unitIndex.addDocuments([], {primaryKey: 'id'});
}
