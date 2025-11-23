// meili.keys.ts
import {meili} from './client';

export async function getSearchKey() {
  const resp = await meili.createKey({
    actions: ['search'], // 只允许搜索
    indexes: ['books'], // 允许的索引
    expiresAt: null,
  });

  return resp.key;
}

export async function getAdminKey() {
  return meili.createKey({
    actions: ['*'],
    indexes: ['*'],
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
  });
}

export async function listKeys() {
  return meili.getKeys();
}

export async function deleteKey(keyUid: string) {
  return meili.deleteKey(keyUid);
}
