import { sql } from "drizzle-orm";
import { check, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { entity } from "./entity";
import { unit } from "./unit";

export const unitSourceLink = pgTable(
	"unit_source_link",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		sourceEntityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		url: text().notNull(),
		normalizedUrl: text().notNull(),
		normalizedUrlHash: text().notNull(),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_source_link_unit_source_hash_key").on(
			table.unitId,
			table.sourceEntityId,
			table.normalizedUrlHash,
		),
		index("unit_source_link_unit_position_idx").on(table.unitId, table.position, table.id),
		index("unit_source_link_source_entity_idx").on(table.sourceEntityId),
		check(
			"unit_source_link_url_check",
			sql`${table.url} ~ '^https?://' and ${table.normalizedUrl} ~ '^https?://'`,
		),
		check("unit_source_link_hash_check", sql`${table.normalizedUrlHash} ~ '^[0-9a-f]{64}$'`),
	],
);
