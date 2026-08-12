import { notInArray } from "drizzle-orm";

import { BootstrapAuthUserIds, BootstrapUnitIds } from "../bootstrap/manifest";
import type { DatabaseTransaction } from "../database";
import { unit, users } from "../database/schema";

/**
 * Proves that disposable Fixtures can own every non-Bootstrap row they create.
 * Platform infrastructure is seeded only after this preflight succeeds.
 */
export async function assertFixtureSeedTargetEmpty(tx: DatabaseTransaction): Promise<void> {
	const [existingUser] = await tx
		.select({ id: users.id })
		.from(users)
		.where(notInArray(users.id, [...BootstrapAuthUserIds]))
		.limit(1);
	const [existingUnit] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(notInArray(unit.id, [...BootstrapUnitIds]))
		.limit(1);
	if (existingUser || existingUnit)
		throw new Error("Seed requires an empty database; run `task --yes local:reset`");
}
