import { and, inArray, or, sql } from "drizzle-orm";
import { bigint, boolean, check, foreignKey, index, integer, primaryKey, text, uniqueIndex, uuid, type PgTableExtraConfigValue } from "drizzle-orm/pg-core";
import { AccessManagementPermissionValues, AccessPermissionValues, PlatformCapabilityValues, UnitPermissionValues } from "@rezics/access";
import { ApiPermissionValues } from "../../auth/api-permissions";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { accessScope, accessSubject } from "./access-identity";

/** App product identity under one immutable account/Entity control root; it is not an authenticated principal. @internal */
export const connectedApp = pgTable("connected_app", {
	id: createUuidv7PrimaryKey(),
	scopeId: uuid().notNull().references(() => accessScope.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull().default(0),
	authorityEpoch: bigint({ mode: "number" }).notNull().default(0),
	declaredRevision: bigint({ mode: "number" }),
	state: text().$type<"draft" | "active" | "disabled" | "retired">().notNull().default("draft"),
	trust: text().$type<"unreviewed" | "trusted" | "blocked">().notNull().default("unreviewed"),
}, (table): PgTableExtraConfigValue[] => [
	index("connected_app_scope_idx").on(table.scopeId, table.id),
	foreignKey({ name: "connected_app_declared_revision_fk", columns: [table.id, table.declaredRevision],
		foreignColumns: [connectedAppRevision.appId, connectedAppRevision.revision] }).onDelete("restrict"),
	check("connected_app_version_check", sql`${table.version} between 0 and 9007199254740991 and (${table.declaredRevision} is null or ${table.declaredRevision} between 1 and ${table.version})`),
	check("connected_app_epoch_check", sql`${table.authorityEpoch} between 0 and ${table.version} and (${table.version}=0 or ${table.authorityEpoch}>0)`),
	check("connected_app_state_check", sql`(${table.state}='draft' and ${table.version}=0 and ${table.declaredRevision} is null) or (${table.state} in ('active','disabled','retired') and ${table.version}>0 and ${table.declaredRevision} is not null)`),
	check("connected_app_trust_check", sql`${table.trust} in ('unreviewed','trusted','blocked') and (${table.trust}<>'blocked' or ${table.state} in ('disabled','retired'))`),
]);

/** Private App control receipt; trust authority is separate from publisher authority. @internal */
export const connectedAppEvent = pgTable("connected_app_event", {
	appId: uuid().notNull().references(() => connectedApp.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull(),
	operationId: uuid().notNull(),
	requestDigest: text().notNull(),
	operation: text().$type<"create" | "revise" | "disable" | "enable" | "retire" | "set-trust">().notNull(),
	stateAfter: text().$type<"active" | "disabled" | "retired">().notNull(),
	trustAfter: text().$type<"unreviewed" | "trusted" | "blocked">().notNull(),
	authorityEpochAfter: bigint({ mode: "number" }).notNull(),
	retainedDeclaredRevision: bigint({ mode: "number" }),
	operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	authoritySubjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
	createdAt: createCreatedAtColumn(),
}, (table): PgTableExtraConfigValue[] => [
	primaryKey({ columns: [table.appId, table.version] }),
	uniqueIndex("connected_app_event_operation_key").on(table.appId, table.operationId),
	foreignKey({ name: "connected_app_event_retained_revision_fk", columns: [table.appId, table.retainedDeclaredRevision],
		foreignColumns: [connectedAppRevision.appId, connectedAppRevision.revision] }).onDelete("restrict"),
	check("connected_app_event_version_check", sql`${table.version} between 1 and 9007199254740991`),
	check("connected_app_event_epoch_check", sql`${table.authorityEpochAfter} between 1 and ${table.version}`),
	check("connected_app_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
	check("connected_app_event_operation_check", inArray(table.operation, ["create", "revise", "disable", "enable", "retire", "set-trust"])),
	check("connected_app_event_state_check", inArray(table.stateAfter, ["active", "disabled", "retired"])),
	check("connected_app_event_trust_check", inArray(table.trustAfter, ["unreviewed", "trusted", "blocked"])),
	check("connected_app_event_revision_check", sql`(${table.operation} in ('create','revise') and ${table.retainedDeclaredRevision} is null) or (${table.operation} not in ('create','revise') and ${table.retainedDeclaredRevision} is not null and ${table.retainedDeclaredRevision} between 1 and ${table.version}-1)`),
]);

/** Sealed declared capabilities; existing approvals retain their own exact selected revision. @internal */
export const connectedAppRevision = pgTable("connected_app_revision", {
	appId: uuid().notNull(),
	revision: bigint({ mode: "number" }).notNull(),
	label: text().notNull(),
	description: text(),
	offlineAccess: boolean().notNull(),
	entityDisclosure: boolean().notNull(),
	capabilityCount: integer().notNull(),
	capabilityDigest: text().notNull(),
	sealed: boolean().notNull().default(false),
}, (table): PgTableExtraConfigValue[] => [
	primaryKey({ columns: [table.appId, table.revision] }),
	foreignKey({ name: "connected_app_revision_event_fk", columns: [table.appId, table.revision],
		foreignColumns: [connectedAppEvent.appId, connectedAppEvent.version] }).onDelete("restrict"),
	check("connected_app_revision_label_check", sql`length(btrim(${table.label}))>0 and octet_length(${table.label})<=512`),
	check("connected_app_revision_description_check", sql`${table.description} is null or octet_length(${table.description})<=4096`),
	check("connected_app_revision_count_check", sql`${table.capabilityCount} between 0 and ${sql.raw(String(AccessPermissionValues.length + ApiPermissionValues.length))}`),
	check("connected_app_revision_digest_check", sql`${table.capabilityDigest} ~ '^[0-9a-f]{64}$'`),
]);

/** Literal App declaration member; API entry scopes cannot substitute for domain authorization. @internal */
export const connectedAppCapability = pgTable("connected_app_capability", {
	appId: uuid().notNull(),
	revision: bigint({ mode: "number" }).notNull(),
	family: text().$type<"api" | "unit" | "platform" | "management">().notNull(),
	capability: text().notNull(),
}, table => [
	primaryKey({ columns: [table.appId, table.revision, table.family, table.capability] }),
	foreignKey({ name: "connected_app_capability_revision_fk", columns: [table.appId, table.revision],
		foreignColumns: [connectedAppRevision.appId, connectedAppRevision.revision] }).onDelete("restrict"),
	check("connected_app_capability_registered_check", or(
		and(sql`${table.family}='api'`, inArray(table.capability, ApiPermissionValues)),
		and(sql`${table.family}='unit'`, inArray(table.capability, UnitPermissionValues)),
		and(sql`${table.family}='platform'`, inArray(table.capability, PlatformCapabilityValues)),
		and(sql`${table.family}='management'`, inArray(table.capability, AccessManagementPermissionValues)),
	)),
]);
