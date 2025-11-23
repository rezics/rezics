// meili.index.ts
import {meili} from './client';

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
    searchableAttributes: ['title', 'description', 'tags', 'authors'],
    filterableAttributes: [
      'nsfw',
      'tags',
      'authorIds',
      'pressIds',
      'producerIds',
    ],
    sortableAttributes: ['createdAt', 'updatedAt'],
  });
}
