import { sql } from "drizzle-orm";
import { check, date, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createUpdatedAtColumn,
	fractionalIndexPosition,
} from "./columns";
import { unit } from "./unit";

export const series = pgTable(
	"series",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("series_kind_idx").on(table.kind),
		check("series_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
	],
);

export const seriesRelease = pgTable(
	"series_release",
	{
		seriesId: uuid()
			.notNull()
			.references(() => series.id, { onDelete: "cascade" }),
		releaseUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		position: fractionalIndexPosition().notNull(),
		releasedOn: date(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.seriesId, table.releaseUnitId] }),
		index("series_release_position_idx").on(table.seriesId, table.position, table.releaseUnitId),
		index("series_release_unit_idx").on(table.releaseUnitId),
		check("series_release_not_self_check", sql`${table.seriesId} <> ${table.releaseUnitId}`),
		createFractionalIndexPositionByteLengthConstraint(
			"series_release_position_byte_length_check",
			table.position,
		),
	],
);
