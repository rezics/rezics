import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, sql } from "drizzle-orm";
import { database, withDatabaseTransactionDeadline } from "../src/services/database";
import {
	platformCapabilityGrant,
	unitMergeRequest,
	unitMergeReview,
	unitMergeOperation,
	unitMergeRedirect,
	unitMergeGraphLock,
	authEntity,
	participationGrant,
} from "../src/services/database/schema";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import {
	createReviewedFixtureMerge,
	prepareFixtureMerge,
	setMergeFixtureAccountState,
} from "./reference-merge-fixture";
import {
	createReviewedUnitMerge,
	preflightUnitMerge,
	reviewUnitMerge,
	retryUnitMerge,
} from "../src/services/units/merge/service";
import { UnitMergeRetryUnavailable } from "../src/services/api/governance/errors";
import {
	issueParticipationGrant,
	revokeParticipationGrant,
} from "../src/services/participation/commands";
import { Authorization } from "../src/services/authorization";
import { databaseSqlState } from "../src/services/database/constraint";
import { dispatchUnitMergeBatch } from "../src/services/units/merge/worker";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Review application requires a disposable loopback target",
);
let checks = 0;
const rowSamples: unknown[] = [];
const [runnable] = await database
	.select({ id: unitMergeOperation.id })
	.from(unitMergeOperation)
	.where(inArray(unitMergeOperation.state, ["pending", "processing", "retry_wait"]))
	.limit(1);
assert.equal(runnable, undefined, "The application fixture must not claim unrelated runnable jobs");
const rollback = new Error("rollback merge review application fixture");
try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			const pair = await prepareFixtureMerge(tx, { visibility: "private" });
			assert.ok(pair.firstReadGrants);
			const receipt = {
				requestId: pair.request.id,
				reviewerAuthUserId: pair.first.account.id,
				reviewerProfileId: pair.first.self.id,
				reviewerAuthority: pair.first.authority,
				sourceReadGrantId: pair.firstReadGrants.source.id,
				sourceReadGrantRevision: pair.firstReadGrants.source.revision,
				targetReadGrantId: pair.firstReadGrants.target.id,
				targetReadGrantRevision: pair.firstReadGrants.target.revision,
				decision: "approve" as const,
				requestFingerprint: pair.request.manifest.fingerprint,
			};
			for (const [patch, code] of [
				[{ sourceReadGrantId: crypto.randomUUID() }, "23503"],
				[{ targetReadGrantId: crypto.randomUUID() }, "23503"],
				[{ sourceReadGrantRevision: null }, "23514"],
				[{ targetReadGrantId: null }, "23514"],
				[
					{
						reviewerAuthority: {
							...pair.first.authority,
							authorizationRevision: pair.first.authority.authorizationRevision + 1,
						},
					},
					"23514",
				],
				[{ reviewerAuthority: pair.second.authority }, "23514"],
			] as const) {
				await assert.rejects(
					tx.transaction((nested) =>
						nested.insert(unitMergeReview).values({ ...receipt, ...patch }),
					),
					(error) => databaseSqlState(error) === code,
				);
				checks++;
			}
			await tx.insert(unitMergeReview).values(receipt);
			const [stored] = await tx
				.select()
				.from(unitMergeReview)
				.where(eq(unitMergeReview.requestId, pair.request.id));
			assert.deepEqual(stored?.reviewerAuthority, pair.first.authority);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(unitMergeReview)
						.set({ reviewerAuthority: pair.second.authority })
						.where(eq(unitMergeReview.requestId, pair.request.id)),
				),
				(error) => databaseSqlState(error) === "23514",
			);
			checks++;
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}

