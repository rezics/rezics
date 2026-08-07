import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	doublePrecision,
	foreignKey,
	index,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { collection } from "./collection";
import { unitAlias, unitSourceLink } from "./unit";
import { createTimestampMsColumn, createUpdatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { conversation, message } from "./communication";
import { pollOption } from "./poll";
import { profile } from "./profile";
import { unit } from "./unit";
import { post } from "./post";
import { type ContentLanguage, ContentLanguageValues } from "./contract-values";
import { reactionKind } from "./reaction";
import { realm } from "./realm";
import { unitEffectiveTag, unitStructure, unitStructureApplication } from "./structure";
import { realmTagContext, tag } from "./tag";

const aggregateCount = () => bigint({ mode: "bigint" }).default(0n).notNull();

export const scoreStat = pgTable(
	"score_stat",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		totalCount: aggregateCount(),
		totalScore: aggregateCount(),
		score1Count: bigint("score_1_count", { mode: "bigint" }).default(0n).notNull(),
		score2Count: bigint("score_2_count", { mode: "bigint" }).default(0n).notNull(),
		score3Count: bigint("score_3_count", { mode: "bigint" }).default(0n).notNull(),
		score4Count: bigint("score_4_count", { mode: "bigint" }).default(0n).notNull(),
		score5Count: bigint("score_5_count", { mode: "bigint" }).default(0n).notNull(),
		score6Count: bigint("score_6_count", { mode: "bigint" }).default(0n).notNull(),
		score7Count: bigint("score_7_count", { mode: "bigint" }).default(0n).notNull(),
		score8Count: bigint("score_8_count", { mode: "bigint" }).default(0n).notNull(),
		score9Count: bigint("score_9_count", { mode: "bigint" }).default(0n).notNull(),
		score10Count: bigint("score_10_count", { mode: "bigint" }).default(0n).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.realmId] }),
		index("score_stat_realm_idx").on(table.realmId, table.unitId),
		check(
			"score_stat_nonnegative_check",
			sql`${table.totalCount} >= 0 and ${table.totalScore} >= 0 and ${table.score1Count} >= 0 and ${table.score2Count} >= 0 and ${table.score3Count} >= 0 and ${table.score4Count} >= 0 and ${table.score5Count} >= 0 and ${table.score6Count} >= 0 and ${table.score7Count} >= 0 and ${table.score8Count} >= 0 and ${table.score9Count} >= 0 and ${table.score10Count} >= 0`,
		),
		check(
			"score_stat_total_count_check",
			sql`${table.totalCount} = ${table.score1Count} + ${table.score2Count} + ${table.score3Count} + ${table.score4Count} + ${table.score5Count} + ${table.score6Count} + ${table.score7Count} + ${table.score8Count} + ${table.score9Count} + ${table.score10Count}`,
		),
		check(
			"score_stat_total_score_check",
			sql`${table.totalScore} = ${table.score1Count} + 2 * ${table.score2Count} + 3 * ${table.score3Count} + 4 * ${table.score4Count} + 5 * ${table.score5Count} + 6 * ${table.score6Count} + 7 * ${table.score7Count} + 8 * ${table.score8Count} + 9 * ${table.score9Count} + 10 * ${table.score10Count}`,
		),
	],
);

export const unitAliasVoteStat = pgTable(
	"unit_alias_vote_stat",
	{
		aliasId: uuid()
			.primaryKey()
			.references(() => unitAlias.id, { onDelete: "cascade" }),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check("unit_alias_vote_stat_count_check", sql`${table.voteCount} >= 0`),
		check("unit_alias_vote_stat_score_check", sql`abs(${table.score}) <= ${table.voteCount}`),
	],
);

export const unitSourceLinkVoteStat = pgTable(
	"unit_source_link_vote_stat",
	{
		linkId: uuid()
			.primaryKey()
			.references(() => unitSourceLink.id, { onDelete: "cascade" }),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check("unit_source_link_vote_stat_count_check", sql`${table.voteCount} >= 0`),
		check(
			"unit_source_link_vote_stat_score_check",
			sql`abs(${table.score}) <= ${table.voteCount}`,
		),
	],
);

