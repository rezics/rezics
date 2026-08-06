import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { apikeys, users } from "./auth";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { ApiQuotaPolicyClassValues, ApiQuotaPolicySubjectKindValues } from "./contract-values";
import { profile } from "./profile";

export type ApiQuotaPolicyClass = (typeof ApiQuotaPolicyClassValues)[number];
export type ApiQuotaPolicySubjectKind = (typeof ApiQuotaPolicySubjectKindValues)[number];

export const apiQuotaPolicy = pgTable(
	"api_quota_policy",
	{
		id: createUuidv7PrimaryKey(),
		key: text().notNull().unique(),
		subjectKind: text().$type<ApiQuotaPolicySubjectKind>().notNull(),
		class: text().$type<ApiQuotaPolicyClass>().notNull(),
		currentRevision: integer().default(1).notNull(),
		enabled: boolean().default(true).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check("api_quota_policy_key_check", sql`${table.key} ~ '^[a-z][a-z0-9_-]{0,63}$'`),
		check(
			"api_quota_policy_subject_kind_check",
			sql`${table.subjectKind} in ('account', 'token')`,
		),
		check("api_quota_policy_class_check", sql`${table.class} in ('standard', 'privileged')`),
		check("api_quota_policy_current_revision_check", sql`${table.currentRevision} > 0`),
		uniqueIndex("api_quota_policy_id_subject_kind_key").on(table.id, table.subjectKind),
	],
);

export const apiQuotaPolicyRevision = pgTable(
	"api_quota_policy_revision",
	{
		policyId: uuid()
			.notNull()
			.references(() => apiQuotaPolicy.id, { onDelete: "cascade" }),
		revision: integer().notNull(),
		schemaVersion: integer().notNull(),
		configuration: createJsonDocumentColumn().notNull(),
		changeReason: text().notNull(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.policyId, table.revision] }),
		index("api_quota_policy_revision_created_by_idx").on(table.createdByProfileId),
		check("api_quota_policy_revision_revision_check", sql`${table.revision} > 0`),
		check("api_quota_policy_revision_schema_version_check", sql`${table.schemaVersion} > 0`),
		check(
			"api_quota_policy_revision_configuration_json_object_check",
			sql`jsonb_typeof(${table.configuration}) = 'object'`,
		),
		check(
			"api_quota_policy_revision_change_reason_check",
			sql`btrim(${table.changeReason}) <> ''`,
		),
	],
);

export const apiAccountQuotaBinding = pgTable(
	"api_account_quota_binding",
	{
		userId: uuid()
			.primaryKey()
			.references(() => users.id, { onDelete: "cascade" }),
		policyId: uuid().notNull(),
		policySubjectKind: text().$type<"account">().default("account").notNull(),
		configurationOverride: createJsonDocumentColumn().default(sql`'{}'::jsonb`).notNull(),
		validUntil: createTimestampMsColumn(),
		assignmentReason: text().notNull(),
		assignedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		revision: integer().default(1).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.policyId, table.policySubjectKind],
			foreignColumns: [apiQuotaPolicy.id, apiQuotaPolicy.subjectKind],
			name: "api_account_quota_binding_policy_kind_fkey",
		}).onDelete("restrict"),
		index("api_account_quota_binding_policy_idx").on(table.policyId),
		index("api_account_quota_binding_assigned_by_idx").on(table.assignedByProfileId),
		check("api_account_quota_binding_revision_check", sql`${table.revision} > 0`),
		check(
			"api_account_quota_binding_policy_kind_check",
			sql`${table.policySubjectKind} = 'account'`,
		),
		check(
			"api_account_quota_binding_configuration_json_object_check",
			sql`jsonb_typeof(${table.configurationOverride}) = 'object'`,
		),
		check(
			"api_account_quota_binding_validity_check",
			sql`${table.validUntil} is null or ${table.validUntil} > ${table.createdAt}`,
		),
		check(
			"api_account_quota_binding_reason_check",
			sql`btrim(${table.assignmentReason}) <> ''`,
		),
	],
);

export const apiTokenQuotaBinding = pgTable(
	"api_token_quota_binding",
	{
		tokenId: uuid()
			.primaryKey()
			.references(() => apikeys.id, { onDelete: "cascade" }),
		policyId: uuid().notNull(),
		policySubjectKind: text().$type<"token">().default("token").notNull(),
		configurationOverride: createJsonDocumentColumn().default(sql`'{}'::jsonb`).notNull(),
		validUntil: createTimestampMsColumn(),
		assignmentReason: text().notNull(),
		assignedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		revision: integer().default(1).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.policyId, table.policySubjectKind],
			foreignColumns: [apiQuotaPolicy.id, apiQuotaPolicy.subjectKind],
			name: "api_token_quota_binding_policy_kind_fkey",
		}).onDelete("restrict"),
		index("api_token_quota_binding_policy_idx").on(table.policyId),
		index("api_token_quota_binding_assigned_by_idx").on(table.assignedByProfileId),
		check(
			"api_token_quota_binding_policy_kind_check",
			sql`${table.policySubjectKind} = 'token'`,
		),
		check("api_token_quota_binding_revision_check", sql`${table.revision} > 0`),
		check(
			"api_token_quota_binding_configuration_json_object_check",
			sql`jsonb_typeof(${table.configurationOverride}) = 'object'`,
		),
		check(
			"api_token_quota_binding_validity_check",
			sql`${table.validUntil} is null or ${table.validUntil} > ${table.createdAt}`,
		),
		check("api_token_quota_binding_reason_check", sql`btrim(${table.assignmentReason}) <> ''`),
	],
);

