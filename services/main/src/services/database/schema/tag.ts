import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	smallint,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createPlatformIdentityColumns, platformIdentityConstraints } from "./platform-identity";
import { unitReferenceColumns, unitReferenceConstraints } from "./unit-reference-columns";

import { referenceValue } from "./reference-value";
import { users } from "./auth";
import { pgTable } from "./base";
import { entityIdentity } from "./catalog-identity";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	fractionalIndexPosition,
} from "./columns";
import { post } from "./post";
import { realm, realmUnit } from "./realm";
import { vocabularyNode } from "./vocabulary";

/** Marker table proving that a Unit is a Tag. */
export const tag = pgTable(
	"tag",
	{
		...createPlatformIdentityColumns(),
		nodeKind: text().$type<"concept">().default("concept").notNull(),
		directlyApplicable: boolean().default(true).notNull(),
		defaultSpoilerLevel: smallint(),
	},
	(table) => [
		...platformIdentityConstraints("tag", table),
		foreignKey({
			columns: [table.id, table.nodeKind],
			foreignColumns: [vocabularyNode.id, vocabularyNode.kind],
			name: "tag_vocabulary_node_fkey",
		}).onDelete("cascade"),
		check("tag_node_kind_check", sql`${table.nodeKind} = 'concept'`),
		check(
			"tag_default_spoiler_level_check",
			sql`${table.defaultSpoilerLevel} is null or ${table.defaultSpoilerLevel} between 0 and 2`,
		),
	],
);

/** Global, community-voted Unit-to-Tag relationship. */
export const unitTag = pgTable(
	"unit_tag",
	{
		unitId: uuid().notNull(),
		...unitReferenceColumns("unit", "cascade"),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		createdByProfileId: uuid().references(() => entityIdentity.id, {
			onDelete: "set null",
		}),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		...unitReferenceConstraints("unit_tag", "unit", table, false, table.unitId),
		primaryKey({ columns: [table.unitId, table.tagId] }),
		index("unit_tag_tag_idx").on(table.tagId, table.unitId),
		index("unit_tag_created_by_idx").on(table.createdByProfileId),
		index("unit_tag_unit_position_idx").on(table.unitId, table.pinned, table.position, table.tagId),
		uniqueIndex("unit_tag_unit_pinned_position_unique")
			.on(table.unitId, table.position)
			.where(sql`${table.pinned}`),
		check(
			"unit_tag_pinned_position_check",
			sql`(${table.pinned} and ${table.position} is not null)
				or (not ${table.pinned} and ${table.position} is null)`,
		),
		check("unit_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_tag_position_byte_length_check",
			table.position,
		),
	],
);

/**
 * A Profile's ordered set of Realm sources for contextual Tag assertions.
 *
 * This preference is intentionally independent from Realm membership and Unit
 * following: it only controls which Realm-scoped Tag votes are surfaced in the
 * Profile's personalized Tag landscape.
 */
export const accountRealmTagSubscription = pgTable(
	"account_realm_tag_subscription",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition()
			.default(sql`'a0' || replace(uuidv7()::text, '-', '') || 'V'`)
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.realmId] }),
		index("account_realm_tag_subscription_auth_position_idx").on(
			table.authUserId,
			table.position,
			table.realmId,
		),
		index("account_realm_tag_subscription_realm_idx").on(table.realmId, table.authUserId),
		createFractionalIndexPositionByteLengthConstraint(
			"account_realm_tag_subscription_position_byte_length_check",
			table.position,
		),
	],
);

export const unitTagJudgment = pgTable(
	"unit_tag_judgment",
	{
		unitId: uuid().notNull(),
		...unitReferenceColumns("unit", "restrict"),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict" }),
		profileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		fitVote: integer(),
		spoilerLevel: smallint(),
		fitUpdatedAt: createTimestampMsColumn(),
		spoilerUpdatedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		...unitReferenceConstraints("unit_tag_judgment", "unit", table, false, table.unitId),
		primaryKey({ columns: [table.unitId, table.tagId, table.profileId] }),
		foreignKey({
			columns: [table.unitId, table.tagId],
			foreignColumns: [unitTag.unitId, unitTag.tagId],
			name: "unit_tag_judgment_unit_tag_fkey",
		}).onDelete("restrict"),
		index("unit_tag_judgment_tag_unit_idx").on(table.tagId, table.unitId),
		index("unit_tag_judgment_profile_unit_tag_idx").on(table.profileId, table.unitId, table.tagId),
		check("unit_tag_judgment_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check(
			"unit_tag_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"unit_tag_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"unit_tag_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"unit_tag_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"unit_tag_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);

/** The canonical Wiki explanation of one Tag in one Realm. */
export const realmTagContext = pgTable(
	"realm_tag_context",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		contextPostId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: "restrict" }),
		createdByProfileId: uuid().references(() => entityIdentity.id, {
			onDelete: "set null",
		}),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.tagId] }),
		uniqueIndex("realm_tag_context_post_unique").on(table.contextPostId),
		foreignKey({
			columns: [table.realmId, table.contextPostId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_tag_context_post_realm_fkey",
		}).onDelete("restrict"),
		index("realm_tag_context_post_idx").on(table.contextPostId),
		index("realm_tag_context_tag_realm_idx").on(table.tagId, table.realmId),
	],
);