async function reviewedWithBase(
	tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
	useForTarget: boolean,
) {
	const prepared = await prepareFixtureMerge(tx, { visibility: "private" });
	assert.ok(prepared.firstReadGrants && prepared.secondReadGrants);
	const resource = useForTarget ? prepared.target : prepared.source;
	const base = await issueParticipationGrant(tx, prepared.proposer.authority, {
		recipient: { kind: "auth", authUserId: prepared.first.account.id },
		actingEntityId: prepared.first.self.id,
		capability: "catalog.edit",
		target: { owner: resource.owner, id: resource.id },
		expiresAt: new Date(Date.now() + 4000),
	});
	const authority = { ...prepared.first.authority, grant: base };
	const authorization = new Authorization(
		prepared.first.self.id,
		prepared.first.account.id,
		authority,
	);
	await reviewUnitMerge(authorization, prepared.request.id, {
		decision: "approve",
		requestFingerprint: prepared.request.manifest.fingerprint,
		readGrants: useForTarget
			? { source: prepared.firstReadGrants.source }
			: prepared.firstReadGrants,
	});
	const accepted = await reviewUnitMerge(prepared.second.authorization, prepared.request.id, {
		decision: "approve",
		requestFingerprint: prepared.request.manifest.fingerprint,
		readGrants: prepared.secondReadGrants,
	});
	assert.ok(accepted.operation);
	const [operation] = await tx
		.select()
		.from(unitMergeOperation)
		.where(eq(unitMergeOperation.id, accepted.operation.id));
	assert.ok(operation);
	return { ...prepared, first: { ...prepared.first, authority, authorization }, operation };
}
// Explicit selections replace an unrelated base grant; only authority actually used by a side is relevant.
try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			const pair = await reviewedWithBase(tx, false);
			const [base] = await tx
				.select()
				.from(participationGrant)
				.where(eq(participationGrant.id, pair.first.authority.grant.id));
			assert.ok(base?.expiresAt);
			await tx.execute(
				sql`select pg_sleep(greatest(0,extract(epoch from ${base.expiresAt.toISOString()}::timestamptz-clock_timestamp()))+0.025)`,
			);
			assert.equal(await dispatchUnitMergeBatch(), 1);
			checks++;
			const [redirect] = await tx
				.select()
				.from(unitMergeRedirect)
				.where(eq(unitMergeRedirect.sourceUnitId, pair.source.id));
			assert.equal(
				redirect?.targetUnitId,
				pair.target.id,
				"An unused expired base grant cannot invalidate explicit pair reads",
			);
			checks++;
			rowSamples.push(
				(
					await tx.execute(sql`select 'private'::text as visibility,'explicit_with_base'::text as context,
			pg_column_size(r) as row_bytes,pg_column_size(r.reviewer_authority) as authority_bytes
			from unit_merge_review r where r.request_id=${pair.request.id}::uuid and r.reviewer_auth_user_id=${pair.first.account.id}::uuid`)
				).rows[0],
			);
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}

