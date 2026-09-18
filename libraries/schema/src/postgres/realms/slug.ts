import { unitReferenceColumns, unitReferenceConstraints } from "../shared/unit-reference-columns";
import { inArray, sql } from "drizzle-orm";
import { check, index, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "../shared/base";
import {
	createCreatedAtColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "../shared/columns";
import { SlugAddressKindValues, type SlugAddressKind } from "../shared/contract-values";
import { TopLevelSlugNamespaceIds, type TopLevelSlugNamespace } from "@rezics/slug";

/** Five immutable routing namespaces are control data, not content identities. */
export const slugNamespace = pgTable(
	"slug_namespace",
	{
		id: uuid().primaryKey(),
		name: text().$type<TopLevelSlugNamespace>().notNull().unique(),
	},
	(table) => [
		check(
			"slug_namespace_registered_check",
			sql.join(
				Object.entries(TopLevelSlugNamespaceIds).map(
					([name, id]) => sql`(${table.id}=${id}::uuid and ${table.name}=${name})`,
				),
				sql` or `,
			),
		),
	],
);

/**
 * Optional address entries for ID-addressed Units.
 *
 * @remarks
 * Unit creation never creates an address entry. Canonical and Redirect entries
 * share one scoped label namespace so the database can reject every collision.
 * A canonical target has at most one entry, while any number of Redirect entries
 * may preserve its former addresses. A null scope is the virtual address root.
 *
 * The target-wide canonical uniqueness intentionally cannot represent a
 * different Post slug in each Zone. If multi-Zone Posts later need scoped
 * slugs, extend this model and its lookup contract together; the globally
 * unique Post ID remains the stored identity.
 *
 * @todo
 * Automate Redirect retention and quarantine. Until that policy is finalized,
 * release remains an explicit, audited platform action.
 */
export const unitSlugAddress = pgTable(
	"unit_slug_address",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<SlugAddressKind>().notNull(),
		scopeUnitId: uuid("scope_unit_id"),
		scopeNamespaceId: uuid().references(() => slugNamespace.id, { onDelete: "restrict" }),
		slug: text().notNull(),
		targetUnitId: uuid("target_unit_id").notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("scopeUnit", "restrict"),
		...unitReferenceColumns("targetUnit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_slug_address", "scopeUnit", table, true, table.scopeUnitId),
		...unitReferenceConstraints(
			"unit_slug_address",
			"targetUnit",
			table,
			false,
			table.targetUnitId,
		),

		check(
			"unit_slug_address_scope_check",
			sql`num_nonnulls(${table.scopeNamespaceId},${table.scopeUnitId})=1`,
		),
		unique("unit_slug_address_scope_slug_key")
			.on(table.scopeNamespaceId, table.scopeUnitId, table.slug)
			.nullsNotDistinct(),
		index("unit_slug_address_namespace_idx")
			.on(table.scopeNamespaceId)
			.where(sql`${table.scopeNamespaceId} is not null`),
		uniqueIndex("unit_slug_address_target_canonical_key")
			.on(table.targetUnitId)
			.where(sql`${table.kind} = 'canonical'`),
		index("unit_slug_address_target_unit_idx").on(table.targetUnitId),
		check("unit_slug_address_kind_check", inArray(table.kind, SlugAddressKindValues)),
		check(
			"unit_slug_address_label_check",
			sql`${table.slug} ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'`,
		),
		check(
			"unit_slug_address_scope_not_target_check",
			sql`${table.scopeUnitId} is null or ${table.scopeUnitId} <> ${table.targetUnitId}`,
		),
	],
);
export type UnitSlugAddress = typeof unitSlugAddress.$inferSelect;
