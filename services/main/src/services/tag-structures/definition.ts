import { eq, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { unitStructure } from "../database/schema";

export function nextUnitStructureDefinitionUpdatedAt(
	current: Date,
	wallClockMilliseconds = Date.now(),
): Date {
	return new Date(Math.max(wallClockMilliseconds, current.getTime() + 1));
}

/**
 * Replaces a community-immutable Structure definition through the one
 * database path reserved for platform-authorized administrative corrections.
 */
export async function replaceUnitStructureDefinition(
	tx: DatabaseTransaction,
	input: {
		readonly structureId: string;
		readonly memberUnitIds: readonly string[];
		readonly updatedAt: Date;
	},
): Promise<void> {
	await tx.execute(sql`select lock_unit_structure_definition_key(${input.structureId})`);
	await tx.execute(
		sql`select set_config(
			'rezics.unit_structure_admin_edit_id',
			${input.structureId},
			true
		)`,
	);
	await tx
		.update(unitStructure)
		.set({
			memberUnitIds: [...input.memberUnitIds],
			updatedAt: input.updatedAt,
		})
		.where(eq(unitStructure.id, input.structureId));
	await tx.execute(sql`select set_config('rezics.unit_structure_admin_edit_id', '', true)`);
}
