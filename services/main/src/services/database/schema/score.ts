import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { DefaultResourceVisibility } from "./contract-values";
import { profile, resourceVisibility, unit } from "./core";
import { post } from "./post";
import { realm, realmUnit } from "./realm";

/**
 * Current Score state for a Profile, target Unit, and Realm.
 *
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
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		visibility: resourceVisibility().default(DefaultResourceVisibility).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("score_profile_unit_realm_key").on(table.profileId, table.unitId, table.realmId),
		index("score_unit_realm_value_idx").on(table.unitId, table.realmId, table.value),
		index("score_realm_idx").on(table.realmId),
		index("score_public_profile_updated_at_idx")
			.on(table.profileId, table.updatedAt.desc(), table.id.desc())
			.where(sql`${table.visibility} = 'public'`),
		check("score_value_check", sql`${table.value} between 1 and 10`),
	],
);

/**
 * Ordered live Scores displayed by a Post.
 *
 * @remarks
 * This relation intentionally renders the current mutable Score. Editing,
 * deleting, or restricting the Score may change or remove the value displayed
 * by the Post. Introduce immutable revisions only if historical point-in-time
 * rendering becomes a product guarantee.
 */
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
