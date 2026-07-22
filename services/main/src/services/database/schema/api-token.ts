import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { apikeys } from "./auth";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { ApiTokenPolicyKindValues, ApiTokenUsageBucketKindValues } from "./contract-values";
import { profile } from "./core";

export type ApiTokenPolicyKind = (typeof ApiTokenPolicyKindValues)[number];
export type ApiTokenUsageBucketKind = (typeof ApiTokenUsageBucketKindValues)[number];

export const apiAccessPolicy = pgTable(
	"api_access_policy",
	{
		id: createUuidv7PrimaryKey(),
		key: text().notNull().unique(),
		kind: text().$type<ApiTokenPolicyKind>().notNull(),
		schemaVersion: integer().notNull(),
		configuration: createJsonDocumentColumn().notNull(),
		revision: integer().default(1).notNull(),
		enabled: boolean().default(true).notNull(),
		updatedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("api_access_policy_updated_by_idx").on(table.updatedByProfileId),
		check("api_access_policy_key_check", sql`${table.key} ~ '^[a-z][a-z0-9_-]{0,63}$'`),
		check("api_access_policy_kind_check", sql`${table.kind} in ('standard', 'staff_trusted')`),
		check("api_access_policy_schema_version_check", sql`${table.schemaVersion} > 0`),
		check("api_access_policy_revision_check", sql`${table.revision} > 0`),
		check(
			"api_access_policy_configuration_json_object_check",
			sql`jsonb_typeof(${table.configuration}) = 'object'`,
		),
	],
);

export const apiTokenPolicyBinding = pgTable(
	"api_token_policy_binding",
	{
		tokenId: uuid()
			.primaryKey()
			.references(() => apikeys.id, { onDelete: "cascade" }),
		policyId: uuid()
			.notNull()
			.references(() => apiAccessPolicy.id, { onDelete: "restrict" }),
		configurationOverride: createJsonDocumentColumn()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		validUntil: createTimestampMsColumn(),
		assignedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		assignmentReason: text(),
		revision: integer().default(1).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("api_token_policy_binding_policy_idx").on(table.policyId),
		index("api_token_policy_binding_assigned_by_idx").on(table.assignedByProfileId),
		check("api_token_policy_binding_revision_check", sql`${table.revision} > 0`),
		check(
			"api_token_policy_binding_configuration_json_object_check",
			sql`jsonb_typeof(${table.configurationOverride}) = 'object'`,
		),
		check(
			"api_token_policy_binding_validity_check",
			sql`${table.validUntil} is null or ${table.validUntil} > ${table.createdAt}`,
		),
		check(
			"api_token_policy_binding_reason_check",
			sql`${table.assignmentReason} is null or btrim(${table.assignmentReason}) <> ''`,
		),
	],
);

export const apiTokenUsageBucket = pgTable(
	"api_token_usage_bucket",
	{
		tokenId: uuid()
			.notNull()
			.references(() => apikeys.id, { onDelete: "cascade" }),
		scope: text().notNull(),
		kind: text().$type<ApiTokenUsageBucketKind>().notNull(),
		windowStartedAt: createTimestampMsColumn().notNull(),
		used: bigint({ mode: "number" }).notNull(),
		expiresAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({
			columns: [table.tokenId, table.scope, table.kind, table.windowStartedAt],
		}),
		index("api_token_usage_bucket_token_expiry_idx").on(table.tokenId, table.expiresAt),
		index("api_token_usage_bucket_expiry_idx").on(table.expiresAt),
		check(
			"api_token_usage_bucket_scope_check",
			sql`btrim(${table.scope}) <> '' and length(${table.scope}) <= 256`,
		),
		check(
			"api_token_usage_bucket_kind_check",
			sql`${table.kind} in ('minute_requests', 'daily_cost')`,
		),
		check("api_token_usage_bucket_used_check", sql`${table.used} >= 0`),
		check(
			"api_token_usage_bucket_expiry_check",
			sql`${table.expiresAt} > ${table.windowStartedAt}`,
		),
	],
);

export const apiTokenRequestLease = pgTable(
	"api_token_request_lease",
	{
		id: createUuidv7PrimaryKey(),
		tokenId: uuid()
			.notNull()
			.references(() => apikeys.id, { onDelete: "cascade" }),
		scope: text().notNull(),
		expiresAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("api_token_request_lease_token_scope_expiry_idx").on(
			table.tokenId,
			table.scope,
			table.expiresAt,
		),
		index("api_token_request_lease_expiry_idx").on(table.expiresAt),
		check(
			"api_token_request_lease_scope_check",
			sql`btrim(${table.scope}) <> '' and length(${table.scope}) <= 256`,
		),
		check("api_token_request_lease_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
	],
);
