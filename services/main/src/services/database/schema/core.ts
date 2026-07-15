import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	doublePrecision,
	index,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { PortableText } from "@rezics/portable-text";

import { pgTable } from "./base";
import {
	AiDisclosureValues,
	ApiTokenScopeValues,
	CollaboratorRoleValues,
	ContentRatingValues,
	ContentStatusValues,
	DefaultLanguage,
	ModerationStatusValues,
	UnitKindValues,
	UnitStatusValues,
	UnitVisibilityValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonArrayConstraint,
	createJsonDocumentColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { users } from "./auth";

export const unitKind = pgEnum("unit_kind", toEnumValues(UnitKindValues));
export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const unitVisibility = pgEnum("unit_visibility", toEnumValues(UnitVisibilityValues));
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));
export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));
export const collaboratorRole = pgEnum("collaborator_role", toEnumValues(CollaboratorRoleValues));

export const unit = pgTable(
	"unit",
	{
		id: createUuidv7PrimaryKey(),
		kind: unitKind().notNull(),
		slug: text(),
		status: unitStatus().default("draft").notNull(),
		visibility: unitVisibility().default("public").notNull(),
		contentRating: contentRating().default("general").notNull(),
		aiDisclosure: aiDisclosure().default("unknown").notNull(),
		license: text(),
		metadata: createJsonObjectColumn(),
		coverKey: text(),
		coverFocalX: doublePrecision(),
		coverFocalY: doublePrecision(),
		moderationStatus: moderationStatus().default("approved").notNull(),
		publishedAt: createTimestampMsColumn(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_kind_slug_key")
			.on(table.kind, table.slug)
			.where(sql`${table.slug} is not null`),
		index("unit_kind_status_created_at_idx")
			.on(table.kind, table.status, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_status_visibility_created_at_idx")
			.on(table.status, table.visibility, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_moderation_status_idx").on(table.moderationStatus),
		index("unit_slug_search_idx")
			.using("pgroonga", table.slug)
			.where(sql`${table.deletedAt} is null`),
		check("unit_slug_not_blank", sql`${table.slug} is null or btrim(${table.slug}) <> ''`),
		check(
			"unit_cover_shape_check",
			sql`(${table.coverKey} is null and ${table.coverFocalX} is null and ${table.coverFocalY} is null) or (${table.coverKey} is not null and ${table.coverFocalX} between 0 and 1 and ${table.coverFocalY} between 0 and 1)`,
		),
		check(
			"unit_publication_check",
			sql`${table.status} <> 'published'::unit_status or ${table.publishedAt} is not null`,
		),
		check(
			"unit_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
		createJsonObjectConstraint("unit_metadata_json_object_check", table.metadata),
	],
);

export const unitLocalization = pgTable(
	"unit_localization",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		language: text().notNull(),
		isDefault: boolean().default(false).notNull(),
		title: text(),
		summary: text(),
		description: createJsonDocumentColumn<PortableText>(),
		content: createJsonDocumentColumn<PortableText>(),
		contentStatus: contentStatus(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.language] }),
		uniqueIndex("unit_localization_one_default_key")
			.on(table.unitId)
			.where(sql`${table.isDefault}`),
		index("unit_localization_language_unit_idx").on(table.language, table.unitId),
		index("unit_localization_content_status_idx").on(table.contentStatus, table.updatedAt),
		index("unit_localization_title_search_idx").using("pgroonga", table.title),
		index("unit_localization_summary_search_idx").using("pgroonga", table.summary),
		index("unit_localization_description_search_idx").using(
			"pgroonga",
			table.description.op("pgroonga_jsonb_full_text_search_ops_v2"),
		),
		index("unit_localization_content_search_idx").using(
			"pgroonga",
			table.content.op("pgroonga_jsonb_full_text_search_ops_v2"),
		),
		check(
			"unit_localization_language_check",
			sql`btrim(${table.language}) <> '' and char_length(${table.language}) <= 35`,
		),
		check(
			"unit_localization_value_check",
			sql`${table.title} is not null or ${table.summary} is not null or ${table.description} is not null or ${table.content} is not null`,
		),
		check(
			"unit_localization_content_state_check",
			sql`(${table.content} is null) = (${table.contentStatus} is null)`,
		),
		createJsonArrayConstraint(
			"unit_localization_description_json_array_check",
			table.description,
		),
		createJsonArrayConstraint("unit_localization_content_json_array_check", table.content),
	],
);

export const profile = pgTable(
	"profile",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		name: text(),
		avatar: text(),
		summary: text(),
		description: createJsonDocumentColumn<PortableText>(),
		joinedAt: createTimestampMsColumn().defaultNow().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("profile_auth_user_id_key").on(table.authUserId),
		index("profile_name_search_idx").using("pgroonga", table.name),
		index("profile_summary_search_idx").using("pgroonga", table.summary),
		index("profile_description_search_idx").using(
			"pgroonga",
			table.description.op("pgroonga_jsonb_full_text_search_ops_v2"),
		),
		check("profile_name_not_blank", sql`${table.name} is null or btrim(${table.name}) <> ''`),
		createJsonArrayConstraint("profile_description_json_array_check", table.description),
	],
);

