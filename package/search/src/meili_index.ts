// meili.index.ts
import {meili} from './client';

export const bookIndex = meili.index('books');

export async function initBookIndex() {
  await bookIndex.updateSettings({
    searchableAttributes: ['title', 'description', 'tags', 'authors'],
    filterableAttributes: ['nsfw', 'press', 'producer'],
    sortableAttributes: ['createdAt', 'updatedAt'],
  });
}