for (const change of [
	"revoked_capability",
	"expired_capability",
	"stale_self",
	"suspended",
	"closed",
	"inactive_self",
	"revoked_private_read",
	"expired_private_read",
] as const) {
	try {
		await withDatabaseTransactionDeadline(120000, () =>
			database.transaction(async (tx) => {
				const pair = await createReviewedFixtureMerge(tx, {
					visibility: change.includes("private") ? "private" : "public",
					firstSourceReadLifetimeMs: change === "expired_private_read" ? 4000 : undefined,
				});
				const [receipt] = await tx
					.select()
					.from(unitMergeReview)
					.where(eq(unitMergeReview.reviewerAuthUserId, pair.first.account.id));
				assert.deepEqual(receipt?.reviewerAuthority, pair.first.authority);
				checks++;
				if (pair.firstReadGrants) {
					assert.equal(receipt?.sourceReadGrantId, pair.firstReadGrants.source.id);
					checks++;
					assert.equal(receipt?.sourceReadGrantRevision, pair.firstReadGrants.source.revision);
					checks++;
					await assert.rejects(
						tx.transaction((nested) =>
							nested
								.delete(participationGrant)
								.where(eq(participationGrant.id, pair.firstReadGrants!.source.id)),
						),
						(error) => databaseSqlState(error) === "23514",
					);
					checks++;
					await assert.rejects(
						tx.transaction((nested) =>
							nested
								.update(unitMergeReview)
								.set({ sourceReadGrantRevision: pair.firstReadGrants!.source.revision + 1 })
								.where(eq(unitMergeReview.reviewerAuthUserId, pair.first.account.id)),
						),
						(error) => databaseSqlState(error) === "23514",
					);
					checks++;
				}
				rowSamples.push(
					(
						await tx.execute(sql`select ${pair.request.manifest.visibility}::text as visibility,
					avg(pg_column_size(r)) as row_bytes, avg(pg_column_size(r.reviewer_authority)) as authority_bytes
					from unit_merge_review r where r.request_id=${pair.request.id}::uuid`)
					).rows[0],
				);
				if (change === "revoked_capability")
					await tx
						.update(platformCapabilityGrant)
						.set({ revokedAt: new Date(), revokedByAuthUserId: pair.proposer.account.id })
						.where(eq(platformCapabilityGrant.authUserId, pair.first.account.id));
				else if (change === "expired_capability") {
					await tx
						.update(platformCapabilityGrant)
						.set({ expiresAt: sql`clock_timestamp()+interval '150 milliseconds'` })
						.where(eq(platformCapabilityGrant.authUserId, pair.first.account.id));
					await tx.execute(sql`select pg_sleep(0.2)`);
				} else if (change === "stale_self")
					await tx
						.update(authEntity)
						.set({ revision: sql`${authEntity.revision}+1` })
						.where(eq(authEntity.authUserId, pair.first.account.id));
				else if (change === "suspended" || change === "closed")
					await setMergeFixtureAccountState({
						requestId: pair.request.id,
						targetAuthUserId: pair.first.account.id,
						state: change,
					});
				else if (change === "inactive_self")
					await tx
						.update(authEntity)
						.set({ state: "suspended", revision: sql`${authEntity.revision}+1` })
						.where(eq(authEntity.authUserId, pair.first.account.id));
				else {
					assert.ok(pair.firstReadGrants);
					if (change === "revoked_private_read")
						await revokeParticipationGrant(
							tx,
							pair.proposer.authority,
							pair.firstReadGrants.source.id,
							pair.firstReadGrants.source.revision,
						);
					else {
						const [grant] = await tx
							.select()
							.from(participationGrant)
							.where(eq(participationGrant.id, pair.firstReadGrants.source.id));
						assert.ok(grant?.expiresAt);
						await tx.execute(
							sql`select pg_sleep(greatest(0,extract(epoch from ${grant.expiresAt.toISOString()}::timestamptz-clock_timestamp()))+0.025)`,
						);
					}
				}
				assert.equal(await dispatchUnitMergeBatch(), 1);
				checks++;
				const [source] = await tx
					.select()
					.from(CatalogIdentityTables.publishing)
					.where(eq(CatalogIdentityTables.publishing.id, pair.source.id));
				assert.equal(source?.status, "published", `Canonicalization must reject ${change}`);
				checks++;
				assert.equal(source?.revision, pair.source.revision);
				checks++;
				assert.equal(
					(
						await tx
							.select()
							.from(unitMergeRedirect)
							.where(eq(unitMergeRedirect.sourceUnitId, pair.source.id))
					).length,
					0,
				);
				checks++;
				const [request] = await tx
					.select()
					.from(unitMergeRequest)
					.where(eq(unitMergeRequest.id, pair.request.id));
				const [operation] = await tx
					.select()
					.from(unitMergeOperation)
					.where(eq(unitMergeOperation.id, pair.operation.id));
				assert.equal(request?.state, "superseded");
				checks++;
				assert.equal(operation?.state, "failed");
				checks++;
				assert.equal(operation?.lastErrorCode, "review_authority_changed");
				checks++;
				assert.equal(
					(
						await tx
							.select()
							.from(unitMergeGraphLock)
							.where(eq(unitMergeGraphLock.operationId, pair.operation.id))
					).length,
					0,
				);
				checks++;
				await tx.insert(platformCapabilityGrant).values({
					authUserId: pair.proposer.account.id,
					capability: "unit.merge",
					grantedByAuthUserId: pair.proposer.account.id,
				});
				await assert.rejects(
					retryUnitMerge(pair.proposer.authorization, pair.request.id),
					UnitMergeRetryUnavailable,
				);
				checks++;
				if (change === "revoked_capability") {
					await tx.insert(platformCapabilityGrant).values({
						authUserId: pair.first.account.id,
						capability: "unit.merge.review",
						grantedByAuthUserId: pair.proposer.account.id,
					});
					const manifest = await preflightUnitMerge(pair.proposer.authorization, {
						sourceUnitId: pair.source.id,
						targetUnitId: pair.target.id,
						plan: pair.request.manifest.plan,
					});
					const renewed = await createReviewedUnitMerge(pair.proposer.authorization, {
						sourceUnitId: pair.source.id,
						targetUnitId: pair.target.id,
						confirmationSourceUnitId: pair.source.id,
						confirmationTargetUnitId: pair.target.id,
						expectedSourceRevision: manifest.sourceRevision,
						expectedTargetRevision: manifest.targetRevision,
						requestFingerprint: manifest.fingerprint,
						idempotencyKey: crypto.randomUUID(),
						plan: pair.request.manifest.plan,
						rules: pair.request.rules,
					});
					for (const reviewer of [pair.first, pair.second])
						await reviewUnitMerge(reviewer.authorization, renewed.id, {
							decision: "approve",
							requestFingerprint: manifest.fingerprint,
						});
					assert.notEqual(renewed.id, pair.request.id);
					checks++;
					assert.equal(await dispatchUnitMergeBatch(), 1);
					checks++;
					const [redirect] = await tx
						.select()
						.from(unitMergeRedirect)
						.where(eq(unitMergeRedirect.sourceUnitId, pair.source.id));
					assert.equal(redirect?.requestId, renewed.id);
					checks++;
				}
				throw rollback;
			}),
		);
	} catch (error) {
		if (error !== rollback) throw error;
	}
}
for (const visibility of ["public", "private"] as const) {
	try {
		await withDatabaseTransactionDeadline(120000, () =>
			database.transaction(async (tx) => {
				const pair = await createReviewedFixtureMerge(tx, { visibility });
				assert.equal(await dispatchUnitMergeBatch(), 1);
				checks++;
				const [redirect] = await tx
					.select()
					.from(unitMergeRedirect)
					.where(eq(unitMergeRedirect.sourceUnitId, pair.source.id));
				assert.equal(redirect?.targetUnitId, pair.target.id);
				checks++;
				await tx
					.update(platformCapabilityGrant)
					.set({ revokedAt: new Date(), revokedByAuthUserId: pair.proposer.account.id })
					.where(eq(platformCapabilityGrant.authUserId, pair.first.account.id));
				for (let page = 0; page < 10; page++) if ((await dispatchUnitMergeBatch()) === 0) break;
				const [request] = await tx
					.select()
					.from(unitMergeRequest)
					.where(eq(unitMergeRequest.id, pair.request.id));
				assert.equal(request?.state, "completed");
				checks++;
				throw rollback;
			}),
		);
	} catch (error) {
		if (error !== rollback) throw error;
	}
}