export const unitTagVoteStat = pgTable(
	"unit_tag_vote_stat",
	{
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId] }),
		foreignKey({
			columns: [table.unitId, table.tagId],
			foreignColumns: [unitEffectiveTag.unitId, unitEffectiveTag.tagId],
			name: "unit_tag_vote_stat_effective_tag_fkey",
		}).onDelete("cascade"),
		check("unit_tag_vote_stat_count_check", sql`${table.voteCount} >= 0`),
		check("unit_tag_vote_stat_score_check", sql`abs(${table.score}) <= ${table.voteCount}`),
	],
);

export const unitStructureVoteStat = pgTable(
	"unit_structure_vote_stat",
	{
		structureId: uuid()
			.primaryKey()
			.references(() => unitStructure.id, { onDelete: "cascade" }),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check("unit_structure_vote_stat_count_check", sql`${table.voteCount} >= 0`),
		check(
			"unit_structure_vote_stat_score_check",
			sql`abs(${table.score}) <= ${table.voteCount}`,
		),
	],
);

export const unitStructureApplicationVoteStat = pgTable(
	"unit_structure_application_vote_stat",
	{
		unitId: uuid().notNull(),
		structureId: uuid().notNull(),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.structureId] }),
		foreignKey({
			columns: [table.unitId, table.structureId],
			foreignColumns: [unitStructureApplication.unitId, unitStructureApplication.structureId],
			name: "unit_structure_application_vote_stat_application_fkey",
		}).onDelete("cascade"),
		check("unit_structure_application_vote_stat_count_check", sql`${table.voteCount} >= 0`),
		check(
			"unit_structure_application_vote_stat_score_check",
			sql`abs(${table.score}) <= ${table.voteCount}`,
		),
	],
);

export const realmTagVoteStat = pgTable(
	"realm_tag_vote_stat",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		score: bigint({ mode: "bigint" }).default(0n).notNull(),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId, table.tagId] }),
		foreignKey({
			columns: [table.realmId],
			foreignColumns: [realm.id],
			name: "realm_tag_vote_stat_realm_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.unitId],
			foreignColumns: [unit.id],
			name: "realm_tag_vote_stat_unit_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.tagId],
			foreignColumns: [tag.id],
			name: "realm_tag_vote_stat_tag_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.realmId, table.tagId],
			foreignColumns: [realmTagContext.realmId, realmTagContext.tagId],
			name: "realm_tag_vote_stat_context_fkey",
		}).onDelete("cascade"),
		index("realm_tag_vote_stat_realm_tag_unit_idx").on(
			table.realmId,
			table.tagId,
			table.unitId,
		),
		check("realm_tag_vote_stat_count_check", sql`${table.voteCount} >= 0`),
		check("realm_tag_vote_stat_score_check", sql`abs(${table.score}) <= ${table.voteCount}`),
	],
);

export const unitFollowStat = pgTable(
	"unit_follow_stat",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		followerCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_follow_stat_count_asc_idx").on(table.followerCount.asc(), table.unitId.asc()),
		index("unit_follow_stat_count_desc_idx").on(
			table.followerCount.desc().nullsFirst(),
			table.unitId.desc().nullsFirst(),
		),
		check("unit_follow_stat_count_check", sql`${table.followerCount} >= 0`),
	],
);

export const unitReactionStat = pgTable(
	"unit_reaction_stat",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		reaction: reactionKind().notNull(),
		reactionCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_reaction_stat_identity_key")
			.on(table.unitId, table.realmId, table.reaction)
			.nullsNotDistinct(),
		index("unit_reaction_stat_realm_idx").on(table.realmId, table.unitId),
		check("unit_reaction_stat_count_check", sql`${table.reactionCount} >= 0`),
	],
);

