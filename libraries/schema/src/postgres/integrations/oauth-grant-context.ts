import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { SupportedOAuthScopes } from "../../contracts/native/oauth";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "../shared/columns";
import { users } from "../identity/auth";
import { connectedAppClient, connectedAppClientRevision } from "./connected-app-client";
import { connectedUserConsent, connectedUserConsentRevision } from "./connected-user-authorization";
import { connectedInstallation, connectedInstallationRevision } from "./connected-installation";
import { oauthAccessTokens, oauthRefreshTokens } from "../identity/auth-oauth.generated";

/** Indexed user/client refresh-family invalidation; replay never scans or rewrites every token. @internal */
export const oauthRefreshFamily = pgTable(
	"oauth_refresh_family",
	{
		id: createUuidv7PrimaryKey(),
		clientId: uuid()
			.notNull()
			.references(() => connectedAppClient.clientId, { onDelete: "restrict" }),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		epoch: bigint({ mode: "number" }).notNull().default(0),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("oauth_refresh_family_owner_key").on(table.clientId, table.authUserId),
		uniqueIndex("oauth_refresh_family_identity_key").on(table.id, table.clientId, table.authUserId),
		index("oauth_refresh_family_account_idx").on(table.authUserId, table.id),
		check("oauth_refresh_family_epoch_check", sql`${table.epoch} between 0 and 9007199254740991`),
	],
);

