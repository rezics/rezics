import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	pgEnum,
	primaryKey,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	PollModeValues,
	PollOptionSourceKindValues,
	PollResultVisibilityValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	ordinalPosition,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";
import { realm } from "./realm";

export const pollMode = pgEnum("poll_mode", toEnumValues(PollModeValues));
export const pollOptionSourceKind = pgEnum(
	"poll_option_source_kind",
	toEnumValues(PollOptionSourceKindValues),
);
export const pollResultVisibility = pgEnum(
	"poll_result_visibility",
	toEnumValues(PollResultVisibilityValues),
);

export const poll = pgTable(
	"poll",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		mode: pollMode().default("single").notNull(),
		resultVisibility: pollResultVisibility().default("live").notNull(),
		anonymous: boolean().default(false).notNull(),
		closesAt: createTimestampMsColumn(),
		closedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		check(
			"poll_closes_at_check",
			sql`${table.closesAt} is null or ${table.closesAt} > ${table.createdAt}`,
		),
		check(
			"poll_closed_at_check",
			sql`${table.closedAt} is null or ${table.closedAt} >= ${table.createdAt}`,
		),
	],
);

export const pollOption = pgTable(
	"poll_option",
	{
		id: createUuidv7PrimaryKey(),
		pollId: uuid()
			.notNull()
			.references(() => poll.id, { onDelete: "cascade" }),
		sourceKind: pollOptionSourceKind().default("literal").notNull(),
		targetUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		position: ordinalPosition().notNull(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("poll_option_poll_id_key").on(table.pollId, table.id),
		index("poll_option_poll_position_idx")
			.on(table.pollId, table.position, table.id)
			.where(sql`${table.deletedAt} is null`),
		index("poll_option_target_unit_idx").on(table.targetUnitId),
		check(
			"poll_option_source_check",
			sql`(${table.sourceKind} = 'literal'::poll_option_source_kind and ${table.targetUnitId} is null) or (${table.sourceKind} = 'unit'::poll_option_source_kind and ${table.targetUnitId} is not null)`,
		),
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