async function observeWait(worker: number, blocker: number, deadline?: Date) {
	let blocked = false,
		expired = !deadline;
	for (let attempt = 0; attempt < 400; attempt++) {
		const {
			rows: [row],
		} = await database.execute<{ blocked: boolean; expired: boolean }>(sql`select
			${blocker}=any(pg_blocking_pids(${worker})) as blocked,
			${deadline ? sql`clock_timestamp()>${deadline.toISOString()}::timestamptz+interval '25 milliseconds'` : sql`true`} as expired`);
		blocked ||= row?.blocked ?? false;
		expired = row?.expired ?? false;
		if (blocked && expired) break;
		await setTimeout(10);
	}
	assert.ok(blocked && expired, "The exact worker must wait until the admitted deadline expires");
	checks++;
}
for (const expired of [
	"reviewer_capability",
	"reviewer_private",
	"proposer_capability",
	"proposer_and_reviewer",
	"reviewer_base",
] as const) {
	const pair = await withDatabaseTransactionDeadline(120000, () =>
		database.transaction((tx) =>
			expired === "reviewer_base"
				? reviewedWithBase(tx, true)
				: createReviewedFixtureMerge(tx, {
						visibility: "private",
						firstSourceReadLifetimeMs: expired === "reviewer_private" ? 4000 : undefined,
					}),
		),
	);

	assert.ok(pair.firstReadGrants && pair.secondReadGrants);
	const [early, late] = [
		{ actor: pair.first, grants: pair.firstReadGrants },
		{ actor: pair.second, grants: pair.secondReadGrants },
	].sort((a, b) => a.actor.account.id.localeCompare(b.actor.account.id));
	assert.ok(early && late);
	assert.equal(early.actor.account.id, pair.first.account.id);
	let deadline: Date;
	if (expired === "reviewer_private" || expired === "reviewer_base") {
		const [grant] = await database
			.select({ expiresAt: participationGrant.expiresAt })
			.from(participationGrant)
			.where(
				eq(
					participationGrant.id,
					expired === "reviewer_base"
						? pair.first.authority.grant!.id
						: pair.firstReadGrants.source.id,
				),
			);
		assert.ok(grant?.expiresAt);
		deadline = grant.expiresAt;
	} else {
		const [grant] = await database
			.update(platformCapabilityGrant)
			.set({ expiresAt: sql`statement_timestamp()+interval '1800 milliseconds'` })
			.where(
				expired === "proposer_and_reviewer"
					? and(
							inArray(platformCapabilityGrant.authUserId, [
								pair.proposer.account.id,
								early.actor.account.id,
							]),
							inArray(platformCapabilityGrant.capability, [
								"unit.merge.propose",
								"unit.merge.review",
							]),
						)
					: and(
							eq(
								platformCapabilityGrant.authUserId,
								expired === "proposer_capability"
									? pair.proposer.account.id
									: early.actor.account.id,
							),
							eq(
								platformCapabilityGrant.capability,
								expired === "proposer_capability" ? "unit.merge.propose" : "unit.merge.review",
							),
						),
			)
			.returning({ expiresAt: platformCapabilityGrant.expiresAt });
		assert.ok(grant?.expiresAt);
		deadline = grant.expiresAt;
	}
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>();
	const held = withDatabaseTransactionDeadline(14000, async () => {
		await database
			.select()
			.from(participationGrant)
			.where(eq(participationGrant.id, late.grants.target.id))
			.for("update");
		ready.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void held.catch(ready.reject);
	const blocker = await ready.promise,
		started = Promise.withResolvers<number>();
	const working = withDatabaseTransactionDeadline(30000, async () => {
		started.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return dispatchUnitMergeBatch();
	});
	void working.catch(started.reject);
	try {
		await observeWait(await started.promise, blocker, deadline);
	} finally {
		release.resolve();
		const [, count] = await Promise.all([held, working]);
		assert.equal(count, 1);
		checks++;
	}
	const [source] = await database
		.select()
		.from(CatalogIdentityTables.publishing)
		.where(eq(CatalogIdentityTables.publishing.id, pair.source.id));
	assert.equal(source?.status, "published");
	checks++;
	const [request] = await database
		.select()
		.from(unitMergeRequest)
		.where(eq(unitMergeRequest.id, pair.request.id));
	assert.equal(
		request?.state,
		expired === "proposer_capability" ? "action_required" : "superseded",
	);
	checks++;
	const locks = await database
		.select()
		.from(unitMergeGraphLock)
		.where(eq(unitMergeGraphLock.operationId, pair.operation.id));
	assert.equal(locks.length, expired === "proposer_capability" ? 2 : 0);
	checks++;
	if (expired === "proposer_capability") {
		await database.insert(platformCapabilityGrant).values({
			authUserId: pair.proposer.account.id,
			capability: "unit.merge",
			grantedByAuthUserId: pair.proposer.account.id,
		});
		await retryUnitMerge(pair.proposer.authorization, pair.request.id);
		for (let page = 0; page < 10; page++) if ((await dispatchUnitMergeBatch()) === 0) break;
		const [completed] = await database
			.select()
			.from(unitMergeRequest)
			.where(eq(unitMergeRequest.id, pair.request.id));
		assert.equal(completed?.state, "completed");
		checks++;
	}
}
const pair = await withDatabaseTransactionDeadline(120000, () =>
	database.transaction(createReviewedFixtureMerge),
);
const applied = Promise.withResolvers<number>(),
	commit = Promise.withResolvers<void>();
const applying = withDatabaseTransactionDeadline(15000, async () => {
	const {
		rows: [backend],
	} = await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
	assert.ok(backend);
	assert.equal(await dispatchUnitMergeBatch(), 1);
	checks++;
	applied.resolve(backend.pid);
	await commit.promise;
});
void applying.catch(applied.reject);
const applicationPid = await applied.promise,
	revokingStarted = Promise.withResolvers<number>();
const revoking = withDatabaseTransactionDeadline(15000, async () => {
	revokingStarted.resolve(
		(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await database
		.update(platformCapabilityGrant)
		.set({ revokedAt: new Date(), revokedByAuthUserId: pair.proposer.account.id })
		.where(eq(platformCapabilityGrant.authUserId, pair.first.account.id));
});
void revoking.catch(revokingStarted.reject);
try {
	await observeWait(await revokingStarted.promise, applicationPid);
} finally {
	commit.resolve();
	await Promise.all([applying, revoking]);
}
for (let page = 0; page < 10; page++) if ((await dispatchUnitMergeBatch()) === 0) break;
const [completed] = await database
	.select()
	.from(unitMergeRequest)
	.where(eq(unitMergeRequest.id, pair.request.id));
assert.equal(completed?.state, "completed");
checks++;
const {
	rows: [authorityShapeSizing],
} = await database.execute<{
	observedAuthorityBytes: number;
	maximumNumericAuthorityBytes: number;
}>(sql`select
	pg_column_size(reviewer_authority) as "observedAuthorityBytes",
	pg_column_size(jsonb_set(jsonb_set(reviewer_authority,'{authorizationRevision}',to_jsonb(9007199254740991::bigint)),
		'{grant,revision}',to_jsonb(9007199254740991::bigint))) as "maximumNumericAuthorityBytes"
	from unit_merge_review where reviewer_authority ? 'grant' limit 1`);
assert.ok(authorityShapeSizing && authorityShapeSizing.maximumNumericAuthorityBytes <= 320);
checks++;

const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-merge-review-application.ts",
	"services/main/scripts/reference-merge-fixture.ts",
	"services/main/src/services/units/merge/review-application.ts",
	"services/main/src/services/units/merge/service.ts",
	"services/main/src/services/units/merge/worker.ts",
	"services/main/src/services/authorization/platform/authorization.ts",
	"services/main/src/services/database/schema/unit-merge.ts",
	"services/main/src/services/database/schema/postgres/merge-integrity.sql",
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
		rowSamples,
		authorityShapeSizing,
		invalidReviewerAuthorityRejectsCanonicalization: true,
		freshRequestAfterSupersession: true,
		reviewConsumedAtCanonicalization: true,
		rollbackScenarios: true,
		committedDeadlineRaces: 5,
		unusedBaseGrantDoesNotOverrideExplicitReads: true,
		canonicalizationBeforeRevocation: true,
		fixtureHistoryRetained: true,
	}),
);
await database.$client.end();
