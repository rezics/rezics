import { and, inArray, or, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
	type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import {
	AccessManagementPermissionValues,
	AccessPermissionValues,
	PlatformCapabilityValues,
	UnitPermissionValues,
} from "@rezics/access";
import { ApiPermissionValues } from "../../contracts/native/api-permissions";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";
import { users } from "../identity/auth";
import { accessSubject } from "../access/access-identity";
import { connectedApp, connectedAppRevision } from "./connected-app";
import { oauthClientAuthority } from "./oauth-client-authority";
import { workloadPrincipal } from "../identity/workload-principal";
import { connectedInstallation } from "./connected-installation";

/** Server-owned admission of a protocol client to an App and optional exact installation workload. @internal */
export const connectedAppClient = pgTable(
	"connected_app_client",
	{
		clientId: uuid()
			.primaryKey()
			.references(() => oauthClientAuthority.id, { onDelete: "restrict" }),
		appId: uuid()
			.notNull()
			.references(() => connectedApp.id, { onDelete: "restrict" }),
		kind: text().$type<"user" | "installation">().notNull(),
		workloadPrincipalId: uuid().references(() => workloadPrincipal.authUserId, {
			onDelete: "restrict",
		}),
		version: bigint({ mode: "number" }).notNull().default(0),
		termsRevision: bigint({ mode: "number" }),
		credentialEpoch: bigint({ mode: "number" }).notNull().default(0),
		state: text().$type<"draft" | "active" | "disabled" | "revoked">().notNull().default("draft"),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("connected_app_client_app_key").on(table.clientId, table.appId),
		index("connected_app_client_app_idx").on(table.appId, table.clientId),
		index("connected_app_client_workload_idx")
			.on(table.workloadPrincipalId, table.clientId)
			.where(sql`${table.workloadPrincipalId} is not null`),
		uniqueIndex("connected_app_client_active_workload_key")
			.on(table.workloadPrincipalId)
			.where(sql`${table.workloadPrincipalId} is not null and ${table.state}='active'`),
		foreignKey({
			name: "connected_app_client_terms_fk",
			columns: [table.clientId, table.termsRevision],
			foreignColumns: [connectedAppClientRevision.clientId, connectedAppClientRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_app_client_installation_fk",
			columns: [table.workloadPrincipalId, table.appId],
			foreignColumns: [connectedInstallation.workloadPrincipalId, connectedInstallation.appId],
		}).onDelete("restrict"),
		check(
			"connected_app_client_kind_check",
			sql`(${table.kind}='user' and ${table.workloadPrincipalId} is null) or (${table.kind}='installation' and ${table.workloadPrincipalId} is not null)`,
		),
		check(
			"connected_app_client_version_check",
			sql`${table.version} between 0 and 9007199254740991 and ${table.credentialEpoch} between 0 and ${table.version} and (${table.termsRevision} is null or ${table.termsRevision} between 1 and ${table.version})`,
		),
		check(
			"connected_app_client_state_check",
			sql`(${table.state}='draft' and ${table.version}=0 and ${table.credentialEpoch}=0 and ${table.termsRevision} is null) or (${table.state} in ('active','disabled','revoked') and ${table.version}>0 and ${table.credentialEpoch}>0 and ${table.termsRevision} is not null)`,
		),
	],
);

/** Immutable native admission/control receipt; provider metadata alone is not this approval. @internal */
export const connectedAppClientEvent = pgTable(
	"connected_app_client_event",
	{
		clientId: uuid()
			.notNull()
			.references(() => connectedAppClient.clientId, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"admit" | "revise" | "disable" | "enable" | "revoke">().notNull(),
		stateAfter: text().$type<"active" | "disabled" | "revoked">().notNull(),
		credentialEpochAfter: bigint({ mode: "number" }).notNull(),
		retainedTermsRevision: bigint({ mode: "number" }),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.clientId, table.version] }),
		uniqueIndex("connected_app_client_event_operation_key").on(table.clientId, table.operationId),
		foreignKey({
			name: "connected_app_client_event_retained_terms_fk",
			columns: [table.clientId, table.retainedTermsRevision],
			foreignColumns: [connectedAppClientRevision.clientId, connectedAppClientRevision.revision],
		}).onDelete("restrict"),
		check(
			"connected_app_client_event_version_check",
			sql`${table.version} between 1 and 9007199254740991 and ${table.credentialEpochAfter} between 1 and ${table.version}`,
		),
		check(
			"connected_app_client_event_digest_check",
			sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"connected_app_client_event_operation_check",
			inArray(table.operation, ["admit", "revise", "disable", "enable", "revoke"]),
		),
		check(
			"connected_app_client_event_state_check",
			inArray(table.stateAfter, ["active", "disabled", "revoked"]),
		),
		check(
			"connected_app_client_event_terms_check",
			sql`(${table.operation} in ('admit','revise') and ${table.retainedTermsRevision} is null) or (${table.operation} not in ('admit','revise') and ${table.retainedTermsRevision} is not null and ${table.retainedTermsRevision} between 1 and ${table.version}-1)`,
		),
	],
);

