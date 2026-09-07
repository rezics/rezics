import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import {
	CatalogOwnerValues,
	type CatalogOwner,
	CatalogValueKindValues,
	type CatalogValueKind,
} from "../../catalog/contracts";
import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { users } from "./auth";
import {
	ContentRatingValues,
	ModerationStatusValues,
	ResourceVisibilityValues,
	UnitStatusValues,
	type ContentRating,
	type ResourceVisibility,
} from "./contract-values";

/** Rebuildable routing index: no domain FK may use this as an identity parent. */
export const catalogUnitLocator = pgTable(
	"catalog_unit_locator",
	{
		id: uuid().primaryKey(),
		owner: text().$type<CatalogOwner>().notNull(),
		generation: integer().notNull(),
	},
	(table) => [
		check("catalog_unit_locator_owner_check", inArray(table.owner, CatalogOwnerValues)),
		check("catalog_unit_locator_generation_check", sql`${table.generation} > 0`),
	],
);

/** Exactly one control row fences identity admission while routing is rebuilt. */
export const catalogRoutingControl = pgTable(
	"catalog_routing_control",
	{
		singleton: boolean().primaryKey().default(true),
		ready: boolean().default(false).notNull(),
	},
	(table) => [check("catalog_routing_control_singleton_check", sql`${table.singleton}`)],
);

export const catalogDefinition = pgTable(
	"catalog_definition",
	{
		id: createUuidv7PrimaryKey(),
		namespace: text().notNull(),
		key: text().notNull(),
		kind: text().$type<"class" | "property" | "predicate" | "role" | "vocabulary">().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("catalog_definition_namespace_key").on(table.namespace, table.key),
		check(
			"catalog_definition_namespace_check",
			sql`${table.namespace} ~ '^[a-z][a-z0-9_.-]{0,95}$'`,
		),
		check("catalog_definition_key_check", sql`length(${table.key}) between 1 and 160`),
		check(
			"catalog_definition_kind_check",
			inArray(table.kind, ["class", "property", "predicate", "role", "vocabulary"]),
		),
	],
);

/** Append-only meaning; an existing relation keeps its precise definition revision. */
export const catalogDefinitionRevision = pgTable(
	"catalog_definition_revision",
	{
		id: createUuidv7PrimaryKey(),
		definitionId: uuid()
			.notNull()
			.references(() => catalogDefinition.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		valueKind: text().$type<CatalogValueKind>(),
		constraints: jsonb()
			.$type<import("../../catalog/definition-contracts").CatalogDefinitionConstraints>()
			.notNull()
			.default({ nullable: false, integer: false }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("catalog_definition_revision_version_key").on(table.definitionId, table.version),
		check(
			"catalog_definition_revision_constraints_check",
			sql`jsonb_typeof(${table.constraints}) = 'object' and octet_length(${table.constraints}::text) <= 262144`,
		),
		check(
			"catalog_definition_revision_version_check",
			sql`${table.version} between 1 and 9007199254740991`,
		),
		check(
			"catalog_definition_revision_value_kind_check",
			inArray(table.valueKind, CatalogValueKindValues),
		),
	],
);

function createOwnerIdentity<const Owner extends CatalogOwner>(owner: Owner) {
	return pgTable(
		`${owner}_identity`,
		{
			id: createUuidv7PrimaryKey(),
			shape: text().notNull(),
			status: text().$type<(typeof UnitStatusValues)[number]>().default("draft").notNull(),
			visibility: text().$type<ResourceVisibility>().default("private").notNull(),
			contentRating: text().$type<ContentRating>().default("general").notNull(),
			moderationStatus: text()
				.$type<(typeof ModerationStatusValues)[number]>()
				.default("approved")
				.notNull(),
			createdByAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
			revision: bigint({ mode: "number" }).default(1).notNull(),
			routingGeneration: integer().default(1).notNull(),
			deletedAt: createTimestampMsColumn(),
			createdAt: createCreatedAtColumn(),
			updatedAt: createUpdatedAtColumn(),
		},
		(table) => [
			unique(`${owner}_identity_shape_key`).on(table.id, table.shape),
			index(`${owner}_identity_creator_idx`).on(table.createdByAuthUserId, table.id),
			index(`${owner}_identity_shape_idx`).on(table.shape, table.id),
			check(`${owner}_identity_shape_check`, sql`${table.shape} ~ '^[a-z][a-z0-9_.-]{0,95}$'`),
			check(`${owner}_identity_status_check`, inArray(table.status, UnitStatusValues)),
			check(
				`${owner}_identity_visibility_check`,
				inArray(table.visibility, ResourceVisibilityValues),
			),
			check(`${owner}_identity_rating_check`, inArray(table.contentRating, ContentRatingValues)),
			check(
				`${owner}_identity_moderation_check`,
				inArray(table.moderationStatus, ModerationStatusValues),
			),
			check(
				`${owner}_identity_revision_check`,
				sql`${table.revision} between 1 and 9007199254740991 and ${table.routingGeneration} > 0`,
			),
		],
	);
}

export const publishingIdentity = createOwnerIdentity("publishing");
export const musicIdentity = createOwnerIdentity("music");
export const programIdentity = createOwnerIdentity("program");
export const softwareIdentity = createOwnerIdentity("software");
export const entityIdentity = createOwnerIdentity("entity");
export const groupingIdentity = createOwnerIdentity("grouping");
export const referenceIdentity = createOwnerIdentity("reference");
export const distributionIdentity = createOwnerIdentity("distribution");

export const CatalogIdentityTables = {
	publishing: publishingIdentity,
	music: musicIdentity,
	program: programIdentity,
	software: softwareIdentity,
	entity: entityIdentity,
	grouping: groupingIdentity,
	reference: referenceIdentity,
	distribution: distributionIdentity,
} as const;
