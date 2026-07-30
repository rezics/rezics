import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

export const StudioWorkRelationValues = ["created", "contributed"] as const;
export type StudioWorkRelation = (typeof StudioWorkRelationValues)[number];

export const StudioWorkSourceValues = [
	"unit_status",
	"unit_revision",
	"content_structure_revision",
	"collection_structure_revision",
	"dock_revision",
] as const;
export type StudioWorkSource = (typeof StudioWorkSourceValues)[number];

/**
 * Rebuildable evidence that a Profile created or contributed to a Studio resource.
 *
 * Authorization scopes are nullable because historical Unit revisions do not
 * always preserve the exact command scope. Null tells permission presentation
 * to discover a currently authorized scope; it never means root access.
 */
export const studioWorkRelation = pgTable(
	"studio_work_relation",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		resourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		authorizationUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		authorizationScope: text().array(),
		authorizationScopeKey: text().notNull(),
		relation: text().$type<StudioWorkRelation>().notNull(),
		source: text().$type<StudioWorkSource>().notNull(),
		firstAt: createTimestampMsColumn().notNull(),
		lastAt: createTimestampMsColumn().notNull(),
		activityCount: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("studio_work_relation_identity_key").on(
			table.profileId,
			table.resourceUnitId,
			table.authorizationUnitId,
			table.authorizationScopeKey,
			table.relation,
			table.source,
		),
		index("studio_work_relation_profile_resource_idx").on(
			table.profileId,
			table.resourceUnitId,
		),
		index("studio_work_relation_profile_relation_last_idx").on(
			table.profileId,
			table.relation,
			table.lastAt.desc(),
			table.resourceUnitId.desc(),
		),
		check(
			"studio_work_relation_scope_key_check",
			sql`(
				${table.authorizationScope} is null and ${table.authorizationScopeKey} = '*'
			) or (
				${table.authorizationScope} is not null and
				${table.authorizationScopeKey} = array_to_string(${table.authorizationScope}, '/')
			)`,
		),
		check(
			"studio_work_relation_relation_check",
			sql`${table.relation} in ('created', 'contributed')`,
		),
		check(
			"studio_work_relation_source_check",
			sql`${table.source} in (
				'unit_status',
				'unit_revision',
				'content_structure_revision',
				'collection_structure_revision',
				'dock_revision'
			)`,
		),
		check(
			"studio_work_relation_relation_source_check",
			sql`(
				${table.relation} = 'created' and ${table.source} = 'unit_status'
			) or (
				${table.relation} = 'contributed' and
				${table.source} in (
					'unit_revision',
					'content_structure_revision',
					'collection_structure_revision',
					'dock_revision'
				)
			)`,
		),
		check("studio_work_relation_activity_count_check", sql`${table.activityCount} > 0`),
		check("studio_work_relation_time_check", sql`${table.firstAt} <= ${table.lastAt}`),
	],
);

/** The latest explicit visit to a resource through a Studio management surface. */
export const studioResourceVisit = pgTable(
	"studio_resource_visit",
	{
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		resourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		lastVisitedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.resourceUnitId] }),
		index("studio_resource_visit_profile_recent_idx").on(
			table.profileId,
			table.lastVisitedAt.desc(),
			table.resourceUnitId.desc(),
		),
	],
);
