import { sql } from "drizzle-orm";
import { boolean, check, date, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { unitLink } from "./catalog";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { unit } from "./core";
import { entity } from "./entity";

export const software = pgTable("software", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	releaseDate: date(),
	versionLabel: text(),
	licensed: boolean().default(false).notNull(),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

/**
 * Existing unit_link references are preserved here. Entity Source remains
 * intentionally outside this refactor until its product model is agreed.
 */
export const softwareRequirement = pgTable(
	"software_requirement",
	{
		id: createUuidv7PrimaryKey(),
		softwareId: uuid()
			.notNull()
			.references(() => software.id, { onDelete: "cascade" }),
		platformEntityId: uuid().references(() => entity.id, {
			onDelete: "set null",
		}),
		tier: text().notNull(),
		language: text(),
		sourceLinkId: uuid().references(() => unitLink.id, {
			onDelete: "set null",
		}),
		hardware: createJsonObjectColumn().notNull(),
		rawText: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("software_requirement_identity_key")
			.on(table.softwareId, table.platformEntityId, table.tier, table.language)
			.nullsNotDistinct(),
		index("software_requirement_platform_idx").on(table.platformEntityId),
		index("software_requirement_source_link_idx").on(table.sourceLinkId),
		check("software_requirement_tier_not_blank", sql`btrim(${table.tier}) <> ''`),
		createJsonObjectConstraint(
			"software_requirement_hardware_json_object_check",
			table.hardware,
		),
	],
);
