import { env } from "../env";
import { createAuthDb } from "./factory";

const defaultAuthDb = createAuthDb(env.DATABASE_URL);

export const db = defaultAuthDb.db;

export type AuthDb = typeof db;
export { createAuthDb };

export async function disconnectAuthDb(): Promise<void> {
  await defaultAuthDb.disconnect();
}

process.on("SIGTERM", async () => {
  await disconnectAuthDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectAuthDb();
  process.exit(0);
});
