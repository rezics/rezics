import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { database } from "../src/services/database";
import { PlatformWorkloadDefinitions } from "../src/services/authorization/workload-principals";
import { assertFixtureSeedTargetEmpty } from "../src/services/seed/fixture-target";
import { assertNativeEnrollmentFixture } from "./native-enrollment-fixture";

assertNativeEnrollmentFixture();
const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		max: 3,
		statement_timeout: 10000,
	}),
	peer = drizzle({ client: pool });
let checks = 0;
try {
	const duties = (
		await database.execute<{
			count: number;
		}>(sql`select count(*)::integer as count from public.workload_principal w
  join public.access_scope s on s.id=w.owner_scope_id where w.purpose='system' and s.platform_root='platform'
  and w.system_key=any(${sql.param(Object.keys(PlatformWorkloadDefinitions))}::text[]) and w.version>0`)
	).rows[0]?.count;
	assert.equal(duties, Object.keys(PlatformWorkloadDefinitions).length);
	checks++;
	await database.transaction((tx) => assertFixtureSeedTargetEmpty(tx));
	checks++;
	for (const kind of ["human", "service"] as const) {
		const rollback = new Error("Rollback unrelated account seed admission probe");
		await assert.rejects(
			database.transaction(async (tx) => {
				await tx
					.insert(users)
					.values({
						principalKind: kind,
						name: "Seed guard probe",
						email: `${randomUUID()}@seed-guard.invalid`,
					});
				await assert.rejects(
					() => assertFixtureSeedTargetEmpty(tx),
					/Seed requires an empty database/,
				);
				checks++;
				throw rollback;
			}),
			(error) => error === rollback,
		);
	}
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const holder = peer.transaction(async (tx) => {
		await assertFixtureSeedTargetEmpty(tx);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void holder.catch(ready.reject);
	const blocker = await ready.promise;
	const contender = peer.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return assertFixtureSeedTargetEmpty(tx);
	});
	void contender.catch(started.reject);
	try {
		const pid = await started.promise;
		let blocked = false;
		for (let i = 0; i < 500; i++) {
			if (
				(
					await pool.query<{ blocked: boolean }>(
						"select $2::integer=any(pg_blocking_pids($1)) as blocked",
						[pid, blocker],
					)
				).rows[0]?.blocked
			) {
				blocked = true;
				break;
			}
			await setTimeout(10);
		}
		assert.equal(blocked, true, "Competing preflight waits for the exact seed-run fence");
		checks++;
	} finally {
		release.resolve();
		await holder;
		await contender;
	}
	await database.transaction((tx) => assertFixtureSeedTargetEmpty(tx));
	checks++;
	console.info(
		JSON.stringify({
			checks,
			registeredSystemDuties: duties,
			unrelatedKindsRejected: ["human", "service"],
			observedSeedLock: true,
			targetStillEmpty: true,
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
}
