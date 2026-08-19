import { sql } from "drizzle-orm";
import { boolean, check, date, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { unitExternalLink } from "./unit";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { unit } from "./unit";
import { entity } from "./entity";

export const software = pgTable("software", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	/** Describes that REZICS should expose metadata, but not hosted work content. */
	metadataOnly: boolean("metadata_only").default(true).notNull(),
	releaseDate: date(),
	versionLabel: text(),
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
		sourceExternalLinkId: uuid().references(() => unitExternalLink.id, {
			onDelete: "set null",
		}),
		hardware: createJsonObjectColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("software_requirement_identity_key")
			.on(table.softwareId, table.platformEntityId, table.tier)
			.nullsNotDistinct(),
		index("software_requirement_platform_idx").on(table.platformEntityId),
		index("software_requirement_source_external_link_idx").on(table.sourceExternalLinkId),
		check("software_requirement_tier_not_blank", sql`btrim(${table.tier}) <> ''`),
		createJsonObjectConstraint("software_requirement_hardware_json_object_check", table.hardware),
	],
);
