import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { database, withDatabaseTransactionDeadline } from "../src/services/database";
import {
	unitMergeOperation,
	unitMergeRedirect,
	unitMergeGraphLock,
	unitMergeReconciliationItem,
	platformCapabilityGrant,
	authEntity,
	users,
} from "../src/services/database/schema";
import {
	claimUnitMergeOperations,
	processClaimedUnitMergePage,
	dispatchUnitMergeBatch,
} from "../src/services/units/merge/worker";
import { retryUnitMerge } from "../src/services/units/merge/service";
import { Authorization } from "../src/services/authorization";
import { ParticipationAuthoritySchema } from "../src/services/participation/policy";
import {
	createMergedFixtureReference,
	setMergeFixtureAccountState,
} from "./reference-merge-fixture";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Merge recovery requires the disposable loopback target",
);
type Operation = typeof unitMergeOperation.$inferSelect;
async function operation(id: string) {
	const [row] = await database
		.select()
		.from(unitMergeOperation)
		.where(eq(unitMergeOperation.id, id));
	assert.ok(row);
	return row;
}
if (process.argv[2] === "--crash-page") {
	const id = process.argv[3];
	assert.ok(id);
	const claimed = await operation(id);
	await withDatabaseTransactionDeadline(30000, async () => {
		assert.equal((await processClaimedUnitMergePage(claimed)).outcome, "continued");
		// Terminate only this fixture-owned child, after page writes and before the outer COMMIT.
		await new Promise<void>((resolve) =>
			process.stdout.write("merge-page-written-before-commit\n", () => resolve()),
		);
		process.kill(process.pid, "SIGKILL");
		throw new Error("The fixture crash did not stop its worker");
	});
	throw new Error("The fixture child unexpectedly survived");
}
let checks = 0;
function same(actual: unknown, expected: unknown) {
	assert.deepEqual(actual, expected);
	checks++;
}
async function claim(expected: Operation) {
	const [claimed] = await claimUnitMergeOperations(new Date(), 1, [expected.shard]);
	assert.equal(claimed?.id, expected.id, "This lane may claim only its fixture operation");
	assert.ok(claimed);
	return claimed;
}
async function seed() {
	const reference = await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(createMergedFixtureReference),
	);
	const [redirect] = await database
		.select()
		.from(unitMergeRedirect)
		.where(eq(unitMergeRedirect.sourceUnitId, reference.sourceId));
	assert.ok(redirect);
	const [op] = await database
		.select()
		.from(unitMergeOperation)
		.where(eq(unitMergeOperation.requestId, redirect.requestId));
	assert.ok(op);
	return op;
}
async function reach(op: Operation, phase: Operation["phase"]) {
	for (let page = 0; page < 20; page++) {
		const current = await operation(op.id);
		if (current.phase === phase && current.state === "pending") return current;
		same((await processClaimedUnitMergePage(await claim(current))).outcome, "continued");
	}
	throw new Error(`Recovery fixture did not reach ${phase}`);
}
async function expire(op: Operation) {
	await database
		.update(unitMergeOperation)
		.set({ leaseExpiresAt: new Date(Date.now() - 1000) })
		.where(
			and(eq(unitMergeOperation.id, op.id), eq(unitMergeOperation.leaseToken, op.leaseToken!)),
		);
}

async function itemCount(op: Operation) {
	return (
		await database
			.select({ count: sql<number>`count(*)::integer` })
			.from(unitMergeReconciliationItem)
			.where(eq(unitMergeReconciliationItem.requestId, op.requestId))
	)[0]!.count;
}
const [unfinished] = await database
	.select({ id: unitMergeOperation.id })
	.from(unitMergeOperation)
	.where(sql`${unitMergeOperation.state} not in ('completed','failed','action_required')`)
	.limit(1);
assert.equal(unfinished, undefined, "Prepare a lane without other runnable operations");
const crashed = await reach(await seed(), "structure");
const firstClaim = await claim(crashed);
const beforeItems = await itemCount(crashed);
const child = spawn(
	process.execPath,
	["--import", "tsx", fileURLToPath(import.meta.url), "--crash-page", crashed.id],
	{
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 45000,
		killSignal: "SIGKILL",
	},
);
let childOutput = "";
child.stdout.on("data", (chunk) => {
	childOutput += String(chunk);
});
child.stderr.on("data", (chunk) => {
	childOutput += String(chunk);
});
const childExit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
	(resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code, signal) => resolve({ code, signal }));
	},
);
assert.equal(childExit.signal, "SIGKILL", childOutput);
checks++;
assert.ok(childOutput.includes("merge-page-written-before-commit"), childOutput);
checks++;
same(await itemCount(crashed), beforeItems);
const afterCrash = await operation(crashed.id);
same(afterCrash.phase, "structure");
same(afterCrash.state, "processing");
same(afterCrash.processedRows, crashed.processedRows);
same(afterCrash.totalItems, crashed.totalItems);
same(afterCrash.resolvedItems, crashed.resolvedItems);
await expire(firstClaim);
const reclaimed = await claim(afterCrash);
assert.notEqual(reclaimed.leaseToken, firstClaim.leaseToken);
checks++;
same((await processClaimedUnitMergePage(firstClaim)).outcome, "lease_lost");
same((await processClaimedUnitMergePage(reclaimed)).outcome, "continued");
const committed = await operation(crashed.id);
same(await itemCount(crashed), beforeItems + 1);
same(committed.totalItems, crashed.totalItems + 1);
same(committed.resolvedItems, crashed.resolvedItems + 1);
// The original caller has lost its acknowledgement; replaying its token cannot add a second receipt.
same((await processClaimedUnitMergePage(reclaimed)).outcome, "lease_lost");
same(await operation(crashed.id), committed);
await reach(committed, "finalize");
const finalClaim = await claim(await operation(crashed.id));
same((await processClaimedUnitMergePage(finalClaim)).outcome, "completed");
same((await processClaimedUnitMergePage(finalClaim)).outcome, "lease_lost");
same(
	(
		await database
			.select()
			.from(unitMergeGraphLock)
			.where(eq(unitMergeGraphLock.operationId, crashed.id))
	).length,
	0,
);

