import { inArray, sql } from "drizzle-orm";
import { bigint, check, index, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { users } from "./auth";
import { accessSubject } from "./access-identity";
import { oauthClientAuthority } from "./oauth-client-authority";

/** Current shared-secret lifetime; secret plaintext is never retained or reconstructed here. @internal */
export const oauthClientSecretPolicy = pgTable("oauth_client_secret_policy", {
	clientId: uuid().primaryKey().references(() => oauthClientAuthority.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull().default(0),
	state: text().$type<"draft" | "active" | "retired">().notNull().default("draft"),
	secretDigest: text(),
	validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
	validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
}, table => [
	index("oauth_client_secret_policy_expiry_idx").on(table.validUntil, table.clientId).where(sql`${table.state}='active'`),
	check("oauth_client_secret_policy_version_check", sql`${table.version} between 0 and 9007199254740991`),
	check("oauth_client_secret_policy_state_check", sql`(${table.state}='draft' and ${table.version}=0 and ${table.secretDigest} is null and ${table.validFrom} is null and ${table.validUntil} is null) or
		(${table.state} in ('active','retired') and ${table.version}>0 and ${table.secretDigest} is not null and ${table.secretDigest} ~ '^[A-Za-z0-9_-]{43}$'
		and ${table.validFrom} is not null and ${table.validUntil} is not null and isfinite(${table.validFrom}) and isfinite(${table.validUntil})
		and ${table.validUntil}>${table.validFrom} and ${table.validUntil}-${table.validFrom}<=interval '365 days')`),
]);

/** Immutable issuance/rotation/retirement receipt containing only a one-way digest and declared lifetime. @internal */
export const oauthClientSecretEvent = pgTable("oauth_client_secret_event", {
	clientId: uuid().notNull().references(() => oauthClientSecretPolicy.clientId, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull(),
	operationId: uuid().notNull(),
	requestDigest: text().notNull(),
	operation: text().$type<"issue" | "rotate" | "retire">().notNull(),
	stateAfter: text().$type<"active" | "retired">().notNull(),
	secretDigest: text().notNull(),
	validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
	validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
	operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	authoritySubjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
	createdAt: createCreatedAtColumn(),
}, table => [
	primaryKey({ columns: [table.clientId, table.version] }),
	uniqueIndex("oauth_client_secret_event_operation_key").on(table.clientId, table.operationId),
	uniqueIndex("oauth_client_secret_event_material_key").on(table.clientId, table.secretDigest).where(sql`${table.operation} in ('issue','rotate')`),
	check("oauth_client_secret_event_version_check", sql`${table.version} between 1 and 9007199254740991`),
	check("oauth_client_secret_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$' and ${table.secretDigest} ~ '^[A-Za-z0-9_-]{43}$'`),
	check("oauth_client_secret_event_operation_check", inArray(table.operation, ["issue", "rotate", "retire"])),
	check("oauth_client_secret_event_state_check", sql`(${table.operation}='retire' and ${table.stateAfter}='retired') or (${table.operation}<>'retire' and ${table.stateAfter}='active')`),
	check("oauth_client_secret_event_time_check", sql`isfinite(${table.validFrom}) and isfinite(${table.validUntil}) and ${table.validUntil}>${table.validFrom} and ${table.validUntil}-${table.validFrom}<=interval '365 days'`),
]);
