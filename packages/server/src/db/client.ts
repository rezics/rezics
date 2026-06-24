import { env } from "../env";
import { createServerDb } from "./factory";

const defaultServerDb = createServerDb(env.DATABASE_URL);

export const db = defaultServerDb.db;

export type ServerDb = typeof db;
export { createServerDb };

export async function disconnectServerDb(): Promise<void> {
  await defaultServerDb.disconnect();
}

process.on("SIGTERM", async () => {
  await disconnectServerDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectServerDb();
  process.exit(0);
});