export const apiTokenQuotaOverride = pgTable(
	"api_token_quota_override",
	{
		tokenId: uuid()
			.primaryKey()
			.references(() => apikeys.id, { onDelete: "cascade" }),
		configurationOverride: createJsonDocumentColumn().notNull(),
		revision: integer().default(1).notNull(),
		updatedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("api_token_quota_override_updated_by_idx").on(table.updatedByProfileId),
		check("api_token_quota_override_revision_check", sql`${table.revision} > 0`),
		check(
			"api_token_quota_override_configuration_json_object_check",
			sql`jsonb_typeof(${table.configurationOverride}) = 'object'`,
		),
	],
);

export const apiTokenCreationReservation = pgTable(
	"api_token_creation_reservation",
	{
		id: createUuidv7PrimaryKey(),
		accountUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("api_token_creation_reservation_account_expiry_idx").on(
			table.accountUserId,
			table.expiresAt,
		),
		index("api_token_creation_reservation_expiry_idx").on(table.expiresAt),
		check(
			"api_token_creation_reservation_expiry_check",
			sql`${table.expiresAt} > ${table.createdAt}`,
		),
	],
);

const quotaSubjectCheck = (name: string, accountUserId: AnyPgColumn, tokenId: AnyPgColumn) =>
	check(name, sql`num_nonnulls(${accountUserId}, ${tokenId}) = 1`);

export const apiQuotaRateState = pgTable(
	"api_quota_rate_state",
	{
		id: createUuidv7PrimaryKey(),
		accountUserId: uuid().references(() => users.id, { onDelete: "cascade" }),
		tokenId: uuid().references(() => apikeys.id, { onDelete: "cascade" }),
		scope: text().notNull(),
		availableRateUnits: bigint({ mode: "number" }).notNull(),
		refilledAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("api_quota_rate_state_account_scope_key")
			.on(table.accountUserId, table.scope)
			.where(sql`${table.accountUserId} is not null`),
		uniqueIndex("api_quota_rate_state_token_scope_key")
			.on(table.tokenId, table.scope)
			.where(sql`${table.tokenId} is not null`),
		index("api_quota_rate_state_updated_at_idx").on(table.updatedAt),
		quotaSubjectCheck("api_quota_rate_state_subject_check", table.accountUserId, table.tokenId),
		check(
			"api_quota_rate_state_scope_check",
			sql`btrim(${table.scope}) <> '' and length(${table.scope}) <= 256`,
		),
		check("api_quota_rate_state_available_units_check", sql`${table.availableRateUnits} >= 0`),
	],
);

export const apiQuotaDailyUsage = pgTable(
	"api_quota_daily_usage",
	{
		id: createUuidv7PrimaryKey(),
		accountUserId: uuid().references(() => users.id, { onDelete: "cascade" }),
		tokenId: uuid().references(() => apikeys.id, { onDelete: "cascade" }),
		scope: text().notNull(),
		usageDate: date().notNull(),
		usedCostUnits: bigint({ mode: "number" }).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("api_quota_daily_usage_account_scope_date_key")
			.on(table.accountUserId, table.scope, table.usageDate)
			.where(sql`${table.accountUserId} is not null`),
		uniqueIndex("api_quota_daily_usage_token_scope_date_key")
			.on(table.tokenId, table.scope, table.usageDate)
			.where(sql`${table.tokenId} is not null`),
		index("api_quota_daily_usage_date_idx").on(table.usageDate),
		quotaSubjectCheck(
			"api_quota_daily_usage_subject_check",
			table.accountUserId,
			table.tokenId,
		),
		check(
			"api_quota_daily_usage_scope_check",
			sql`btrim(${table.scope}) <> '' and length(${table.scope}) <= 256`,
		),
		check("api_quota_daily_usage_used_cost_check", sql`${table.usedCostUnits} >= 0`),
	],
);

export const apiQuotaRequestLease = pgTable(
	"api_quota_request_lease",
	{
		id: createUuidv7PrimaryKey(),
		requestId: uuid().notNull(),
		accountUserId: uuid().references(() => users.id, { onDelete: "cascade" }),
		tokenId: uuid().references(() => apikeys.id, { onDelete: "cascade" }),
		scope: text().notNull(),
		expiresAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("api_quota_request_lease_account_request_scope_key")
			.on(table.accountUserId, table.requestId, table.scope)
			.where(sql`${table.accountUserId} is not null`),
		uniqueIndex("api_quota_request_lease_token_request_scope_key")
			.on(table.tokenId, table.requestId, table.scope)
			.where(sql`${table.tokenId} is not null`),
		index("api_quota_request_lease_account_scope_expiry_idx")
			.on(table.accountUserId, table.scope, table.expiresAt)
			.where(sql`${table.accountUserId} is not null`),
		index("api_quota_request_lease_token_scope_expiry_idx")
			.on(table.tokenId, table.scope, table.expiresAt)
			.where(sql`${table.tokenId} is not null`),
		index("api_quota_request_lease_expiry_idx").on(table.expiresAt),
		quotaSubjectCheck(
			"api_quota_request_lease_subject_check",
			table.accountUserId,
			table.tokenId,
		),
		check(
			"api_quota_request_lease_scope_check",
			sql`btrim(${table.scope}) <> '' and length(${table.scope}) <= 256`,
		),
		check("api_quota_request_lease_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
	],
);
