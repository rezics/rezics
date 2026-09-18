import { eq, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { UnitReferenceSchema, type UnitReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import {
	referenceValue,
	referenceValueNativeIdExpression,
} from "@rezics/schema/postgres/knowledge/reference-value";
import { allocateImmutableReference } from "./immutable-reference";
import {
	unitReferenceTargetColumn,
	unitReferenceValues,
	unitReferenceOwnerExpression,
} from "@rezics/schema/postgres/shared/unit-reference-columns";

/**
 * Allocate or reuse an immutable value inside an already authorized operation.
 * @remarks
 * This persistence primitive grants no access and must not be exposed as an
 * existence oracle. The caller owns authority/disclosure checks and transaction
 * deadlines. Read committed observes a concurrent winner in a follow-up SELECT;
 * stronger isolation propagates PostgreSQL serialization failures for whole-
 * transaction retry. Neither path updates an existing mapping.
 * @internal
 */
export async function allocateReferenceValue(
	tx: DatabaseTransaction,
	input: UnitReference,
): Promise<string> {
	const target = UnitReferenceSchema.parse(input);
	const column = unitReferenceTargetColumn("target", target.owner, referenceValue);
	return allocateImmutableReference(
		async () => {
			const [existing] = await tx
				.select({ id: referenceValue.id })
				.from(referenceValue)
				.where(eq(column, target.id))
				.limit(1);
			return existing?.id;
		},
		async () => {
			const [inserted] = await tx
				.insert(referenceValue)
				.values(unitReferenceValues("target", target))
				.onConflictDoNothing({ target: column, where: sql`${column} is not null` })
				.returning({ id: referenceValue.id });
			return inserted?.id;
		},
	);
}

/**
 * Decode one validated value; its target's current visibility is checked by the consumer.
 * @internal
 */
export async function resolveReferenceValue(
	tx: DatabaseTransaction,
	id: string,
): Promise<UnitReference | null> {
	z.uuid().parse(id);
	const [row] = await tx
		.select({
			owner: unitReferenceOwnerExpression("target", referenceValue),
			id: referenceValueNativeIdExpression(referenceValue),
		})
		.from(referenceValue)
		.where(eq(referenceValue.id, id))
		.limit(1);
	return row ? UnitReferenceSchema.parse(row) : null;
}

/** Derived target fields for a joined, immutable reference value. @internal */
export const referenceValueTarget = {
	owner: unitReferenceOwnerExpression("target", referenceValue),
	id: referenceValueNativeIdExpression(referenceValue),
};

/**
 * Find an existing value for a native UUID without allocating or relying on routing projections.
 * @remarks The derived native-ID expression index supports one selective probe. Native UUID
 * admission is globally unique; detecting conflicting physical owners fails closed. This internal
 * lookup grants no disclosure authority and must not be exposed as an existence endpoint.
 * @internal
 */
export async function findReferenceValueByNativeId(tx: DatabaseTransaction, nativeId: string) {
	z.uuid().parse(nativeId);
	const rows = await tx
		.select({ valueId: referenceValue.id, target: referenceValueTarget })
		.from(referenceValue)
		.where(eq(referenceValueTarget.id, nativeId))
		.limit(2);
	if (rows.length > 1) throw new Error("Native UUID has conflicting reference owners");
	const row = rows[0];
	return row ? { valueId: row.valueId, target: UnitReferenceSchema.parse(row.target) } : undefined;
}

const referenceLookup = alias(referenceValue, "reference_lookup");

/**
 * Indexed scalar reference lookup for a native-ID predicate, without allocation or disclosure.
 * @remarks A missing mapping is NULL. Conflicting native owners raise a scalar-subquery error
 * rather than choosing an arbitrary reference. The caller owns target read authorization.
 * @internal
 */
export function referenceValueIdForNativeId(nativeId: string | SQLWrapper) {
	return sql<string | null>`(select ${referenceLookup.id} from ${referenceValue} reference_lookup
  where ${referenceValueNativeIdExpression(referenceLookup)}=${nativeId}::uuid)`;
}
