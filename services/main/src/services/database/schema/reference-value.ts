import { sql } from "drizzle-orm";
import { check, index, uniqueIndex } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import { pgTable } from "./base";
import { createUuidv7PrimaryKey } from "./columns";
import {
	unitReferenceColumns,
	unitReferenceTargetColumn,
	unitReferenceIdExpression,
} from "./unit-reference-columns";

/**
 * Immutable reference values for generic consumers; native owners exist independently.
 * @internal
 */
export const referenceValue = pgTable(
	"reference_value",
	{
		id: createUuidv7PrimaryKey(),
		...unitReferenceColumns("target"),
	},
	(table) => [
		index("reference_value_native_id_idx").on(unitReferenceIdExpression("target")),
		check(
			"reference_value_target_check",
			sql`num_nonnulls(${sql.join(
				UnitOwnerValues.map((owner) => unitReferenceTargetColumn("target", owner, table)),
				sql`, `,
			)}) = 1`,
		),
		...UnitOwnerValues.map((owner) => {
			const column = unitReferenceTargetColumn("target", owner, table);
			return uniqueIndex(`reference_value_target_${owner}_key`)
				.on(column)
				.where(sql`${column} is not null`);
		}),
	],
);
