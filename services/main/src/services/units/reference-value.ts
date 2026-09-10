import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { UnitReferenceSchema, type UnitReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { referenceValue } from "../database/schema/reference-value";
import { allocateImmutableReference } from "./immutable-reference";
import {
	unitReferenceTargetColumn,
	unitReferenceValues,
	unitReferenceIdExpression,
	unitReferenceOwnerExpression,
} from "../database/schema/unit-reference-columns";

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
			owner: unitReferenceOwnerExpression("target"),
			id: unitReferenceIdExpression("target"),
		})
		.from(referenceValue)
		.where(eq(referenceValue.id, id))
		.limit(1);
	return row ? UnitReferenceSchema.parse(row) : null;
}
