import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { oauthAccessTokens, oauthConsents, oauthRefreshTokens } from "@rezics/schema/postgres/identity/auth-oauth.generated";
import { oauthGrantContext, oauthRefreshFamily } from "@rezics/schema/postgres/integrations/oauth-grant-context";

/**
 * Drain private user OAuth credentials/contexts before consent erasure, at most 64 rows per batch.
 * @internal
 * @remarks Access-token children precede refresh rows; bounded context-link
 * cascades then permit grant-context and family deletion. Wider protocol rows
 * deliberately use a smaller batch than narrow private preference records.
 */
export async function eraseOAuthUserCredentialBatch(tx: DatabaseTransaction, authUserId: string): Promise<{ deleted: number; empty: boolean }> {
	authUserId = z.uuid().toLowerCase().parse(authUserId);
	const [user] = await tx.select({ erasedAt: users.erasedAt }).from(users).where(eq(users.id, authUserId)).for("update");
	if (!user?.erasedAt) throw new Error("OAuth credential erasure requires an erased account");
	for (const target of [
		{ table: oauthAccessTokens, owner: oauthAccessTokens.userId },
		{ table: oauthRefreshTokens, owner: oauthRefreshTokens.userId },
		{ table: oauthConsents, owner: oauthConsents.userId },
		{ table: oauthGrantContext, owner: oauthGrantContext.principalId },
		{ table: oauthRefreshFamily, owner: oauthRefreshFamily.authUserId },
	]) {
		const deleted = (await tx.execute<{ count: number }>(sql`with batch as materialized(
		 select ctid from ${target.table} where ${target.owner}=${authUserId}::uuid limit 64 for update skip locked),deleted as (
		 delete from ${target.table} where ctid in(select ctid from batch) returning 1) select count(*)::integer as count from deleted`)).rows[0]?.count;
		if (deleted === undefined) throw new Error("OAuth erasure batch did not return its outcome");
		if (deleted) return { deleted, empty: false };
		const remaining = (await tx.execute<{ present: boolean }>(sql`select exists(select 1 from ${target.table} where ${target.owner}=${authUserId}::uuid) as present`)).rows[0]?.present;
		if (remaining === undefined) throw new Error("OAuth erasure cannot establish completion");
		if (remaining) return { deleted: 0, empty: false };
	}
	return { deleted: 0, empty: true };
}