export const profilePreference = pgTable(
	"profile_preference",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		defaultLicense: text(),
		defaultRealmManageMode: boolean().default(false).notNull(),
		personalizedFeed: boolean().default(true).notNull(),
		collectionConfig: createJsonObjectColumn(),
		contentRatings: contentRating()
			.array()
			.default(sql`array[]::content_rating[]`)
			.notNull(),
		preferredLanguages: text()
			.array()
			.default(sql.raw(`array['${DefaultLanguage}']::text[]`))
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"profile_preference_default_license_check",
			sql`${table.defaultLicense} is null or btrim(${table.defaultLicense}) <> ''`,
		),
		check(
			"profile_preference_languages_check",
			sql`cardinality(${table.preferredLanguages}) > 0`,
		),
		createJsonObjectConstraint(
			"profile_preference_collection_config_json_object_check",
			table.collectionConfig,
		),
	],
);

export const apiToken = pgTable(
	"api_token",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		name: text().notNull(),
		prefix: text().notNull(),
		tokenHash: text().notNull(),
		scopes: text()
			.array()
			.default(sql`array[]::text[]`)
			.notNull(),
		expiresAt: createTimestampMsColumn(),
		lastUsedAt: createTimestampMsColumn(),
		revokedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("api_token_hash_key").on(table.tokenHash),
		unique("api_token_prefix_key").on(table.prefix),
		index("api_token_profile_created_at_idx").on(
			table.profileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check("api_token_name_not_blank", sql`btrim(${table.name}) <> ''`),
		check(
			"api_token_scopes_check",
			sql`${table.scopes} <@ ${sql.raw(`array[${ApiTokenScopeValues.map((value) => `'${value}'`).join(",")}]::text[]`)}`,
		),
	],
);

export const unitCollaborator = pgTable(
	"unit_collaborator",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		role: collaboratorRole().notNull(),
		addedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.profileId] }),
		index("unit_collaborator_profile_role_idx").on(table.profileId, table.role),
		index("unit_collaborator_added_by_idx").on(table.addedByProfileId),
	],
);

export const unitFieldLock = pgTable(
	"unit_field_lock",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		path: text().notNull(),
		lockedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		reason: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_field_lock_unit_path_key").on(table.unitId, table.path),
		index("unit_field_lock_locked_by_idx").on(table.lockedByProfileId),
		check("unit_field_lock_path_check", sql`${table.path} ~ '^/'`),
	],
);

export const profileFollow = pgTable(
	"profile_follow",
	{
		followerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		followedProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.followerProfileId, table.followedProfileId] }),
		index("profile_follow_followed_created_at_idx").on(
			table.followedProfileId,
			table.createdAt.desc(),
			table.followerProfileId,
		),
		check(
			"profile_follow_not_self_check",
			sql`${table.followerProfileId} <> ${table.followedProfileId}`,
		),
	],
);

export const profileBlock = pgTable(
	"profile_block",
	{
		blockerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		blockedProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.blockerProfileId, table.blockedProfileId] }),
		index("profile_block_blocked_idx").on(table.blockedProfileId),
		check(
			"profile_block_not_self_check",
			sql`${table.blockerProfileId} <> ${table.blockedProfileId}`,
		),
	],
);
