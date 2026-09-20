import { PlatformWorkloadDefinitions } from "../authorization/workload-principals";
import { and, notInArray, sql } from "drizzle-orm";

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
	// READ COMMITTED native commands require a seed-run fence before empty-target observations.
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('rezics-fixture-seed',0))`);
	const [existingUser] = await tx
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				notInArray(users.id, [...BootstrapAuthUserIds]),
				sql`not (${users.principalKind}='service' and exists(
				select 1 from public.workload_principal w join public.access_scope s on s.id=w.owner_scope_id
				where w.auth_user_id=${users.id} and w.purpose='system' and w.system_key=any(${sql.param(Object.keys(PlatformWorkloadDefinitions))}::text[])
				and w.version>0 and s.platform_root='platform'))`,
			),
		)
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
