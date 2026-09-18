import { sql } from "drizzle-orm";
import {
	boolean,
	bigint,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	primaryKey,
	smallint,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { catalogDateConstraint } from "./domain-columns";
import { catalogDefinitionRevision, entityIdentity } from "./identity";
import { referenceArea } from "./reference";
import { createCreatedAtColumn } from "../shared/columns";

/** Catalog subject data never grants login, delegation or publishing authority. */
export const entityCatalogProfile = pgTable(
	"entity_catalog_profile",
	{
		id: uuid().primaryKey(),
		identityShape: text().notNull(),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		genderRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		areaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		beginAreaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		endAreaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		beginYear: integer(),
		beginMonth: smallint(),
		beginDay: smallint(),
		beginText: text(),
		endYear: integer(),
		endMonth: smallint(),
		endDay: smallint(),
		endText: text(),
		ended: boolean(),
	},
	(table) => [
		foreignKey({
			name: "entity_catalog_profile_identity_fk",
			columns: [table.id, table.identityShape],
			foreignColumns: [entityIdentity.id, entityIdentity.shape],
		}).onDelete("restrict"),
		check(
			"entity_catalog_profile_shape_check",
			sql`${table.identityShape} in ('person', 'organization', 'character', 'label', 'collective', 'unresolved', 'service_actor')`,
		),
		check(
			"entity_catalog_profile_gender_shape_check",
			sql`${table.genderRevisionId} is null or ${table.identityShape} in ('person','character','unresolved')`,
		),
		catalogDateConstraint("entity_catalog_profile_begin_check", {
			dateYear: table.beginYear,
			dateMonth: table.beginMonth,
			dateDay: table.beginDay,
		}),
		catalogDateConstraint("entity_catalog_profile_end_check", {
			dateYear: table.endYear,
			dateMonth: table.endMonth,
			dateDay: table.endDay,
		}),
		index("entity_catalog_profile_type_idx").on(table.typeRevisionId, table.id),
		index("entity_catalog_profile_gender_idx").on(table.genderRevisionId, table.id),
		index("entity_catalog_profile_area_idx").on(table.areaId, table.id),
		index("entity_catalog_profile_begin_area_idx").on(table.beginAreaId, table.id),
		index("entity_catalog_profile_end_area_idx").on(table.endAreaId, table.id),
	],
);

/** Bounded fixed profile snapshots; names, aliases and relations retain their own histories. */
export const entityCatalogProfileRevision = pgTable(
	"entity_catalog_profile_revision",
	{
		ownerId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		removed: boolean().notNull().default(false),
		snapshot: jsonb().$type<unknown>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.revision] }),
		check(
			"entity_catalog_profile_revision_number_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			"entity_catalog_profile_revision_snapshot_check",
			sql`jsonb_typeof(${table.snapshot}) = 'object' and octet_length(${table.snapshot}::text) <= 32768`,
		),
	],
);
