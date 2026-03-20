// meili.client.ts
import {MeiliSearch} from 'meilisearch';
import {env} from './env';

export const meili = new MeiliSearch({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY,
});

export async function checkMeiliHealth() {
  try {
    const health = await meili.health();
    return health.status === 'available';
  } catch {
    return false;
  }
}
