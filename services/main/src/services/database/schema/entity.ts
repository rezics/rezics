import { sql } from "drizzle-orm";
import { boolean, check, index, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { unit } from "./core";

export const entity = pgTable(
	"entity",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		verified: boolean().default(false).notNull(),
		avatar: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("entity_kind_idx").on(table.kind),
		check("entity_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
	],
);

/** Author, translator, publisher, and other contribution relationships. */
export const creditAttribution = pgTable(
	"credit_attribution",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		role: text().notNull(),
		position: text().default("V").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("credit_attribution_unit_entity_role_key").on(
			table.unitId,
			table.entityId,
			table.role,
		),
		index("credit_attribution_entity_role_idx").on(table.entityId, table.role),
		index("credit_attribution_unit_position_idx").on(table.unitId, table.position, table.id),
		check("credit_attribution_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check("credit_attribution_not_self_check", sql`${table.unitId} <> ${table.entityId}`),
	],
);

/** Character, protagonist, derivative, and other subject relationships. */
export const subjectAttribution = pgTable(
	"subject_attribution",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		subjectEntityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		role: text().notNull(),
		position: text().default("V").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("subject_attribution_unit_entity_role_key").on(
			table.unitId,
			table.subjectEntityId,
			table.role,
		),
		index("subject_attribution_entity_role_idx").on(table.subjectEntityId, table.role),
		index("subject_attribution_unit_position_idx").on(table.unitId, table.position, table.id),
		check("subject_attribution_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check(
			"subject_attribution_not_self_check",
			sql`${table.unitId} <> ${table.subjectEntityId}`,
		),
	],
);