/** Sealed App/protocol approval selection; broader manifests or metadata cannot change this snapshot. @internal */
export const connectedAppClientRevision = pgTable(
	"connected_app_client_revision",
	{
		clientId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		appId: uuid().notNull(),
		appRevision: bigint({ mode: "number" }).notNull(),
		protocolCredentialEpoch: bigint({ mode: "number" }).notNull(),
		offlineAccess: boolean().notNull(),
		entityDisclosure: boolean().notNull(),
		capabilityCount: integer().notNull(),
		capabilityDigest: text().notNull(),
		sealed: boolean().notNull().default(false),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.clientId, table.revision] }),
		foreignKey({
			name: "connected_app_client_revision_event_fk",
			columns: [table.clientId, table.revision],
			foreignColumns: [connectedAppClientEvent.clientId, connectedAppClientEvent.version],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_app_client_revision_owner_fk",
			columns: [table.clientId, table.appId],
			foreignColumns: [connectedAppClient.clientId, connectedAppClient.appId],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_app_client_revision_app_fk",
			columns: [table.appId, table.appRevision],
			foreignColumns: [connectedAppRevision.appId, connectedAppRevision.revision],
		}).onDelete("restrict"),
		index("connected_app_client_revision_app_idx").on(
			table.appId,
			table.appRevision,
			table.clientId,
			table.revision,
		),
		check(
			"connected_app_client_revision_epoch_check",
			sql`${table.protocolCredentialEpoch} between 0 and 9007199254740991`,
		),
		check(
			"connected_app_client_revision_count_check",
			sql`${table.capabilityCount} between 0 and ${sql.raw(String(AccessPermissionValues.length + ApiPermissionValues.length))}`,
		),
		check(
			"connected_app_client_revision_digest_check",
			sql`${table.capabilityDigest} ~ '^[0-9a-f]{64}$'`,
		),
	],
);

/** Literal client capability subset, kept distinct from user consent and resource grants. @internal */
export const connectedAppClientCapability = pgTable(
	"connected_app_client_capability",
	{
		clientId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		family: text().$type<"api" | "unit" | "platform" | "management">().notNull(),
		capability: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.clientId, table.revision, table.family, table.capability] }),
		foreignKey({
			name: "connected_app_client_capability_revision_fk",
			columns: [table.clientId, table.revision],
			foreignColumns: [connectedAppClientRevision.clientId, connectedAppClientRevision.revision],
		}).onDelete("restrict"),
		check(
			"connected_app_client_capability_registered_check",
			sql`${or(
				and(sql`${table.family}='api'`, inArray(table.capability, ApiPermissionValues)),
				and(sql`${table.family}='unit'`, inArray(table.capability, UnitPermissionValues)),
				and(sql`${table.family}='platform'`, inArray(table.capability, PlatformCapabilityValues)),
				and(
					sql`${table.family}='management'`,
					inArray(table.capability, AccessManagementPermissionValues),
				),
			)}`,
		),
	],
);