/** Immutable captured native authority for issued credentials; refresh retains this context rather than following defaults. @internal */
export const oauthGrantContext = pgTable(
	"oauth_grant_context",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<"user" | "installation">().notNull(),
		clientId: uuid()
			.notNull()
			.references(() => connectedAppClient.clientId, { onDelete: "restrict" }),
		principalId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		clientTermsRevision: bigint({ mode: "number" }).notNull(),
		protocolCredentialEpoch: bigint({ mode: "number" }).notNull(),
		clientCredentialEpoch: bigint({ mode: "number" }).notNull(),
		appAuthorityEpoch: bigint({ mode: "number" }).notNull(),
		consentId: uuid(),
		consentTermsRevision: bigint({ mode: "number" }),
		installationId: uuid(),
		installationApprovalRevision: bigint({ mode: "number" }),
		installationCredentialEpoch: bigint({ mode: "number" }),
		workloadCredentialEpoch: bigint({ mode: "number" }),
		refreshFamilyId: uuid(),
		refreshFamilyEpoch: bigint({ mode: "number" }),
		authorizationCodeId: text(),
		scopes: text().array().notNull(),
		audiences: text().array().notNull(),
		validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
		revokedAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
		createdAt: timestamp({ withTimezone: true, precision: 3, mode: "date" })
			.notNull()
			.default(sql`clock_timestamp()`),
	},
	(table): PgTableExtraConfigValue[] => [
		foreignKey({
			name: "oauth_grant_context_client_terms_fk",
			columns: [table.clientId, table.clientTermsRevision],
			foreignColumns: [connectedAppClientRevision.clientId, connectedAppClientRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			name: "oauth_grant_context_consent_client_fk",
			columns: [table.consentId, table.clientId],
			foreignColumns: [connectedUserConsent.id, connectedUserConsent.clientId],
		}).onDelete("restrict"),
		foreignKey({
			name: "oauth_grant_context_consent_terms_fk",
			columns: [table.consentId, table.consentTermsRevision],
			foreignColumns: [
				connectedUserConsentRevision.consentId,
				connectedUserConsentRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "oauth_grant_context_installation_fk",
			columns: [table.installationId],
			foreignColumns: [connectedInstallation.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "oauth_grant_context_installation_approval_fk",
			columns: [table.installationId, table.installationApprovalRevision],
			foreignColumns: [
				connectedInstallationRevision.installationId,
				connectedInstallationRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "oauth_grant_context_refresh_family_fk",
			columns: [table.refreshFamilyId, table.clientId, table.principalId],
			foreignColumns: [
				oauthRefreshFamily.id,
				oauthRefreshFamily.clientId,
				oauthRefreshFamily.authUserId,
			],
		}).onDelete("restrict"),
		index("oauth_grant_context_account_idx").on(table.principalId, table.id),
		index("oauth_grant_context_client_idx").on(table.clientId, table.id),
		index("oauth_grant_context_consent_idx")
			.on(table.consentId, table.id)
			.where(sql`${table.consentId} is not null`),
		index("oauth_grant_context_installation_idx")
			.on(table.installationId, table.id)
			.where(sql`${table.installationId} is not null`),
		index("oauth_grant_context_family_idx")
			.on(table.refreshFamilyId, table.id)
			.where(sql`${table.refreshFamilyId} is not null`),
		index("oauth_grant_context_expiry_idx").on(table.validUntil, table.id),
		index("oauth_grant_context_created_idx").on(table.createdAt, table.id),
		uniqueIndex("oauth_grant_context_code_key")
			.on(table.authorizationCodeId)
			.where(sql`${table.authorizationCodeId} is not null`),
		check(
			"oauth_grant_context_kind_check",
			sql`(${table.kind}='user' and ${table.consentId} is not null and ${table.consentTermsRevision} is not null and ${table.installationId} is null and ${table.installationApprovalRevision} is null and ${table.installationCredentialEpoch} is null and ${table.workloadCredentialEpoch} is null) or
		(${table.kind}='installation' and ${table.consentId} is null and ${table.consentTermsRevision} is null and ${table.installationId} is not null and ${table.installationApprovalRevision} is not null and ${table.installationCredentialEpoch} is not null and ${table.workloadCredentialEpoch} is not null and ${table.refreshFamilyId} is null and ${table.refreshFamilyEpoch} is null and ${table.authorizationCodeId} is null)`,
		),
		check(
			"oauth_grant_context_epoch_check",
			sql`${table.protocolCredentialEpoch} between 0 and 9007199254740991 and ${table.clientCredentialEpoch} between 0 and 9007199254740991 and ${table.appAuthorityEpoch} between 0 and 9007199254740991
		and (${table.installationCredentialEpoch} is null or ${table.installationCredentialEpoch} between 0 and 9007199254740991) and (${table.workloadCredentialEpoch} is null or ${table.workloadCredentialEpoch} between 0 and 9007199254740991)
		and (${table.refreshFamilyEpoch} is null or ${table.refreshFamilyEpoch} between 0 and 9007199254740991) and (${table.refreshFamilyId} is null)=(${table.refreshFamilyEpoch} is null)`,
		),
		check(
			"oauth_grant_context_time_check",
			sql`isfinite(${table.validUntil}) and ${table.validUntil}>${table.createdAt} and ${table.validUntil}-${table.createdAt}<=interval '365 days' and (${table.revokedAt} is null or isfinite(${table.revokedAt}))`,
		),
		check(
			"oauth_grant_context_scopes_check",
			sql`cardinality(${table.scopes}) between 0 and ${sql.raw(String(SupportedOAuthScopes.length))} and coalesce(array_ndims(${table.scopes}),1)=1 and array_position(${table.scopes},null) is null and ${table.scopes}<@array[${sql.join(
				SupportedOAuthScopes.map((value) => sql`${value}`),
				sql`, `,
			)}]::text[]`,
		),
		check(
			"oauth_grant_context_audiences_check",
			sql`cardinality(${table.audiences}) between 1 and 4 and coalesce(array_ndims(${table.audiences}),1)=1 and array_position(${table.audiences},null) is null and octet_length(array_to_string(${table.audiences},' '))<=8192`,
		),
		check(
			"oauth_grant_context_code_check",
			sql`${table.authorizationCodeId} is null or octet_length(${table.authorizationCodeId}) between 1 and 256`,
		),
	],
);

/** Provider access-token row linked to exactly one native context; token cleanup removes this bounded child. @internal */
export const oauthAccessContext = pgTable(
	"oauth_access_context",
	{
		tokenId: uuid()
			.primaryKey()
			.references(() => oauthAccessTokens.id, { onDelete: "cascade" }),
		contextId: uuid()
			.notNull()
			.references(() => oauthGrantContext.id, { onDelete: "restrict" }),
	},
	(table) => [index("oauth_access_context_context_idx").on(table.contextId, table.tokenId)],
);

/** Refresh generations share their original native context; no parent-token chain or mutable default is needed. @internal */
export const oauthRefreshContext = pgTable(
	"oauth_refresh_context",
	{
		tokenId: uuid()
			.primaryKey()
			.references(() => oauthRefreshTokens.id, { onDelete: "cascade" }),
		contextId: uuid()
			.notNull()
			.references(() => oauthGrantContext.id, { onDelete: "restrict" }),
	},
	(table) => [index("oauth_refresh_context_context_idx").on(table.contextId, table.tokenId)],
);
