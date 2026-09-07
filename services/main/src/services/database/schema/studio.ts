import { sql } from "drizzle-orm";
import { check, index, primaryKey, uuid } from "drizzle-orm/pg-core";

import { realmAccessSubjectRelation } from "./access";
import { pgTable } from "./base";
import { users } from "./auth";
import { createTimestampMsColumn, createUpdatedAtColumn } from "./columns";
import { realm } from "./realm";
import { unit } from "./unit";

/**
 * Rebuildable access-owned candidate index for a Profile's explicit editor assignments.
 *
 * This is not an authorization cache. Readers must still validate the current
 * ownership/grants, restrictions, expiry, and Unit readability. The row only
 * makes "list my editable Units" an ordered, Profile-selective operation.
 */
export const studioAuthEditorCandidate = pgTable(
	"studio_auth_editor_candidate",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		ownerSince: createTimestampMsColumn(),
		directGrantSince: createTimestampMsColumn(),
		directGrantLastAt: createTimestampMsColumn(),
		/** Latest source assignment; the keyset ordering column. */
		relevantAt: createTimestampMsColumn().notNull(),
		/** Null when ownership or a non-expiring direct grant keeps the candidate live. */
		validUntil: createTimestampMsColumn(),
		projectionUpdatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.unitId] }),
		index("studio_auth_editor_candidate_auth_recent_idx").on(
			table.authUserId,
			table.relevantAt.desc(),
			table.unitId.desc(),
		),
		index("studio_auth_editor_candidate_unit_idx").on(table.unitId, table.authUserId),
		index("studio_auth_editor_candidate_expiry_idx")
			.on(table.validUntil, table.authUserId, table.unitId)
			.where(sql`${table.validUntil} is not null`),
		check(
			"studio_auth_editor_candidate_source_check",
			sql`${table.ownerSince} is not null or ${table.directGrantSince} is not null`,
		),
		check(
			"studio_auth_editor_candidate_relevant_at_check",
			sql`${table.relevantAt} = greatest(${table.ownerSince}, ${table.directGrantLastAt})`,
		),
		check(
			"studio_auth_editor_candidate_direct_grant_time_check",
			sql`(
				${table.directGrantSince} is null
				and ${table.directGrantLastAt} is null
			) or (
				${table.directGrantSince} is not null
				and ${table.directGrantLastAt} is not null
				and ${table.directGrantSince} <= ${table.directGrantLastAt}
			)`,
		),
		check(
			"studio_auth_editor_candidate_validity_check",
			sql`${table.validUntil} is null or ${table.directGrantSince} is not null`,
		),
	],
);

/**
 * Rebuildable access-owned candidate index for Realm-subject editor grants.
 *
 * Realm membership is deliberately not fanned out into Profile rows. Listing
 * joins the current subject set and validates the exact Realm grant live.
 */
export const studioRealmEditorCandidate = pgTable(
	"studio_realm_editor_candidate",
	{
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "cascade" }),
		realmRelation: realmAccessSubjectRelation().notNull(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		grantSince: createTimestampMsColumn().notNull(),
		/** Latest matching grant assignment; the keyset ordering column. */
		relevantAt: createTimestampMsColumn().notNull(),
		/** Null when at least one matching Realm grant does not expire. */
		validUntil: createTimestampMsColumn(),
		projectionUpdatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.realmId, table.realmRelation, table.unitId] }),
		index("studio_realm_editor_candidate_subject_recent_idx").on(
			table.realmId,
			table.realmRelation,
			table.relevantAt.desc(),
			table.unitId.desc(),
		),
		index("studio_realm_editor_candidate_unit_idx").on(
			table.unitId,
			table.realmId,
			table.realmRelation,
		),
		index("studio_realm_editor_candidate_expiry_idx")
			.on(table.validUntil, table.realmId, table.realmRelation, table.unitId)
			.where(sql`${table.validUntil} is not null`),
		check(
			"studio_realm_editor_candidate_time_check",
			sql`${table.grantSince} <= ${table.relevantAt}`,
		),
	],
);

/** The latest explicit visit to a resource through a Studio management surface. */
export const studioResourceVisit = pgTable(
	"studio_resource_visit",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		resourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		lastVisitedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.resourceUnitId] }),
		index("studio_resource_visit_auth_recent_idx").on(
			table.authUserId,
			table.lastVisitedAt.desc(),
			table.resourceUnitId.desc(),
		),
		index("studio_resource_visit_resource_merge_idx").on(table.resourceUnitId, table.authUserId),
	],
);
