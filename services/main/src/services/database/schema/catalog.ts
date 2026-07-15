import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AliasKindValues,
	PollModeValues,
	PollResultVisibilityValues,
	PostKindValues,
	RealmJoinPolicyValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";

export const collectionKind = pgEnum("collection_kind", ["custom", "favorites"]);
export const postKind = pgEnum("post_kind", toEnumValues(PostKindValues));
export const pollMode = pgEnum("poll_mode", toEnumValues(PollModeValues));
export const pollResultVisibility = pgEnum(
	"poll_result_visibility",
	toEnumValues(PollResultVisibilityValues),
);
export const realmJoinPolicy = pgEnum("realm_join_policy", toEnumValues(RealmJoinPolicyValues));
export const aliasKind = pgEnum("alias_kind", toEnumValues(AliasKindValues));

export const book = pgTable(
	"book",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		isbn13: text(),
		publicationDate: date(),
		pageCount: integer(),
		format: text(),
		licensed: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("book_isbn13_key")
			.on(table.isbn13)
			.where(sql`${table.isbn13} is not null`),
		index("book_publication_date_idx").on(table.publicationDate),
		check("book_isbn13_check", sql`${table.isbn13} is null or ${table.isbn13} ~ '^[0-9]{13}$'`),
		check("book_page_count_check", sql`${table.pageCount} is null or ${table.pageCount} > 0`),
	],
);

