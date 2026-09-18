import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	integer,
	numeric,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import {
	catalogDateColumns,
	catalogDateConstraint,
	catalogSubtypeColumns,
	catalogSubtypeConstraints,
} from "../catalog/domain-columns";
import { catalogDefinitionRevision, programIdentity } from "../catalog/identity";
import {
	createFractionalIndexPositionByteLengthConstraint,
	fractionalIndexPosition,
} from "../shared/columns";

export const programWork = pgTable(
	"program_work",
	{
		...catalogSubtypeColumns("program"),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		declaredMainEpisodeCount: bigint({ mode: "number" }),
		declaredTotalEpisodeCount: bigint({ mode: "number" }),
	},
	(table) => [
		...catalogSubtypeConstraints("program_work", "program", "program", table),
		index("program_work_type_idx").on(table.typeRevisionId, table.id),
		check(
			"program_work_counts_check",
			sql`(${table.declaredMainEpisodeCount} is null or ${table.declaredMainEpisodeCount} between 0 and 9007199254740991) and (${table.declaredTotalEpisodeCount} is null or ${table.declaredTotalEpisodeCount} between 0 and 9007199254740991)`,
		),
	],
);

export const programSeason = pgTable(
	"program_season",
	{
		...catalogSubtypeColumns("season"),
		programId: uuid().references(() => programWork.id, { onDelete: "restrict" }),
		number: text(),
	},
	(table) => [
		...catalogSubtypeConstraints("program_season", "program", "season", table),
		unique("program_season_program_key").on(table.id, table.programId),
		index("program_season_program_idx").on(table.programId, table.id),
	],
);

export const programVersion = pgTable(
	"program_version",
	{
		...catalogSubtypeColumns("program_version"),
		programId: uuid().references(() => programWork.id, { onDelete: "restrict" }),
		versionTypeRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		lengthMilliseconds: bigint({ mode: "number" }),
	},
	(table) => [
		...catalogSubtypeConstraints("program_version", "program", "program_version", table),
		index("program_version_program_idx").on(table.programId, table.id),
		index("program_version_type_idx").on(table.versionTypeRevisionId, table.id),
		check(
			"program_version_length_check",
			sql`${table.lengthMilliseconds} is null or ${table.lengthMilliseconds} between 0 and 9007199254740991`,
		),
	],
);

export const programEpisode = pgTable(
	"program_episode",
	{
		...catalogSubtypeColumns("episode"),
		programId: uuid().references(() => programWork.id, { onDelete: "restrict" }),
		seasonId: uuid().references(() => programSeason.id, { onDelete: "restrict" }),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		sortNumber: numeric(),
		episodeNumber: numeric(),
		discNumber: integer(),
		durationText: text(),
		lengthMilliseconds: bigint({ mode: "number" }),
		...catalogDateColumns(),
	},
	(table) => [
		...catalogSubtypeConstraints("program_episode", "program", "episode", table),
		foreignKey({
			name: "program_episode_season_program_fk",
			columns: [table.seasonId, table.programId],
			foreignColumns: [programSeason.id, programSeason.programId],
		}).onDelete("restrict"),
		index("program_episode_program_idx").on(table.programId, table.sortNumber, table.id),
		index("program_episode_season_idx").on(table.seasonId, table.programId, table.id),
		index("program_episode_type_idx").on(table.typeRevisionId, table.id),
		check(
			"program_episode_season_owner_check",
			sql`${table.seasonId} is null or ${table.programId} is not null`,
		),
		check(
			"program_episode_disc_check",
			sql`${table.discNumber} is null or ${table.discNumber} >= 0`,
		),
		check(
			"program_episode_numbers_check",
			sql`(${table.sortNumber} is null or ${table.sortNumber}::text not in ('NaN', 'Infinity', '-Infinity')) and (${table.episodeNumber} is null or ${table.episodeNumber}::text not in ('NaN', 'Infinity', '-Infinity'))`,
		),
		check(
			"program_episode_length_check",
			sql`${table.lengthMilliseconds} is null or ${table.lengthMilliseconds} between 0 and 9007199254740991`,
		),
		catalogDateConstraint("program_episode_date_check", table),
	],
);

export const programEpisodeOccurrence = pgTable(
	"program_episode_occurrence",
	{
		ownerId: uuid().notNull(),
		ownerShape: text().notNull(),
		id: uuid().default(sql`uuidv7()`).notNull(),
		episodeId: uuid()
			.notNull()
			.references(() => programEpisode.id, { onDelete: "restrict" }),
		position: fractionalIndexPosition().notNull(),
		sourceNumber: text(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.id] }),
		foreignKey({
			name: "program_occurrence_owner_shape_fk",
			columns: [table.ownerId, table.ownerShape],
			foreignColumns: [programIdentity.id, programIdentity.shape],
		}).onDelete("restrict"),
		check(
			"program_occurrence_owner_shape_check",
			sql`${table.ownerShape} in ('program', 'season', 'program_version')`,
		),
		index("program_occurrence_episode_idx").on(table.episodeId, table.ownerId, table.id),
		index("program_occurrence_position_idx").on(table.ownerId, table.position, table.id),
		createFractionalIndexPositionByteLengthConstraint(
			"program_occurrence_position_check",
			table.position,
		),
	],
);
