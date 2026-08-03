import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { PostKindValues, toEnumValues } from "./contract-values";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./unit";

export const postKind = pgEnum("post_kind", toEnumValues(PostKindValues));

// ```progress
// id: posts.issue-workflow
// status: open
// goal: Provide a searchable Issue workflow that can target any readable Unit.
// depends:
//   - posts.targeting-kind-policy
// accept:
//   - Issue is an explicit supported Post kind or an approved equivalent with one documented target and authorization contract.
//   - An Issue targets any readable Unit and exposes an open, resolved, or archived lifecycle without rewriting discussion history.
//   - Readers can search Issues for one target and search the complete Issue discussion including replies.
//   - Create, transition, reply, visibility, moderation, and target-lock behavior are enforced by the API.
// verify:
//   - Exercise Issue creation and every allowed and denied lifecycle transition.
//   - Search one target and all Issue replies, including restricted, deleted, and inaccessible records.
//   - Run the database, Posts, Search, API, and Issue-surface tests.
// ```
export const post = pgTable(
	"post",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		/**
		 * Generic typed target. Public posts and reviews that target an Entity pass the
		 * Entity subject-association policy; structural and governance posts use this
		 * column for containment or administrative context instead.
		 */
		subjectUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		kind: postKind().default("post").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
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
		check(
			"post_excerpt_subject_check",
			sql`${table.kind} <> 'excerpt'::post_kind or ${table.subjectUnitId} is not null`,
		),
	],
);

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
		check("post_reply_not_root_check", sql`${table.postId} <> ${table.rootPostId}`),
		check(
			"post_reply_not_self_parent_check",
			sql`${table.parentPostId} is null or ${table.parentPostId} <> ${table.postId}`,
		),
		check("post_reply_depth_check", sql`${table.depth} between 0 and 64`),
	],
);
