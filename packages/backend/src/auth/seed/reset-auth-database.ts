import type { AuthDb } from "../db/client";
import {
  accounts,
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  sessions,
  users,
  verifications,
} from "../db/schema";

async function resolveAuthDb(database?: AuthDb): Promise<AuthDb> {
  if (database) return database;
  const { db } = await import("../db/client");
  return db;
}

export async function resetAuthDatabase(database?: AuthDb): Promise<void> {
  const targetDb = await resolveAuthDb(database);
  console.log("[Reset] Resetting auth database...");

  await targetDb.transaction(async (tx) => {
    await tx.delete(sessions);
    await tx.delete(accounts);
    await tx.delete(verifications);
    await tx.delete(oauthRefreshTokens);
    await tx.delete(oauthAccessTokens);
    await tx.delete(oauthConsents);
    await tx.delete(oauthClients);
    await tx.delete(users);
  });

  console.log("[Reset] Auth database reset complete.");
}
