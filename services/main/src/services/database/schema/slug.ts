import { sql } from "drizzle-orm";
import { check, index, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

/**
 * Stores only the address mapping from an old Unit path to its canonical Unit.
 * Redirect retention, entitlement, tombstoning, quarantine, and eventual slug
 * release are separate policy concerns and must remain outside this table.
 *
 * The initial policy never expires Redirects automatically because ordinary
 * users cannot mutate slugs. Explicit staff release is separately authorized.
 * A future external policy may limit active redirects and release expired
 * addresses after a separate quarantine period.
 */
export const unitRedirect = pgTable(
	"unit_redirect",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		targetUnitId: uuid("target_unit_id")
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_redirect_target_unit_idx").on(table.targetUnitId),
		check("unit_redirect_not_self_check", sql`${table.id} <> ${table.targetUnitId}`),
	],
);
export type UnitRedirect = typeof unitRedirect.$inferSelect;
