import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	smallint,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogDateConstraint } from "./catalog-domain-columns";
import { catalogDefinitionRevision, entityIdentity } from "./catalog-identity";
import { referenceArea } from "./catalog-reference";

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
			sql`${table.identityShape} in ('person', 'organization', 'character', 'label', 'collective', 'unresolved')`,
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
