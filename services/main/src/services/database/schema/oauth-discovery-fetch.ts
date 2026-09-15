import { sql } from "drizzle-orm";
import { check, index, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createUuidv7PrimaryKey } from "./columns";

/** Short-lived fleet fetch-start receipts; origin hashes avoid retaining metadata URL paths. @internal */
export const oauthDiscoveryFetch = pgTable("oauth_discovery_fetch", {
	id: createUuidv7PrimaryKey(),
	originDigest: text().notNull(),
	startedAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
}, table => [
	index("oauth_discovery_fetch_window_idx").on(table.startedAt, table.id),
	check("oauth_discovery_fetch_origin_check", sql`${table.originDigest} ~ '^[0-9a-f]{64}$'`),
	check("oauth_discovery_fetch_time_check", sql`isfinite(${table.startedAt})`),
]);
