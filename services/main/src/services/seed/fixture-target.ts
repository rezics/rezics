import { notInArray } from "drizzle-orm";

import { UnitOwnerValues, type UnitOwner } from "@rezics/reference";
import {
	BootstrapAuthUserIds,
	BootstrapPlatformReferences,
	BootstrapEntityIds,
} from "../bootstrap/data";
import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import { users } from "../database/schema";
import { unitOwnerTable } from "@rezics/schema/postgres/shared/unit-reference-columns";

function bootstrapIds(owner: UnitOwner) {
	return owner === "entity"
		? BootstrapEntityIds
		: BootstrapPlatformReferences.filter((reference) => reference.owner === owner).map(
				(reference) => reference.id,
			);
}

/** Qualification remains bounded even if accidentally pointed at an occupied local database. */
export async function readSeedIdentityIds(
	executor: DatabaseExecutor,
): Promise<ReadonlyMap<UnitOwner, readonly string[]>> {
	const result = new Map<UnitOwner, readonly string[]>();
	let total = 0;
	for (const owner of UnitOwnerValues) {
		const table = unitOwnerTable(owner),
			reserved = bootstrapIds(owner);
		const rows = await executor
			.select({ id: table.id })
			.from(table)
			.where(reserved.length ? notInArray(table.id, reserved) : undefined)
			.limit(10_001);
		total += rows.length;
		if (total > 10_000) throw new Error("Seed qualification requires a bounded fixture database");
		result.set(
			owner,
			rows.map((row) => row.id),
		);
	}
	return result;
}

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
	if (existingUser)
		throw new Error("Seed requires an empty database; run `task --yes local:reset`");
	for (const owner of UnitOwnerValues) {
		const table = unitOwnerTable(owner),
			reserved = bootstrapIds(owner);
		const [existing] = await tx
			.select({ id: table.id })
			.from(table)
			.where(reserved.length ? notInArray(table.id, reserved) : undefined)
			.limit(1);
		if (existing) throw new Error("Seed requires an empty database; run `task --yes local:reset`");
	}
}