export const unitReactionGlobalStat = pgTable(
	"unit_reaction_global_stat",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		reaction: reactionKind().notNull(),
		reactionCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.reaction] }),
		check("unit_reaction_global_stat_count_check", sql`${table.reactionCount} >= 0`),
	],
);

export const postReplyStat = pgTable(
	"post_reply_stat",
	{
		postId: uuid()
			.primaryKey()
			.references(() => post.id, { onDelete: "cascade" }),
		undeletedDirectCount: aggregateCount(),
		undeletedDescendantCount: aggregateCount(),
		/** Count used by Search: direct replies for reply Posts, descendants otherwise. */
		searchReplyCount: aggregateCount(),
		visibleDirectCount: aggregateCount(),
		visibleDescendantCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("post_reply_stat_search_count_asc_idx").on(
			table.searchReplyCount.asc(),
			table.postId.asc(),
		),
		index("post_reply_stat_search_count_desc_idx").on(
			table.searchReplyCount.desc().nullsFirst(),
			table.postId.desc().nullsFirst(),
		),
		check(
			"post_reply_stat_count_check",
			sql`${table.undeletedDirectCount} >= 0 and ${table.undeletedDescendantCount} >= 0 and ${table.searchReplyCount} >= 0 and ${table.visibleDirectCount} >= 0 and ${table.visibleDescendantCount} >= 0`,
		),
	],
);

export const collectionStat = pgTable(
	"collection_stat",
	{
		collectionId: uuid()
			.primaryKey()
			.references(() => collection.id, { onDelete: "cascade" }),
		itemCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [check("collection_stat_count_check", sql`${table.itemCount} >= 0`)],
);

export const realmStat = pgTable(
	"realm_stat",
	{
		realmId: uuid()
			.primaryKey()
			.references(() => realm.id, { onDelete: "cascade" }),
		activeMemberCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [check("realm_stat_count_check", sql`${table.activeMemberCount} >= 0`)],
);

export const realmUnitModerationStat = pgTable(
	"realm_unit_moderation_stat",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		openReportCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId] }),
		check("realm_unit_moderation_stat_count_check", sql`${table.openReportCount} >= 0`),
	],
);

export const notificationRecipientStat = pgTable(
	"notification_recipient_stat",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		unreadCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [check("notification_recipient_stat_count_check", sql`${table.unreadCount} >= 0`)],
);

/** Exact Chapter totals used to derive Book reading progress without an online scan. */
export const bookChapterStat = pgTable(
	"book_chapter_stat",
	{
		bookUnitId: uuid("book_unit_id")
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		allCount: aggregateCount(),
		publicCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"book_chapter_stat_count_check",
			sql`${table.allCount} >= 0 and ${table.publicCount} >= 0 and ${table.publicCount} <= ${table.allCount}`,
		),
	],
);

/** Exact per-Profile Chapter completions used to derive Book reading progress. */
export const bookChapterProgressStat = pgTable(
	"book_chapter_progress_stat",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		bookUnitId: uuid("book_unit_id")
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		allCompletedCount: aggregateCount(),
		publicCompletedCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.bookUnitId] }),
		check(
			"book_chapter_progress_stat_count_check",
			sql`${table.allCompletedCount} >= 0 and ${table.publicCompletedCount} >= 0 and ${table.publicCompletedCount} <= ${table.allCompletedCount}`,
		),
	],
);

/** Rebuildable exact public Chapter metrics, grouped by Book and content language. */
export const bookLocalizedContentMetricStat = pgTable(
	"book_localized_content_metric_stat",
	{
		bookUnitId: uuid("book_unit_id")
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		language: text().$type<ContentLanguage>().notNull(),
		chapterCount: aggregateCount(),
		wordCount: aggregateCount(),
		characterCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.bookUnitId, table.language] }),
		check(
			"book_localized_content_metric_stat_language_check",
			inArray(table.language, ContentLanguageValues),
		),
		check(
			"book_localized_content_metric_stat_count_check",
			sql`${table.chapterCount} >= 0 and ${table.wordCount} >= 0 and ${table.characterCount} >= 0`,
		),
	],
);

