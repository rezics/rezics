// meili.client.ts
import {MeiliSearch} from 'meilisearch';
import 'dotenv/config';

export const meili = new MeiliSearch({
  host: process.env.MEILI_HOST ?? 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY ?? 'masterKey',
});

export async function checkMeiliHealth() {
  try {
    const health = await meili.health();
    return health.status === 'available';
  } catch {
    return false;
  }
}
