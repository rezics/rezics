// meili.keys.ts
// Small helpers around Meilisearch key management.

import {meili} from './client';

/**
 * Create a Meilisearch key that is allowed to perform only `search` actions
 * on the `books` index.
 *
 * This is the recommended key type to hand out to frontend clients.
 *
 * @returns The newly created key string.
 */
export async function getSearchKey(): Promise<string> {
  const resp = await meili.createKey({
    actions: ['search'], // 只允许搜索
    indexes: ['books', 'units'], // 允许的索引
    expiresAt: null,
  });

  return resp.key;
}

/**
 * Create a short-lived Meilisearch admin key with full permissions.
 *
 * The key is valid for 30 days and should only be used in secure
 * server-side contexts.
 */
export async function getAdminKey() {
  return meili.createKey({
    actions: ['*'],
    indexes: ['*'],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
  });
}

/**
 * List all existing Meilisearch API keys.
 */
export async function listKeys() {
  return meili.getKeys();
}

/**
 * Delete a Meilisearch API key by its UID.
 */
export async function deleteKey(keyUid: string) {
  return meili.deleteKey(keyUid);
}