export const game = pgTable("game", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	releaseDate: date(),
	versionLabel: text(),
	licensed: boolean().default(false).notNull(),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

export const media = pgTable(
	"media",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		releaseDate: date(),
		runtimeMinutes: integer(),
		episodeCount: integer(),
		seasonCount: integer(),
		licensed: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("media_kind_release_date_idx").on(table.kind, table.releaseDate),
		check("media_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
		check(
			"media_runtime_check",
			sql`${table.runtimeMinutes} is null or ${table.runtimeMinutes} > 0`,
		),
		check(
			"media_episode_count_check",
			sql`${table.episodeCount} is null or ${table.episodeCount} > 0`,
		),
		check(
			"media_season_count_check",
			sql`${table.seasonCount} is null or ${table.seasonCount} > 0`,
		),
	],
);

export const entity = pgTable(
	"entity",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		verified: boolean().default(false).notNull(),
		avatar: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("entity_kind_idx").on(table.kind),
		check("entity_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
	],
);

export const series = pgTable(
	"series",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("series_kind_idx").on(table.kind),
		check("series_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
	],
);

export const zone = pgTable(
	"zone",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		ownerRealmId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		boundary: createJsonObjectColumn().notNull(),
		nav: createJsonObjectColumn().notNull(),
		theme: createJsonObjectColumn().notNull(),
		startsAt: createTimestampMsColumn(),
		endsAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("zone_owner_realm_idx").on(table.ownerRealmId),
		check("zone_not_owner_check", sql`${table.id} <> ${table.ownerRealmId}`),
		check(
			"zone_time_range_check",
			sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`,
		),
		createJsonObjectConstraint("zone_boundary_json_object_check", table.boundary),
		createJsonObjectConstraint("zone_nav_json_object_check", table.nav),
		createJsonObjectConstraint("zone_theme_json_object_check", table.theme),
	],
);

export const collection = pgTable(
	"collection",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		ownerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		kind: collectionKind().default("custom").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("collection_owner_created_at_idx").on(
			table.ownerProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		uniqueIndex("collection_one_favorites_key")
			.on(table.ownerProfileId)
			.where(sql`${table.kind} = 'favorites'::collection_kind`),
	],
);

export const post = pgTable(
	"post",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		authorProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		subjectUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		kind: postKind().default("post").notNull(),
		locked: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("post_author_created_at_idx").on(
			table.authorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("post_subject_created_at_idx").on(
			table.subjectUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("post_kind_created_at_idx").on(table.kind, table.createdAt.desc(), table.id.desc()),
		check(
			"post_subject_not_self_check",
			sql`${table.subjectUnitId} is null or ${table.subjectUnitId} <> ${table.id}`,
		),
		check(
			"post_review_subject_check",
			sql`${table.kind} <> 'review'::post_kind or ${table.subjectUnitId} is not null`,
		),
	],
);

export const poll = pgTable(
	"poll",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		mode: pollMode().default("single").notNull(),
		resultVisibility: pollResultVisibility().default("live").notNull(),
		anonymous: boolean().default(false).notNull(),
		closesAt: createTimestampMsColumn(),
		closedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"poll_closes_at_check",
			sql`${table.closesAt} is null or ${table.closesAt} > ${table.createdAt}`,
		),
		check(
			"poll_closed_at_check",
			sql`${table.closedAt} is null or ${table.closedAt} >= ${table.createdAt}`,
		),
	],
);

export const realm = pgTable("realm", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	joinPolicy: realmJoinPolicy().default("open").notNull(),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

export const postReply = pgTable(
	"post_reply",
	{
		postId: uuid()
			.primaryKey()
			.references(() => post.id, { onDelete: "cascade" }),
		rootPostId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: "restrict" }),
		parentPostId: uuid(),
		contextRealmId: uuid().references(() => realm.id, { onDelete: "set null" }),
		depth: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("post_reply_post_root_key").on(table.postId, table.rootPostId),
		foreignKey({
			columns: [table.parentPostId, table.rootPostId],
			foreignColumns: [table.postId, table.rootPostId],
			name: "post_reply_parent_root_fkey",
		}).onDelete("restrict"),
		index("post_reply_root_created_at_idx").on(table.rootPostId, table.createdAt, table.postId),
		index("post_reply_parent_created_at_idx").on(
			table.parentPostId,
			table.createdAt,
			table.postId,
		),
		index("post_reply_context_realm_idx").on(table.contextRealmId),
		check("post_reply_not_root_check", sql`${table.postId} <> ${table.rootPostId}`),
		check(
			"post_reply_not_self_parent_check",
			sql`${table.parentPostId} is null or ${table.parentPostId} <> ${table.postId}`,
		),
		check("post_reply_depth_check", sql`${table.depth} between 0 and 64`),
	],
);

export const unitAlias = pgTable(
	"unit_alias",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		value: text().notNull(),
		normalizedValue: text().notNull(),
		language: text(),
		kind: aliasKind().default("common").notNull(),
		pinned: boolean().default(false).notNull(),
		position: text(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_alias_unit_normalized_key")
			.on(table.unitId, table.normalizedValue)
			.where(sql`${table.deletedAt} is null`),
		index("unit_alias_unit_pinned_position_idx")
			.on(table.unitId, table.pinned, table.position, table.id)
			.where(sql`${table.deletedAt} is null`),
		index("unit_alias_normalized_idx").on(table.normalizedValue),
		index("unit_alias_created_by_idx").on(table.createdByProfileId),
		check(
			"unit_alias_value_not_blank",
			sql`btrim(${table.value}) <> '' and btrim(${table.normalizedValue}) <> ''`,
		),
		check(
			"unit_alias_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const unitAliasVote = pgTable(
	"unit_alias_vote",
	{
		aliasId: uuid()
			.notNull()
			.references(() => unitAlias.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.aliasId, table.profileId] }),
		index("unit_alias_vote_profile_idx").on(table.profileId),
		check("unit_alias_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

export const unitCredit = pgTable(
	"unit_credit",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		role: text().notNull(),
		position: text().default("V").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_credit_unit_entity_role_key").on(table.unitId, table.entityId, table.role),
		index("unit_credit_entity_role_idx").on(table.entityId, table.role),
		index("unit_credit_unit_position_idx").on(table.unitId, table.position, table.id),
		check("unit_credit_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check("unit_credit_not_self_check", sql`${table.unitId} <> ${table.entityId}`),
	],
);

export const unitLink = pgTable(
	"unit_link",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		sourceEntityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		url: text().notNull(),
		normalizedUrl: text().notNull(),
		normalizedUrlHash: text().notNull(),
		role: text().default("related").notNull(),
		label: text(),
		position: text().default("V").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_link_unit_source_hash_key").on(
			table.unitId,
			table.sourceEntityId,
			table.normalizedUrlHash,
		),
		index("unit_link_unit_position_idx").on(table.unitId, table.position, table.id),
		index("unit_link_source_entity_idx").on(table.sourceEntityId),
		check(
			"unit_link_url_check",
			sql`${table.url} ~ '^https?://' and ${table.normalizedUrl} ~ '^https?://'`,
		),
		check("unit_link_hash_check", sql`${table.normalizedUrlHash} ~ '^[0-9a-f]{64}$'`),
		check("unit_link_role_not_blank", sql`btrim(${table.role}) <> ''`),
	],
);

export const unitTag = pgTable(
	"unit_tag",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		pinned: boolean().default(false).notNull(),
		position: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId] }),
		index("unit_tag_tag_idx").on(table.tagId),
		index("unit_tag_unit_position_idx").on(
			table.unitId,
			table.pinned,
			table.position,
			table.tagId,
		),
		check("unit_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
	],
);

export const unitTagVote = pgTable(
	"unit_tag_vote",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId, table.profileId] }),
		index("unit_tag_vote_tag_idx").on(table.tagId),
		index("unit_tag_vote_profile_idx").on(table.profileId),
		check("unit_tag_vote_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check("unit_tag_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

export const unitVariant = pgTable(
	"unit_variant",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		canonicalUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_variant_canonical_idx").on(table.canonicalUnitId),
		check("unit_variant_not_self_check", sql`${table.unitId} <> ${table.canonicalUnitId}`),
	],
);

export const seriesRelease = pgTable(
	"series_release",
	{
		seriesId: uuid()
			.notNull()
			.references(() => series.id, { onDelete: "cascade" }),
		releaseUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		position: text().notNull(),
		label: text(),
		releasedOn: date(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.seriesId, table.releaseUnitId] }),
		index("series_release_position_idx").on(
			table.seriesId,
			table.position,
			table.releaseUnitId,
		),
		index("series_release_unit_idx").on(table.releaseUnitId),
		check("series_release_not_self_check", sql`${table.seriesId} <> ${table.releaseUnitId}`),
	],
);

export const gameRequirement = pgTable(
	"game_requirement",
	{
		id: createUuidv7PrimaryKey(),
		gameId: uuid()
			.notNull()
			.references(() => game.id, { onDelete: "cascade" }),
		platformEntityId: uuid().references(() => entity.id, { onDelete: "set null" }),
		tier: text().notNull(),
		language: text(),
		sourceLinkId: uuid().references(() => unitLink.id, { onDelete: "set null" }),
		hardware: createJsonObjectColumn().notNull(),
		rawText: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("game_requirement_identity_key")
			.on(table.gameId, table.platformEntityId, table.tier, table.language)
			.nullsNotDistinct(),
		index("game_requirement_platform_idx").on(table.platformEntityId),
		index("game_requirement_source_link_idx").on(table.sourceLinkId),
		check("game_requirement_tier_not_blank", sql`btrim(${table.tier}) <> ''`),
		createJsonObjectConstraint("game_requirement_hardware_json_object_check", table.hardware),
	],
);

export const zonePage = pgTable(
	"zone_page",
	{
		id: createUuidv7PrimaryKey(),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		slug: text().notNull(),
		config: createJsonObjectColumn().notNull(),
		position: text().default("V").notNull(),
		home: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("zone_page_zone_slug_key").on(table.zoneId, table.slug),
		uniqueIndex("zone_page_one_home_key")
			.on(table.zoneId)
			.where(sql`${table.home}`),
		index("zone_page_zone_position_idx").on(table.zoneId, table.position, table.id),
		check("zone_page_slug_not_blank", sql`btrim(${table.slug}) <> ''`),
		createJsonObjectConstraint("zone_page_config_json_object_check", table.config),
	],
);

export const zoneSubscription = pgTable(
	"zone_subscription",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		zoneId: uuid()
			.notNull()
			.references(() => zone.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.zoneId] }),
		index("zone_subscription_zone_created_at_idx").on(
			table.zoneId,
			table.createdAt.desc(),
			table.profileId,
		),
	],
);
