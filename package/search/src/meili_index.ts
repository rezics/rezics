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
      'extra',
    ],
    filterableAttributes: [
      'nsfw',
      'tagSearch',
      'authorIds',
      'pressIds',
      'producerIds',
      'textLength',
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
      'targetUnitId',
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

// ANCHOR: Readlists index
export const readlistIndex = meili.index('readlists');

/**
 * Initialize or update the Meilisearch `readlists` index settings.
 *
 * - `searchableAttributes`: fields used for full-text search
 * - `filterableAttributes`: fields usable in filter expressions
 * - `sortableAttributes`: fields usable in sort expressions
 */
export async function initReadlistIndex() {
  await readlistIndex.updateSettings({
    searchableAttributes: ['title', 'content', 'tags'],
    filterableAttributes: [
      'targetUnitId',
      'bookIds',
      'reviewIds',
      'type',
      'status',
      'userId',
      'domainIds',
      'nsfw',
      'tags',
    ],
    sortableAttributes: ['createdAt', 'updatedAt'],
  });
  readlistIndex.addDocuments([], {primaryKey: 'id'});
}

// ANCHOR: Feedbacks index
export const feedbackIndex = meili.index('feedbacks');

/**
 * Initialize or update the Meilisearch `feedbacks` index settings.
 *
 * - `searchableAttributes`: fields used for full-text search
 * - `filterableAttributes`: fields usable in filter expressions
 * - `sortableAttributes`: fields usable in sort expressions
 */
export async function initFeedbackIndex() {
  await feedbackIndex.updateSettings({
    searchableAttributes: ['content', 'url'],
    filterableAttributes: [
      'userId',
      'unitId',
      'type',
      'resolved',
      'createdAt',
      'updatedAt',
    ],
    sortableAttributes: ['createdAt', 'updatedAt'],
  });
  feedbackIndex.addDocuments([], {primaryKey: 'id'});
}
