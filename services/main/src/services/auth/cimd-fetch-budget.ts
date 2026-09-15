import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { withDatabaseSession } from "../database";
import { oauthDiscoveryFetch } from "../database/schema/oauth-discovery-fetch";

/**
 * Admit a metadata/JWKS fetch against fleet-wide rolling minute budgets.
 * @internal
 * @remarks The reservation commits on a separate database session before egress,
 * so a later failed OAuth transaction cannot refund an already attempted fetch.
 * No network work occurs while the global admission mutex is held. Failed origin
 * admission consumes no global slot; only admitted attempts create rows.
 */
export async function admitCimdFleetFetch(url: URL): Promise<void> {
	const originDigest = createHash("sha256").update(url.origin).digest("hex");
	const admitted = await withDatabaseSession(session => session.transaction(async tx => {
		await tx.execute(sql`select set_config('statement_timeout','250ms',true),set_config('transaction_timeout','500ms',true)`);
		const [clock] = (await tx.execute<{ acquired: boolean; now: string }>(sql`
			select pg_try_advisory_xact_lock(hashtextextended('rezics:cimd:fleet-fetch-budget',0)) as acquired,clock_timestamp()::text as now`)).rows;
		if (!clock?.acquired) return false;
		const now = new Date(clock.now);
		if (!Number.isFinite(now.getTime())) throw new Error("Discovery fetch budget clock is unavailable");
		await tx.execute(sql`with expired as materialized(select id from public.oauth_discovery_fetch
			where started_at<=${new Date(now.getTime() - 120_000)}::timestamptz order by started_at,id limit 500 for update skip locked)
			delete from public.oauth_discovery_fetch f using expired where f.id=expired.id`);
		const recent = (await tx.execute<{ origin_digest: string }>(sql`select origin_digest from public.oauth_discovery_fetch
			where started_at>${new Date(now.getTime() - 60_000)}::timestamptz order by started_at desc,id desc limit 121`)).rows;
		if (recent.length >= 120 || recent.filter(row => row.origin_digest === originDigest).length >= 30) return false;
		await tx.insert(oauthDiscoveryFetch).values({ originDigest, startedAt: now });
		return true;
	}));
	if (!admitted) throw new APIError("TOO_MANY_REQUESTS", { error: "temporarily_unavailable", error_description: "Client discovery fetch capacity is unavailable" }, { "Retry-After": "1" });
}