export const pollOptionVoteStat = pgTable(
	"poll_option_vote_stat",
	{
		optionId: uuid()
			.primaryKey()
			.references(() => pollOption.id, { onDelete: "cascade" }),
		voteCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [check("poll_option_vote_stat_count_check", sql`${table.voteCount} >= 0`)],
);

export const conversationStat = pgTable(
	"conversation_stat",
	{
		conversationId: uuid()
			.primaryKey()
			.references(() => conversation.id, { onDelete: "cascade" }),
		lastMessageId: uuid().references(() => message.id, { onDelete: "set null" }),
		lastMessageAt: createTimestampMsColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [index("conversation_stat_last_message_idx").on(table.lastMessageId)],
);

export const conversationParticipantStat = pgTable(
	"conversation_participant_stat",
	{
		conversationId: uuid()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		lastMessageId: uuid().references(() => message.id, { onDelete: "set null" }),
		lastMessageAt: createTimestampMsColumn(),
		sortAt: createTimestampMsColumn().notNull(),
		unreadCount: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.profileId] }),
		index("conversation_participant_stat_profile_sort_idx").on(
			table.profileId,
			table.sortAt.desc(),
			table.conversationId.desc(),
		),
		index("conversation_participant_stat_last_message_idx").on(table.lastMessageId),
		check("conversation_participant_stat_count_check", sql`${table.unreadCount} >= 0`),
	],
);

export const unitEngagementStat = pgTable(
	"unit_engagement_stat",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		upvotes: aggregateCount(),
		downvotes: aggregateCount(),
		replies: aggregateCount(),
		favorites: aggregateCount(),
		shares: aggregateCount(),
		highScores: aggregateCount(),
		activeProgress: aggregateCount(),
		completions: aggregateCount(),
		negativeProgress: aggregateCount(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"unit_engagement_stat_count_check",
			sql`${table.upvotes} >= 0 and ${table.downvotes} >= 0 and ${table.replies} >= 0 and ${table.favorites} >= 0 and ${table.shares} >= 0 and ${table.highScores} >= 0 and ${table.activeProgress} >= 0 and ${table.completions} >= 0 and ${table.negativeProgress} >= 0`,
		),
	],
);

export const recommendationSignalKind = pgEnum("recommendation_signal_kind", [
	"impression",
	"open",
	"dwell_30s",
	"not_interested",
	"upvote",
	"downvote",
	"reply",
	"favorite",
	"share",
	"score_high",
	"score_medium",
	"score_low",
	"progress_active",
	"progress_completed",
	"progress_dropped",
]);

export const recommendationUnitSignalHourly = pgTable(
	"recommendation_unit_signal_hourly",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		bucketStart: createTimestampMsColumn().notNull(),
		kind: recommendationSignalKind().notNull(),
		signalCount: aggregateCount(),
		weight: doublePrecision().default(0).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.bucketStart, table.kind] }),
		index("recommendation_unit_signal_hourly_bucket_idx").on(table.bucketStart, table.unitId),
		check("recommendation_unit_signal_hourly_count_check", sql`${table.signalCount} >= 0`),
		check("recommendation_unit_signal_hourly_weight_check", sql`${table.weight} >= 0`),
	],
);

export const recommendationProfileSignalHourly = pgTable(
	"recommendation_profile_signal_hourly",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		bucketStart: createTimestampMsColumn().notNull(),
		kind: recommendationSignalKind().notNull(),
		signalCount: aggregateCount(),
		weight: doublePrecision().default(0).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId, table.bucketStart, table.kind] }),
		index("recommendation_profile_signal_hourly_bucket_idx").on(
			table.bucketStart,
			table.profileId,
		),
		check("recommendation_profile_signal_hourly_count_check", sql`${table.signalCount} >= 0`),
	],
);
