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
	timestamp,
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
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "../shared/columns";
import { users } from "../identity/auth";
import { accessScope, accessSubject } from "../access/access-identity";
import { connectedAppClient, connectedAppClientRevision } from "./connected-app-client";
import { accessRepresentationRevision } from "../access/access-representation";

/** Private user/client/authority-subject connection; defaults never retarget it. @internal */
export const connectedUserConnection = pgTable(
	"connected_user_connection",
	{
		id: createUuidv7PrimaryKey(),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		clientId: uuid()
			.notNull()
			.references(() => connectedAppClient.clientId, { onDelete: "restrict" }),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
		state: text().$type<"draft" | "active" | "disconnected">().notNull().default("draft"),
	},
	(table) => [
		uniqueIndex("connected_user_connection_client_key").on(table.id, table.clientId),
		index("connected_user_connection_account_idx").on(table.authUserId, table.id),
		index("connected_user_connection_client_idx").on(table.clientId, table.id),
		index("connected_user_connection_subject_idx").on(table.subjectId, table.id),
		check(
			"connected_user_connection_version_check",
			sql`${table.version} between 0 and 9007199254740991`,
		),
		check(
			"connected_user_connection_state_check",
			sql`(${table.state}='draft' and ${table.version}=0) or (${table.state} in ('active','disconnected') and ${table.version}>0)`,
		),
	],
);

/** Immutable connection receipt; disconnect ends future use without rewriting existing attribution. @internal */
export const connectedUserConnectionEvent = pgTable(
	"connected_user_connection_event",
	{
		connectionId: uuid()
			.notNull()
			.references(() => connectedUserConnection.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"connect" | "disconnect">().notNull(),
		stateAfter: text().$type<"active" | "disconnected">().notNull(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.connectionId, table.version] }),
		uniqueIndex("connected_user_connection_event_operation_key").on(
			table.connectionId,
			table.operationId,
		),
		check(
			"connected_user_connection_event_version_check",
			sql`${table.version} between 1 and 9007199254740991`,
		),
		check(
			"connected_user_connection_event_digest_check",
			sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"connected_user_connection_event_operation_check",
			sql`(${table.operation}='connect' and ${table.stateAfter}='active') or (${table.operation}='disconnect' and ${table.stateAfter}='disconnected')`,
		),
	],
);

/** One explicit consent under a fixed connection; its approved resource/representation selection is revision-bound. @internal */
export const connectedUserConsent = pgTable(
	"connected_user_consent",
	{
		id: createUuidv7PrimaryKey(),
		connectionId: uuid().notNull(),
		clientId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull().default(0),
		termsRevision: bigint({ mode: "number" }),
		state: text().$type<"draft" | "active" | "revoked" | "erasing">().notNull().default("draft"),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("connected_user_consent_client_key").on(table.id, table.clientId),
		index("connected_user_consent_connection_idx").on(table.connectionId, table.id),
		index("connected_user_consent_client_idx").on(table.clientId, table.id),
		foreignKey({
			name: "connected_user_consent_connection_client_fk",
			columns: [table.connectionId, table.clientId],
			foreignColumns: [connectedUserConnection.id, connectedUserConnection.clientId],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_user_consent_terms_fk",
			columns: [table.id, table.termsRevision],
			foreignColumns: [
				connectedUserConsentRevision.consentId,
				connectedUserConsentRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"connected_user_consent_version_check",
			sql`${table.version} between 0 and 9007199254740991 and (${table.termsRevision} is null or ${table.termsRevision} between 1 and ${table.version})`,
		),
		check(
			"connected_user_consent_state_check",
			sql`(${table.state}='draft' and ${table.version}=0 and ${table.termsRevision} is null) or (${table.state} in ('active','revoked') and ${table.version}>0 and ${table.termsRevision} is not null) or (${table.state}='erasing' and ${table.version}>0 and ${table.termsRevision} is null)`,
		),
	],
);

/** Immutable user consent/control receipt, distinct from scope installation approval. @internal */
export const connectedUserConsentEvent = pgTable(
	"connected_user_consent_event",
	{
		consentId: uuid()
			.notNull()
			.references(() => connectedUserConsent.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"grant" | "revise" | "revoke">().notNull(),
		stateAfter: text().$type<"active" | "revoked">().notNull(),
		retainedTermsRevision: bigint({ mode: "number" }),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.consentId, table.version] }),
		uniqueIndex("connected_user_consent_event_operation_key").on(
			table.consentId,
			table.operationId,
		),
		foreignKey({
			name: "connected_user_consent_event_retained_terms_fk",
			columns: [table.consentId, table.retainedTermsRevision],
			foreignColumns: [
				connectedUserConsentRevision.consentId,
				connectedUserConsentRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"connected_user_consent_event_version_check",
			sql`${table.version} between 1 and 9007199254740991`,
		),
		check(
			"connected_user_consent_event_digest_check",
			sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"connected_user_consent_event_operation_check",
			sql`(${table.operation}='revoke' and ${table.stateAfter}='revoked' and ${table.retainedTermsRevision} is not null and ${table.retainedTermsRevision} between 1 and ${table.version}-1) or
		(${table.operation} in ('grant','revise') and ${table.stateAfter}='active' and ${table.retainedTermsRevision} is null)`,
		),
	],
);

/** Sealed user-selected ceiling; all-scopes is an explicit resource choice, never a permission wildcard. @internal */
export const connectedUserConsentRevision = pgTable(
	"connected_user_consent_revision",
	{
		consentId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		clientId: uuid().notNull(),
		clientTermsRevision: bigint({ mode: "number" }).notNull(),
		validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
		validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
		offlineAccess: boolean().notNull(),
		entityDisclosure: boolean().notNull(),
		resourceSelection: text().$type<"all-scopes" | "selected">().notNull(),
		capabilityCount: integer().notNull(),
		capabilityDigest: text().notNull(),
		resourceCount: integer().notNull(),
		resourceDigest: text().notNull(),
		representationCount: integer().notNull(),
		representationDigest: text().notNull(),
		sealed: boolean().notNull().default(false),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.consentId, table.revision] }),
		foreignKey({
			name: "connected_user_consent_revision_event_fk",
			columns: [table.consentId, table.revision],
			foreignColumns: [connectedUserConsentEvent.consentId, connectedUserConsentEvent.version],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_user_consent_revision_owner_fk",
			columns: [table.consentId, table.clientId],
			foreignColumns: [connectedUserConsent.id, connectedUserConsent.clientId],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_user_consent_revision_client_fk",
			columns: [table.clientId, table.clientTermsRevision],
			foreignColumns: [connectedAppClientRevision.clientId, connectedAppClientRevision.revision],
		}).onDelete("restrict"),
		index("connected_user_consent_revision_client_idx").on(
			table.clientId,
			table.clientTermsRevision,
			table.consentId,
			table.revision,
		),
		check(
			"connected_user_consent_revision_time_check",
			sql`isfinite(${table.validFrom}) and isfinite(${table.validUntil}) and ${table.validUntil}>${table.validFrom} and ${table.validUntil}-${table.validFrom}<=interval '365 days'`,
		),
		check(
			"connected_user_consent_revision_counts_check",
			sql`${table.capabilityCount} between 0 and ${sql.raw(String(AccessPermissionValues.length + ApiPermissionValues.length))} and ${table.representationCount} between 0 and 8 and
		((${table.resourceSelection}='all-scopes' and ${table.resourceCount}=0) or (${table.resourceSelection}='selected' and ${table.resourceCount} between 1 and 64))`,
		),
		check(
			"connected_user_consent_revision_digests_check",
			sql`${table.capabilityDigest} ~ '^[0-9a-f]{64}$' and ${table.resourceDigest} ~ '^[0-9a-f]{64}$' and ${table.representationDigest} ~ '^[0-9a-f]{64}$'`,
		),
	],
);

