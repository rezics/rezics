import type { DatabaseTransaction } from "../database";
import { unit } from "../database/schema";
import { recordInitialUnitStatus, type UnitStatusActor } from "./status";

/**
 * Inserts an ID-addressed Unit without creating or accepting a slug address.
 *
 * @remarks
 * Slug addresses are optional resources owned by the separate slug-address
 * service. Domain creation paths must never derive an address from user content.
 */
export async function insertUnit(
	tx: DatabaseTransaction,
	input: typeof unit.$inferInsert & { readonly statusActor: UnitStatusActor },
): Promise<typeof unit.$inferSelect> {
	const { statusActor, ...unitInput } = input;
	const [created] = await tx.insert(unit).values(unitInput).returning();
	if (!created) throw new Error("Unit insertion did not return a row");
	await recordInitialUnitStatus(tx, { unitId: created.id, actor: statusActor });
	return created;
}

/** Inserts and records an initial status only when the Unit ID does not already exist. */
export async function insertUnitIfMissing(
	tx: DatabaseTransaction,
	input: typeof unit.$inferInsert & { readonly statusActor: UnitStatusActor },
): Promise<typeof unit.$inferSelect | null> {
	const { statusActor, ...unitInput } = input;
	const [created] = await tx.insert(unit).values(unitInput).onConflictDoNothing().returning();
	if (!created) return null;
	await recordInitialUnitStatus(tx, { unitId: created.id, actor: statusActor });
	return created;
}
