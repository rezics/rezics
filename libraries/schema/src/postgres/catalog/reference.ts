import { sql } from "drizzle-orm";
import {
	boolean,
	bigint,
	check,
	index,
	integer,
	jsonb,
	numeric,
	primaryKey,
	smallint,
	text,
	time,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { catalogDefinitionRevision, referenceIdentity } from "./identity";
import { createCreatedAtColumn } from "../shared/columns";
import {
	catalogDateColumns,
	catalogDateConstraint,
	catalogSubtypeColumns,
	catalogSubtypeConstraints,
} from "./domain-columns";

const lifecycleColumns = () => ({
	...catalogDateColumns(),
	endYear: integer(),
	endMonth: smallint(),
	endDay: smallint(),
	endText: text(),
	ended: boolean(),
});

/** Named subjects used by governed classifications; provider taxonomy IDs are external bindings. */
export const referenceConcept = pgTable(
	"reference_concept",
	{
		...catalogSubtypeColumns("concept"),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		...catalogSubtypeConstraints("reference_concept", "reference", "concept", table),
		index("reference_concept_type_idx").on(table.typeRevisionId, table.id),
	],
);

/** An independently referenced network resource, distinct from a relation linking to it. */
export const referenceWebResource = pgTable(
	"reference_web_resource",
	{
		...catalogSubtypeColumns("web_resource"),
		url: text().notNull(),
	},
	(table) => [
		...catalogSubtypeConstraints("reference_web_resource", "reference", "web_resource", table),
		check(
			"reference_web_resource_url_check",
			sql`octet_length(${table.url}) between 1 and 8192 and ${table.url} ~ '^[A-Za-z][A-Za-z0-9+.-]*:'`,
		),
	],
);

export const referenceArea = pgTable(
	"reference_area",
	{
		...catalogSubtypeColumns("area"),
		...lifecycleColumns(),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		...catalogSubtypeConstraints("reference_area", "reference", "area", table),
		catalogDateConstraint("reference_area_begin_check", table),
		catalogDateConstraint("reference_area_end_check", {
			dateYear: table.endYear,
			dateMonth: table.endMonth,
			dateDay: table.endDay,
		}),
		index("reference_area_type_idx").on(table.typeRevisionId, table.id),
	],
);

export const referenceAreaCode = pgTable(
	"reference_area_code",
	{
		areaId: uuid()
			.notNull()
			.references(() => referenceArea.id, { onDelete: "restrict" }),
		namespace: text().notNull(),
		code: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.areaId, table.namespace, table.code] }),
		index("reference_area_code_lookup_idx").on(table.namespace, table.code, table.areaId),
		check(
			"reference_area_code_size_check",
			sql`octet_length(${table.namespace}) between 1 and 64 and octet_length(${table.code}) between 1 and 128`,
		),
	],
);

export const referencePlace = pgTable(
	"reference_place",
	{
		...catalogSubtypeColumns("place"),
		...lifecycleColumns(),
		areaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		address: text(),
		latitude: numeric(),
		longitude: numeric(),
	},
	(table) => [
		...catalogSubtypeConstraints("reference_place", "reference", "place", table),
		catalogDateConstraint("reference_place_begin_check", table),
		catalogDateConstraint("reference_place_end_check", {
			dateYear: table.endYear,
			dateMonth: table.endMonth,
			dateDay: table.endDay,
		}),
		index("reference_place_area_idx").on(table.areaId, table.id),
		index("reference_place_type_idx").on(table.typeRevisionId, table.id),
		check(
			"reference_place_coordinates_check",
			sql`(${table.latitude} is null or ${table.latitude} between -90 and 90) and (${table.longitude} is null or ${table.longitude} between -180 and 180) and ((${table.latitude} is null) = (${table.longitude} is null))`,
		),
	],
);

export const referenceInstrument = pgTable(
	"reference_instrument",
	{
		...catalogSubtypeColumns("instrument"),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		...catalogSubtypeConstraints("reference_instrument", "reference", "instrument", table),
		index("reference_instrument_type_idx").on(table.typeRevisionId, table.id),
	],
);

export const referenceEvent = pgTable(
	"reference_event",
	{
		...catalogSubtypeColumns("event"),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		placeId: uuid().references(() => referencePlace.id, { onDelete: "restrict" }),
		...catalogDateColumns(),
		endYear: integer(),
		endMonth: smallint(),
		endDay: smallint(),
		endText: text(),
		localTime: time(),
		cancelled: boolean(),
		ended: boolean(),
		setlist: text(),
	},
	(table) => [
		...catalogSubtypeConstraints("reference_event", "reference", "event", table),
		catalogDateConstraint("reference_event_date_check", table),
		catalogDateConstraint("reference_event_end_check", {
			dateYear: table.endYear,
			dateMonth: table.endMonth,
			dateDay: table.endDay,
		}),
		index("reference_event_place_idx").on(table.placeId, table.id),
		index("reference_event_type_idx").on(table.typeRevisionId, table.id),
	],
);

/** One bounded fixed-profile snapshot per accepted owner revision. */
export const referenceCatalogProfileRevision = pgTable(
	"reference_catalog_profile_revision",
	{
		ownerId: uuid()
			.notNull()
			.references(() => referenceIdentity.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		removed: boolean().notNull().default(false),
		snapshot: jsonb().$type<unknown>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.revision] }),
		check(
			"reference_catalog_profile_revision_number_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			"reference_catalog_profile_revision_snapshot_check",
			sql`jsonb_typeof(${table.snapshot}) = 'object' and octet_length(${table.snapshot}::text) <= 131072`,
		),
	],
);