/** Literal consent members retain API/domain namespaces and never follow a broader client/App head. @internal */
export const connectedUserConsentCapability = pgTable(
	"connected_user_consent_capability",
	{
		consentId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		family: text().$type<"api" | "unit" | "platform" | "management">().notNull(),
		capability: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.consentId, table.revision, table.family, table.capability] }),
		foreignKey({
			name: "connected_user_consent_capability_revision_fk",
			columns: [table.consentId, table.revision],
			foreignColumns: [
				connectedUserConsentRevision.consentId,
				connectedUserConsentRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"connected_user_consent_capability_registered_check",
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

/** Explicit root/path selections; the authority root stays a concrete private/public reference. @internal */
export const connectedUserConsentResource = pgTable(
	"connected_user_consent_resource",
	{
		consentId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		path: text().array().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.consentId, table.revision, table.scopeId, table.path] }),
		foreignKey({
			name: "connected_user_consent_resource_revision_fk",
			columns: [table.consentId, table.revision],
			foreignColumns: [
				connectedUserConsentRevision.consentId,
				connectedUserConsentRevision.revision,
			],
		}).onDelete("restrict"),
		index("connected_user_consent_resource_scope_idx").on(
			table.scopeId,
			table.consentId,
			table.revision,
		),
		check(
			"connected_user_consent_resource_path_check",
			sql`cardinality(${table.path}) between 0 and 8 and coalesce(array_ndims(${table.path}),1)=1 and array_position(${table.path},null) is null and octet_length(array_to_string(${table.path},'/'))<=2048`,
		),
	],
);

/** Exact representation context for represented consent; direct consent carries no such references. @internal */
export const connectedUserConsentRepresentation = pgTable(
	"connected_user_consent_representation",
	{
		consentId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		grantId: uuid().notNull(),
		termsRevision: bigint({ mode: "number" }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.consentId, table.revision, table.grantId] }),
		foreignKey({
			name: "connected_user_consent_representation_revision_fk",
			columns: [table.consentId, table.revision],
			foreignColumns: [
				connectedUserConsentRevision.consentId,
				connectedUserConsentRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "connected_user_consent_representation_terms_fk",
			columns: [table.grantId, table.termsRevision],
			foreignColumns: [accessRepresentationRevision.grantId, accessRepresentationRevision.revision],
		}).onDelete("restrict"),
		index("connected_user_consent_representation_source_idx").on(
			table.grantId,
			table.termsRevision,
			table.consentId,
			table.revision,
		),
	],
);