export const realmTagJudgment = pgTable(
	"realm_tag_judgment",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		...unitReferenceColumns("unit", "restrict"),
		tagId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		fitVote: integer(),
		spoilerLevel: smallint(),
		fitUpdatedAt: createTimestampMsColumn(),
		spoilerUpdatedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		...unitReferenceConstraints("realm_tag_judgment", "unit", table, false, table.unitId),
		primaryKey({
			columns: [table.realmId, table.unitId, table.tagId, table.profileId],
		}),
		foreignKey({
			columns: [table.realmId],
			foreignColumns: [realm.id],
			name: "realm_tag_judgment_realm_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.tagId],
			foreignColumns: [tag.id],
			name: "realm_tag_judgment_tag_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.realmId, table.tagId],
			foreignColumns: [realmTagContext.realmId, realmTagContext.tagId],
			name: "realm_tag_judgment_context_fkey",
		}).onDelete("restrict"),
		index("realm_tag_judgment_profile_route_idx").on(
			table.profileId,
			table.realmId,
			table.unitId,
			table.tagId,
		),
		index("realm_tag_judgment_realm_tag_unit_idx").on(table.realmId, table.tagId, table.unitId),
		index("realm_tag_judgment_tag_route_idx").on(
			table.tagId,
			table.realmId,
			table.unitId,
			table.profileId,
		),
		index("realm_tag_judgment_unit_merge_idx").on(
			table.unitId,
			table.realmId,
			table.tagId,
			table.profileId,
		),
		check("realm_tag_judgment_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check(
			"realm_tag_judgment_fit_vote_check",
			sql`${table.fitVote} is null or ${table.fitVote} in (-1, 1)`,
		),
		check(
			"realm_tag_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} is null or ${table.spoilerLevel} between 0 and 2`,
		),
		check(
			"realm_tag_judgment_sparse_check",
			sql`${table.fitVote} is not null or ${table.spoilerLevel} is not null`,
		),
		check(
			"realm_tag_judgment_fit_timestamp_check",
			sql`(${table.fitVote} is null) = (${table.fitUpdatedAt} is null)`,
		),
		check(
			"realm_tag_judgment_spoiler_timestamp_check",
			sql`(${table.spoilerLevel} is null) = (${table.spoilerUpdatedAt} is null)`,
		),
	],
);

/** Realm policy: a direct, permission-gated Tag relationship. */
export const realmUnitTag = pgTable(
	"realm_unit_tag",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition().default(sql`'a0'::text`).notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId, table.tagId] }),
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_tag_realm_unit_fkey",
		}).onDelete("cascade"),
		index("realm_unit_tag_tag_idx").on(table.realmId, table.tagId, table.unitId),
		index("realm_unit_tag_tag_route_idx").on(table.tagId, table.realmId, table.unitId),
		index("realm_unit_tag_unit_merge_idx").on(table.unitId, table.realmId, table.tagId),
		check("realm_unit_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		createFractionalIndexPositionByteLengthConstraint(
			"realm_unit_tag_position_byte_length_check",
			table.position,
		),
	],
);

/** An account-private, direct Tag relationship to a canonical target value. */
export const accountUnitTag = pgTable(
	"account_unit_tag",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		targetReferenceId: uuid()
			.notNull()
			.references(() => referenceValue.id, { onDelete: "restrict" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition().default(sql`'a0'::text`).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.targetReferenceId, table.tagId] }),
		index("account_unit_tag_unit_idx").on(table.targetReferenceId, table.authUserId),
		index("account_unit_tag_tag_idx").on(table.tagId),
		index("account_unit_tag_auth_tag_idx").on(table.authUserId, table.tagId, table.targetReferenceId),
		createFractionalIndexPositionByteLengthConstraint(
			"account_unit_tag_position_byte_length_check",
			table.position,
		),
	],
);