const revoked = await reach(await seed(), "finalize");
await database
	.update(platformCapabilityGrant)
	.set({ revokedAt: new Date(), revokedByAuthUserId: revoked.executorAuthUserId })
	.where(eq(platformCapabilityGrant.authUserId, revoked.executorAuthUserId));
same(await dispatchUnitMergeBatch(), 1);
same((await operation(revoked.id)).state, "action_required");
same((await operation(revoked.id)).completedAt, null);
await database.insert(platformCapabilityGrant).values({
	authUserId: revoked.executorAuthUserId,
	capability: "unit.merge",
	grantedByAuthUserId: revoked.executorAuthUserId,
});
await retryUnitMerge(
	new Authorization(
		revoked.executorProfileId,
		revoked.executorAuthUserId,
		ParticipationAuthoritySchema.parse(revoked.executorAuthority),
	),
	revoked.requestId,
);
same(
	(await processClaimedUnitMergePage(await claim(await operation(revoked.id)))).outcome,
	"completed",
);

for (const waitForRestriction of [false, true])
	for (const restriction of ["suspended", "closed", "stale_self"] as const) {
		const op = await reach(await seed(), "finalize");
		const authority = ParticipationAuthoritySchema.parse(op.executorAuthority);
		await database.insert(platformCapabilityGrant).values({
			authUserId: op.executorAuthUserId,
			capability: "unit.merge",
			grantedByAuthUserId: op.executorAuthUserId,
		});
		const applyRestriction = async () => {
			if (restriction === "stale_self") {
				await database
					.update(authEntity)
					.set({ revision: sql`${authEntity.revision}+1` })
					.where(eq(authEntity.authUserId, op.executorAuthUserId));
			} else
				await setMergeFixtureAccountState({
					requestId: op.requestId,
					targetAuthUserId: op.executorAuthUserId,
					state: restriction,
				});
		};
		if (!waitForRestriction) {
			await applyRestriction();
			same(await dispatchUnitMergeBatch(), 1);
		} else {
			const ready = Promise.withResolvers<number>(),
				release = Promise.withResolvers<void>();
			const holding = withDatabaseTransactionDeadline(15000, async () => {
				if (restriction === "stale_self")
					await database
						.select()
						.from(authEntity)
						.where(eq(authEntity.authUserId, op.executorAuthUserId))
						.for("update");
				else
					await database
						.select()
						.from(users)
						.where(eq(users.id, op.executorAuthUserId))
						.for("no key update");
				ready.resolve(
					(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!
						.pid,
				);
				await release.promise;
				await applyRestriction();
			});
			void holding.catch(ready.reject);
			const blocker = await ready.promise,
				started = Promise.withResolvers<number>();
			const waiting = withDatabaseTransactionDeadline(30000, async () => {
				started.resolve(
					(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!
						.pid,
				);
				return dispatchUnitMergeBatch();
			});
			void waiting.catch(started.reject);
			try {
				const pid = await started.promise;
				let blocked = false;
				for (let attempt = 0; attempt < 200; attempt++) {
					blocked =
						(
							await database.execute<{ blocked: boolean }>(
								sql`select ${blocker} = any(pg_blocking_pids(${pid})) as blocked`,
							)
						).rows[0]?.blocked ?? false;
					if (blocked) break;
					await setTimeout(10);
				}
				same(blocked, true);
			} finally {
				release.resolve();
				const [, count] = await Promise.all([holding, waiting]);
				same(count, 1);
			}
		}
		const denied = await operation(op.id);
		same(denied.state, "action_required");
		same(denied.phase, "finalize");
		same(denied.completedAt, null);
		same(
			(
				await database
					.select()
					.from(unitMergeGraphLock)
					.where(eq(unitMergeGraphLock.operationId, op.id))
			).length,
			2,
		);
		if (restriction !== "stale_self")
			await setMergeFixtureAccountState({
				requestId: op.requestId,
				targetAuthUserId: op.executorAuthUserId,
				state: "active",
			});
		const [self] = await database
			.select()
			.from(authEntity)
			.where(eq(authEntity.authUserId, op.executorAuthUserId));
		assert.ok(self);
		const restored = new Authorization(op.executorProfileId, op.executorAuthUserId, {
			...authority,
			authorizationRevision: self.revision,
		});
		await retryUnitMerge(restored, op.requestId);
		const resumed = await claim(await operation(op.id));
		same((await processClaimedUnitMergePage(resumed)).outcome, "completed");
	}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-merge-recovery.ts",
	"services/main/scripts/reference-merge-fixture.ts",
	"services/main/src/services/units/merge/service.ts",
	"services/main/src/services/units/merge/worker.ts",
	"services/main/src/services/authorization/platform/authorization.ts",
	"services/main/src/services/auth/account-state.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");

console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: (
			await database.execute(
				sql`select version() as postgres,current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		workerProcessCrashBeforeCommit: true,
		leaseReclaimRejectsStaleToken: true,
		lostAcknowledgementDoesNotDuplicateReceipts: true,
		finalizationRechecksAccountAndSelf: true,
		accountAndSelfWaitRaces: 3,
		fixtureHistoryRetained: true,
	}),
);
await database.$client.end();
