import { db, type AuthDb } from "../db/client";
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

export async function resetAuthDatabase(database: AuthDb = db): Promise<void> {
  console.log("[Reset] Resetting auth database...");

  await database.transaction(async (tx) => {
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
