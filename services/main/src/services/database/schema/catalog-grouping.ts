import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	jsonb,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	fractionalIndexPosition,
} from "./columns";
import { catalogDefinitionRevision, groupingIdentity } from "./catalog-identity";
import { groupingCatalogRelation } from "./catalog-facts";

/** Universe, franchise, series and continuity are governed class definitions. */
export const groupingClassAssignment = pgTable(
	"grouping_class_assignment",
	{
		groupingId: uuid()
			.notNull()
			.references(() => groupingIdentity.id, { onDelete: "restrict" }),
		classRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.groupingId, table.classRevisionId] }),
		index("grouping_class_reverse_idx").on(table.classRevisionId, table.groupingId),
	],
);

/** Each grouping can have independent publication, chronology and source orders. */
export const groupingOrderProfile = pgTable(
	"grouping_order_profile",
	{
		id: uuid().default(sql`uuidv7()`).notNull(),
		ownerId: uuid()
			.notNull()
			.references(() => groupingIdentity.id, { onDelete: "restrict" }),
		key: text().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ name: "grouping_order_profile_owner_id_key", columns: [table.ownerId, table.id] }),
		unique("grouping_order_profile_owner_key").on(table.ownerId, table.key),
		check("grouping_order_profile_key_check", sql`octet_length(${table.key}) between 1 and 160`),
	],
);

export const groupingOrderEntry = pgTable(
	"grouping_order_entry",
	{
		ownerId: uuid().notNull(),
		profileId: uuid().notNull(),
		relationId: uuid().notNull(),
		position: fractionalIndexPosition().notNull(),
		sourcePosition: text(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.profileId, table.relationId] }),
		foreignKey({
			name: "grouping_order_entry_profile_owner_fk",
			columns: [table.ownerId, table.profileId],
			foreignColumns: [groupingOrderProfile.ownerId, groupingOrderProfile.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_order_entry_relation_owner_fk",
			columns: [table.ownerId, table.relationId],
			foreignColumns: [groupingCatalogRelation.ownerId, groupingCatalogRelation.id],
		}).onDelete("restrict"),
		index("grouping_order_entry_page_idx").on(
			table.ownerId,
			table.profileId,
			table.position,
			table.relationId,
		),
		index("grouping_order_entry_relation_idx").on(table.ownerId, table.relationId),
		createFractionalIndexPositionByteLengthConstraint(
			"grouping_order_entry_position_check",
			table.position,
		),
		check(
			"grouping_order_entry_source_position_check",
			sql`${table.sourcePosition} is null or octet_length(${table.sourcePosition}) <= 4096`,
		),
	],
);

/** Local command snapshots never copy the grouping's entire membership or ordering graph. */
export const groupingCommandRevision = pgTable(
	"grouping_command_revision",
	{
		ownerId: uuid()
			.notNull()
			.references(() => groupingIdentity.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		snapshot: jsonb().$type<unknown>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.revision] }),
		check(
			"grouping_command_revision_number_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			"grouping_command_revision_snapshot_check",
			sql`jsonb_typeof(${table.snapshot}) = 'object' and octet_length(${table.snapshot}::text) <= 32768`,
		),
	],
);
