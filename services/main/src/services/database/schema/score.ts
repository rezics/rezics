import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { profile, unit } from "./core";
import { post } from "./post";
import { realm, realmUnit } from "./realm";

/**
 * Current Score state for a Profile, target Unit, and context Unit.
 *
 * The backend currently permits only Realm Units as Score contexts.
 * @todo Add immutable Score history and point-in-time Post rendering when required.
 */
export const score = pgTable(
	"score",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		contextUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("score_profile_unit_context_unit_key").on(
			table.profileId,
			table.unitId,
			table.contextUnitId,
		),
		index("score_unit_context_unit_value_idx").on(
			table.unitId,
			table.contextUnitId,
			table.value,
		),
		index("score_context_unit_idx").on(table.contextUnitId),
		check("score_value_check", sql`${table.value} between 1 and 10`),
	],
);

/** Ordered live Scores displayed by a Post. */
export const postScore = pgTable(
	"post_score",
	{
		postId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: "cascade" }),
		scoreId: uuid()
			.notNull()
			.references(() => score.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.postId, table.scoreId] }),
		unique("post_score_post_position_key").on(table.postId, table.position),
		index("post_score_score_idx").on(table.scoreId),
	],
);

/** Current Realm scoring-rules explanation. */
export const realmScoreContext = pgTable(
	"realm_score_context",
	{
		realmId: uuid()
			.primaryKey()
			.references(() => realm.id, { onDelete: "cascade" }),
		contextPostId: uuid()
			.notNull()
			.references(() => post.id, { onDelete: "restrict" }),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.realmId, table.contextPostId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_score_context_post_realm_fkey",
		}).onDelete("restrict"),
		index("realm_score_context_post_idx").on(table.contextPostId),
	],
);
