import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, primaryKey, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn, fractionalIndexPosition } from "./columns";
import { profile, unit } from "./core";
import { post } from "./post";
import { realm, realmUnit } from "./realm";

/** Marker table proving that a Unit is a Tag. */
export const tag = pgTable("tag", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

/** Global, community-voted Unit-to-Tag relationship. */
export const unitTag = pgTable(
	"unit_tag",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
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
			.references(() => tag.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.tagId, table.profileId] }),
		foreignKey({
			columns: [table.unitId, table.tagId],
			foreignColumns: [unitTag.unitId, unitTag.tagId],
			name: "unit_tag_vote_unit_tag_fkey",
		}).onDelete("cascade"),
		index("unit_tag_vote_tag_idx").on(table.tagId),
		index("unit_tag_vote_profile_idx").on(table.profileId),
		check("unit_tag_vote_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
		check("unit_tag_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

/**
 * Realm-scoped voting context. The context is a Post and must itself be
 * mounted in the Realm; it carries explanations and discussion for the vote.
 */
export const realmTagContext = pgTable(
	"realm_tag_context",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		contextPostId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: "restrict" }),
		createdByProfileId: uuid().references(() => profile.id, {
			onDelete: "set null",
		}),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.unitId, table.tagId] }),
		foreignKey({
			columns: [table.realmId, table.contextPostId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_tag_context_post_realm_fkey",
		}).onDelete("restrict"),
		index("realm_tag_context_tag_idx").on(table.realmId, table.tagId),
		index("realm_tag_context_post_idx").on(table.contextPostId),
		check("realm_tag_context_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
	],
);

export const realmTagVote = pgTable(
	"realm_tag_vote",
	{
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({
			columns: [table.realmId, table.unitId, table.tagId, table.profileId],
		}),
		foreignKey({
			columns: [table.realmId, table.unitId, table.tagId],
			foreignColumns: [
				realmTagContext.realmId,
				realmTagContext.unitId,
				realmTagContext.tagId,
			],
			name: "realm_tag_vote_context_fkey",
		}).onDelete("cascade"),
		index("realm_tag_vote_profile_idx").on(table.profileId),
		check("realm_tag_vote_value_check", sql`${table.value} in (-1, 1)`),
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
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
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
		index("realm_unit_tag_tag_idx").on(table.realmId, table.tagId),
		check("realm_unit_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
	],
);

/** A Profile's private, direct Tag relationship. */
export const profileUnitTag = pgTable(
	"profile_unit_tag",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId, table.tagId] }),
		index("profile_unit_tag_unit_idx").on(table.unitId, table.profileId),
		index("profile_unit_tag_tag_idx").on(table.tagId),
		check("profile_unit_tag_not_self_check", sql`${table.unitId} <> ${table.tagId}`),
	],
);
