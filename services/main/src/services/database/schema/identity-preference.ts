import { sql } from "drizzle-orm";
import { bigint, check, index, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { oauthClients } from "./auth-oauth.generated";
import { entityIdentity } from "./catalog-identity";
import { accessSubject } from "./access-identity";

/** Private account/main or client-specific convenience selection, never a control grant. @internal */
export const identityPreference = pgTable("identity_preference", {
	id: createUuidv7PrimaryKey(),
	authUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	clientId: uuid().references(() => oauthClients.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull().default(0),
	selectionKind: text().$type<"entity" | "none" | "inherit-main">().notNull().default("none"),
	entityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
}, table => [
	uniqueIndex("identity_preference_main_key").on(table.authUserId).where(sql`${table.clientId} is null`),
	uniqueIndex("identity_preference_client_key").on(table.authUserId, table.clientId).where(sql`${table.clientId} is not null`),
	index("identity_preference_account_idx").on(table.authUserId, table.id),
	index("identity_preference_entity_idx").on(table.entityId, table.authUserId).where(sql`${table.entityId} is not null`),
	index("identity_preference_client_owner_idx").on(table.clientId, table.authUserId).where(sql`${table.clientId} is not null`),
	check("identity_preference_version_check", sql`${table.version} between 0 and 9007199254740991`),
	check("identity_preference_selection_check", sql`(${table.selectionKind}='entity' and ${table.entityId} is not null) or (${table.selectionKind}='none' and ${table.entityId} is null) or (${table.selectionKind}='inherit-main' and ${table.entityId} is null and ${table.clientId} is not null)`),
]);

/** Private preference receipt; account erasure removes these non-authority history rows before their head. @internal */
export const identityPreferenceEvent = pgTable("identity_preference_event", {
	preferenceId: uuid().notNull().references(() => identityPreference.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull(),
	operationId: uuid().notNull(),
	requestDigest: text().notNull(),
	selectionKind: text().$type<"entity" | "none" | "inherit-main">().notNull(),
	entityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
	operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	authoritySubjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
	createdAt: createCreatedAtColumn(),
}, table => [
	primaryKey({ columns: [table.preferenceId, table.version] }),
	uniqueIndex("identity_preference_event_operation_key").on(table.preferenceId, table.operationId),
	check("identity_preference_event_version_check", sql`${table.version} between 1 and 9007199254740991`),
	check("identity_preference_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
	check("identity_preference_event_selection_check", sql`(${table.selectionKind}='entity' and ${table.entityId} is not null) or (${table.selectionKind} in ('none','inherit-main') and ${table.entityId} is null)`),
]);
