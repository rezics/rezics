import { inArray, sql } from "drizzle-orm";
import { check, foreignKey, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	type UnitKind,
	UnitRelationKindValues,
	type UnitRelationKind,
	UnitRelationSignatures,
} from "./contract-values";
import { unit } from "./unit";

function checkedRelationSignatureLiteral(value: string) {
	if (!/^[a-z][a-z0-9_]*$/.test(value))
		throw new Error("Unit relation signature values must be safe SQL identifiers");
	return sql.raw(`'${value}'`);
}

/**
 * Generic, signature-constrained Unit relation.
 *
 * The source owns the edge. Both persisted Unit kinds are composite-FK proofs,
 * while the relation-kind signature check prevents a valid pair of Units from
 * being used with the wrong relation semantics.
 */
export const unitRelation = pgTable(
	"unit_relation",
	{
		sourceUnitId: uuid().notNull(),
		sourceUnitKind: text().$type<UnitKind>().notNull(),
		kind: text().$type<UnitRelationKind>().notNull(),
		targetUnitId: uuid().notNull(),
		targetUnitKind: text().$type<UnitKind>().notNull(),
	},
	(table) => {
		const signatureChecks = UnitRelationKindValues.map((kind) => {
			const signature = UnitRelationSignatures[kind];
			return sql`(
				${table.kind} = ${checkedRelationSignatureLiteral(kind)}
					and ${table.sourceUnitKind} = ${checkedRelationSignatureLiteral(signature.sourceKind)}
					and ${table.targetUnitKind} = ${checkedRelationSignatureLiteral(signature.targetKind)}
			)`;
		});
		return [
			primaryKey({
				name: "unit_relation_source_kind_target_pkey",
				columns: [table.sourceUnitId, table.kind, table.targetUnitId],
			}),
			foreignKey({
				columns: [table.sourceUnitId, table.sourceUnitKind],
				foreignColumns: [unit.id, unit.kind],
				name: "unit_relation_source_unit_kind_fkey",
			}).onDelete("cascade"),
			foreignKey({
				columns: [table.targetUnitId, table.targetUnitKind],
				foreignColumns: [unit.id, unit.kind],
				name: "unit_relation_target_unit_kind_fkey",
			}).onDelete("restrict"),
			index("unit_relation_target_kind_source_idx").on(
				table.targetUnitId,
				table.kind,
				table.sourceUnitId,
			),
			check("unit_relation_kind_check", inArray(table.kind, UnitRelationKindValues)),
			check("unit_relation_signature_check", sql`(${sql.join(signatureChecks, sql` or `)})`),
			check("unit_relation_not_self_check", sql`${table.sourceUnitId} <> ${table.targetUnitId}`),
		];
	},
);
