import { createFixtureRestrictionDecision } from "./unit-access-fixture";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { post } from "../src/services/database/schema/post";
import { unitAccessGrant, unitAccessRestriction } from "../src/services/database/schema/access";
import { platformCapabilityGrant } from "../src/services/database/schema/realm";
import { Authorization } from "../src/services/authorization";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import type { ParticipationAuthority } from "../src/services/participation/policy";
import { withCatalogViewerPolicy } from "../src/services/catalog/read-policy";
import {
	readRegisteredUnitPreview,
	UnitReferenceUnavailable,
} from "../src/services/units/reference";

const connectionString = process.env.DATABASE_ADMIN_URL;
assert.ok(connectionString);
const target = new URL(connectionString);
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Expiry checks require a disposable loopback target",
);
const pool = new Pool({ connectionString, max: 3, statement_timeout: 10000 });
const db = drizzle({ client: pool });
const rollback = new Error("rollback access expiry fixture");
let checks = 0;
try {
	for (const kind of ["grant", "restriction", "platform"] as const) {
		try {
			await db.transaction(async (tx) => {
				const [account] = await tx
					.insert(users)
					.values({
						name: "Access expiry fixture",
						email: `${crypto.randomUUID()}@example.invalid`,
						emailVerified: true,
					})
					.returning();
				assert.ok(account);
				const self = await ensureSelfEntityInTransaction(tx, account);
				const authority: ParticipationAuthority = {
					principal: { kind: "auth", authUserId: account.id },
					actingEntityId: self.id,
					authorizationRevision: self.authorizationRevision,
				};
				const authorization = new Authorization(self.id, account.id, authority);
				const [resource] = await tx
					.insert(post)
					.values({
						kind: "post",
						status: "published",
						publishedAt: new Date(),
						visibility: kind === "restriction" ? "public" : "private",
					})
					.returning({ id: post.id });
				assert.ok(resource);
				const expiresAt = sql`clock_timestamp() + interval '500 milliseconds'`;
				let deadline: Date | null | undefined;
				if (kind === "grant") {
					const [grant] = await tx
						.insert(unitAccessGrant)
						.values({
							unitId: resource.id,
							subjectKind: "auth",
							authUserId: account.id,
							permission: "unit.read",
							scope: [],
							grantedByAuthUserId: account.id,
							expiresAt,
						})
						.returning({ expiresAt: unitAccessGrant.expiresAt });
					deadline = grant?.expiresAt;
				} else if (kind === "restriction") {
					const decision = await createFixtureRestrictionDecision(tx, {
						authUserId: account.id,
						selfEntityId: self.id,
						targetId: resource.id,
					});
					const [restriction] = await tx
						.insert(unitAccessRestriction)
						.values({
							unitId: resource.id,
							subjectKind: "auth",
							authUserId: account.id,
							permission: "unit.read",
							scope: [],
							createdByAuthUserId: account.id,
							decisionId: decision.id,
							expiresAt,
						})
						.returning({ expiresAt: unitAccessRestriction.expiresAt });
					deadline = restriction?.expiresAt;
				} else {
					const [grant] = await tx
						.insert(platformCapabilityGrant)
						.values({
							authUserId: account.id,
							capability: "unit.edit",
							grantedByAuthUserId: account.id,
							expiresAt,
						})
						.returning({ expiresAt: platformCapabilityGrant.expiresAt });
					deadline = grant?.expiresAt;
				}
				assert.ok(deadline);
				assert.equal(
					(await authorization.unit.decideInTransaction(tx, resource.id, "unit.read")).allowed,
					kind !== "restriction",
					`${kind}: active decision`,
				);
				checks++;
				let expired = false;
				for (let attempt = 0; attempt < 200; attempt++) {
					const clock = await tx.execute<{ expired: boolean }>(
						sql`select clock_timestamp() > ${deadline.toISOString()}::timestamptz as expired`,
					);
					if (clock.rows[0]?.expired) {
						expired = true;
						break;
					}
					await setTimeout(10);
				}
				assert.ok(
					expired,
					"database clock crossed the stored expiry while the transaction remained open",
				);
				assert.equal(
					(await authorization.unit.decideInTransaction(tx, resource.id, "unit.read")).allowed,
					kind === "restriction",
					`${kind}: decision after expiry in the same transaction`,
				);
				const preview = () =>
					withCatalogViewerPolicy(tx, account.id, () =>
						readRegisteredUnitPreview(tx, resource.id, {
							authUserId: account.id,
							selfEntityId: self.id,
						}),
					);
				if (kind === "restriction") assert.equal((await preview()).reference.id, resource.id);
				else await assert.rejects(preview, UnitReferenceUnavailable);
				checks += 2;
				throw rollback;
			});
		} catch (cause) {
			if (cause !== rollback) throw cause;
		}
	}
	// A grant's row-lock wait must not preserve the earlier SELECT's expiry cutoff.
	const seeded = await db.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: "Platform expiry wait fixture",
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		const [grant] = await tx
			.insert(platformCapabilityGrant)
			.values({
				authUserId: account.id,
				capability: "unit.edit",
				grantedByAuthUserId: account.id,
				expiresAt: sql`clock_timestamp() + interval '2 seconds'`,
			})
			.returning();
		assert.ok(grant?.expiresAt);
		return { account, self, grant };
	});
	const ready = Promise.withResolvers<number>();
	const release = Promise.withResolvers<void>();
	const started = Promise.withResolvers<number>();
	const holder = db.transaction(async (tx) => {
		await tx
			.select({ id: platformCapabilityGrant.id })
			.from(platformCapabilityGrant)
			.where(eq(platformCapabilityGrant.id, seeded.grant.id))
			.for("update");
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void holder.catch(ready.reject);
	const holderPid = await ready.promise;
	const authorization = new Authorization(seeded.self.id, seeded.account.id);
	const decision = db.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return authorization.platform.hasCapability("unit.edit", tx);
	});
	void decision.catch(started.reject);
	try {
		const waitingPid = await started.promise;
		let blocked = false,
			expired = false;
		for (let attempt = 0; attempt < 500; attempt++) {
			const state = await pool.query<{ blocked: boolean; expired: boolean }>(
				"select $2::integer = any(pg_blocking_pids($1)) as blocked, clock_timestamp() > $3::timestamptz + interval '25 milliseconds' as expired",
				[waitingPid, holderPid, seeded.grant.expiresAt],
			);
			blocked ||= state.rows[0]?.blocked ?? false;
			expired = state.rows[0]?.expired ?? false;
			if (blocked && expired) break;
			await setTimeout(10);
		}
		assert.ok(
			blocked && expired,
			"the platform check waited on the exact lock past the stored expiry",
		);
	} finally {
		release.resolve();
		await holder;
	}
	assert.equal(await decision, false, "a platform grant expiring during its lock wait is denied");
	checks += 2;
	const repository = new URL("../../../", import.meta.url);
	const sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/Taskfile.yml",
		"services/main/scripts/check-access-expiry.ts",
		"services/main/scripts/unit-access-fixture.ts",
		...[
			"platform/authorization.ts",
			"platform/query.ts",
			"realm/query.ts",
			"unit/authorization.ts",
			"unit/query.ts",
			"unit/realm-subject.ts",
			"unit/invitations.ts",
			"unit/access-lock.ts",
		].map((path) => `services/main/src/services/authorization/${path}`),
		"services/main/src/services/units/reference.ts",
		"services/main/src/services/database/schema/access.ts",
		"services/main/src/services/database/schema/realm.ts",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repository)))
			.digest("hex");
	const runtime = await pool.query(
		"select version() as postgres, current_setting('default_transaction_isolation') as default_isolation",
	);
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			runtime: runtime.rows[0],
			checks,
			families: ["direct resource grant", "resource restriction", "platform capability"],
			platformLockWaitQualified: true,
		}),
	);
	console.info(
		`Verified ${checks} live expiry decisions in real PostgreSQL; transaction cases rolled back; the lock-wait actor remains only in the disposable target.`,
	);
} finally {
	await pool.end();
}
