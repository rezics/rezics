import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	doublePrecision,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { book, collection, poll, post, realm } from "./catalog";
import { ProgressStatusValues, ReactionKindValues, toEnumValues } from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { contentRating, profile, unit } from "./core";

export const progressStatus = pgEnum("progress_status", toEnumValues(ProgressStatusValues));
export const reactionKind = pgEnum("reaction_kind", toEnumValues(ReactionKindValues));

export const contentNode = pgTable(
	"content_node",
	{
		id: createUuidv7PrimaryKey(),
		bookId: uuid()
			.notNull()
			.references(() => book.id, { onDelete: "cascade" }),
		parentId: uuid(),
		chapterId: uuid().references(() => post.id, { onDelete: "restrict" }),
		title: text().notNull(),
		position: text().notNull(),
		contentRating: contentRating(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("content_node_id_book_key").on(table.id, table.bookId),
		foreignKey({
			columns: [table.parentId, table.bookId],
			foreignColumns: [table.id, table.bookId],
			name: "content_node_parent_book_fkey",
		}).onDelete("restrict"),
		index("content_node_book_parent_position_idx")
			.on(table.bookId, table.parentId, table.position, table.id)
			.where(sql`${table.deletedAt} is null`),
		index("content_node_parent_idx").on(table.parentId),
		index("content_node_chapter_idx").on(table.chapterId),
		check("content_node_title_not_blank", sql`btrim(${table.title}) <> ''`),
		check(
			"content_node_not_self_parent",
			sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
		),
		check(
			"content_node_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const contentNodeProgress = pgTable(
	"content_node_progress",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		nodeId: uuid()
			.notNull()
			.references(() => contentNode.id, { onDelete: "cascade" }),
		completedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.nodeId] }),
		index("content_node_progress_node_idx").on(table.nodeId),
	],
);

export const unitProgress = pgTable(
	"unit_progress",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		progress: doublePrecision().default(0).notNull(),
		status: progressStatus().default("backlog").notNull(),
		completedCount: integer().default(0).notNull(),
		totalTimeMs: bigint({ mode: "bigint" }).default(0n).notNull(),
		firstSeenAt: createTimestampMsColumn().defaultNow().notNull(),
		lastSeenAt: createTimestampMsColumn().defaultNow().notNull(),
		lastReadNodeId: uuid(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId] }),
		foreignKey({
			columns: [table.lastReadNodeId, table.unitId],
			foreignColumns: [contentNode.id, contentNode.bookId],
			name: "unit_progress_last_node_fkey",
		}).onDelete("restrict"),
		index("unit_progress_unit_status_idx").on(table.unitId, table.status),
		index("unit_progress_profile_seen_idx")
			.on(table.profileId, table.lastSeenAt.desc(), table.unitId)
			.where(sql`${table.deletedAt} is null`),
		index("unit_progress_last_node_idx").on(table.lastReadNodeId),
		check("unit_progress_value_check", sql`${table.progress} between 0 and 1`),
		check(
			"unit_progress_count_check",
			sql`${table.completedCount} >= 0 and ${table.totalTimeMs} >= 0`,
		),
		check("unit_progress_seen_check", sql`${table.lastSeenAt} >= ${table.firstSeenAt}`),
		check(
			"unit_progress_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const collectionItem = pgTable(
	"collection_item",
	{
		collectionId: uuid()
			.notNull()
			.references(() => collection.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		role: text().default("item").notNull(),
		position: text().default("V").notNull(),
		addedByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.unitId] }),
		index("collection_item_collection_position_idx").on(
			table.collectionId,
			table.position,
			table.unitId,
		),
		index("collection_item_unit_idx").on(table.unitId),
		index("collection_item_added_by_idx").on(table.addedByProfileId),
		check("collection_item_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check("collection_item_not_self_check", sql`${table.collectionId} <> ${table.unitId}`),
	],
);

export const unitReaction = pgTable(
	"unit_reaction",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		reaction: reactionKind().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_reaction_identity_key")
			.on(table.profileId, table.unitId, table.realmId)
			.nullsNotDistinct(),
		index("unit_reaction_unit_kind_realm_idx").on(table.unitId, table.reaction, table.realmId),
		index("unit_reaction_realm_idx").on(table.realmId),
		index("unit_reaction_profile_created_at_idx").on(
			table.profileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
	],
);

export const unitShare = pgTable(
	"unit_share",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId] }),
		index("unit_share_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.profileId,
		),
	],
);

export const score = pgTable(
	"score",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId, table.realmId] }),
		index("score_unit_realm_value_idx").on(table.unitId, table.realmId, table.value),
		index("score_realm_idx").on(table.realmId),
		check("score_value_check", sql`${table.value} between 1 and 10`),
	],
);

export const pollOption = pgTable(
	"poll_option",
	{
		id: createUuidv7PrimaryKey(),
		pollId: uuid()
			.notNull()
			.references(() => poll.id, { onDelete: "cascade" }),
		label: text().notNull(),
		position: text().notNull(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("poll_option_poll_id_key").on(table.pollId, table.id),
		index("poll_option_poll_position_idx")
			.on(table.pollId, table.position, table.id)
			.where(sql`${table.deletedAt} is null`),
		index("poll_option_label_search_idx")
			.using("pgroonga", table.label)
			.where(sql`${table.deletedAt} is null`),
		check("poll_option_label_not_blank", sql`btrim(${table.label}) <> ''`),
		check(
			"poll_option_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const pollVote = pgTable(
	"poll_vote",
	{
		pollId: uuid()
			.notNull()
			.references(() => poll.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		optionId: uuid().notNull(),
		realmId: uuid().references(() => realm.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.pollId, table.profileId, table.optionId] }),
		foreignKey({
			columns: [table.pollId, table.optionId],
			foreignColumns: [pollOption.pollId, pollOption.id],
			name: "poll_vote_option_fkey",
		}).onDelete("restrict"),
		index("poll_vote_option_idx").on(table.optionId),
		index("poll_vote_profile_created_at_idx").on(
			table.profileId,
			table.createdAt.desc(),
			table.pollId,
		),
		index("poll_vote_realm_idx").on(table.realmId),
	],
);
