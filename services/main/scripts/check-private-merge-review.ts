import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { Pool } from "pg";
import { and, desc, eq, sql } from "drizzle-orm";
import { OfficialRealmUnitIds } from "@rezics/slug";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	realm,
	realmRule,
	realmRuleRevision,
	platformCapabilityGrant,
	unitMergeReview,
	unitMergeOperation,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { Authorization } from "../src/services/authorization";
import {
	createCatalogIdentity,
	loadCatalogIdentity,
	CatalogAccessDenied,
} from "../src/services/catalog/storage";
import {
	runWithParticipationAuthority,
	ParticipationDenied,
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import {
	issueParticipationGrant,
	revokeParticipationGrant,
} from "../src/services/participation/commands";
import { UnitNotFound } from "../src/services/units/errors";
import {
	preflightUnitMerge,
	createReviewedUnitMerge,
	reviewUnitMerge,
} from "../src/services/units/merge/service";
import {
	claimUnitMergeOperations,
	processClaimedUnitMergePage,
} from "../src/services/units/merge/worker";
import { DefaultMergePlan } from "../src/services/units/merge/contracts";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Private merge checks require a disposable loopback target",
);
let checks = 0;
const rollback = new Error("rollback private merge review");
async function actor(
	tx: DatabaseTransaction,
	name: string,
	capability: "unit.merge" | "unit.merge.review",
) {
	const [account] = await tx
		.insert(users)
		.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority: ParticipationAuthority = {
		principal: { kind: "auth", authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	await tx
		.insert(platformCapabilityGrant)
		.values({ authUserId: account.id, grantedByAuthUserId: account.id, capability });
	return {
		account,
		self,
		authority,
		authorization: new Authorization(self.id, account.id, authority),
	};
}
async function privatePair(tx: DatabaseTransaction) {
	const proposer = await actor(tx, "Private merge proposer", "unit.merge"),
		first = await actor(tx, "Private merge first reviewer", "unit.merge.review"),
		second = await actor(tx, "Private merge second reviewer", "unit.merge.review");
	await tx.insert(realm).values({ id: OfficialRealmUnitIds.rule }).onConflictDoNothing();
	let [revision] = await tx
		.select()
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (!revision)
		[revision] = await tx
			.insert(realmRuleRevision)
			.values({
				realmId: OfficialRealmUnitIds.rule,
				version: 1,
				createdByProfileId: proposer.self.id,
			})
			.returning();
	assert.ok(revision);
	let [rule] = await tx
		.select({ id: realmRule.id })
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.limit(1);
	if (!rule)
		[rule] = await tx
			.insert(realmRule)
			.values({ revisionId: revision.id, position: 0 })
			.returning({ id: realmRule.id });
	assert.ok(rule);
	const source = await runWithParticipationAuthority(proposer.authority, () =>
		createCatalogIdentity(
			tx,
			{ owner: "publishing", shape: "work", status: "published", visibility: "private" },
			proposer.account.id,
		),
	);
	const target = await runWithParticipationAuthority(proposer.authority, () =>
		createCatalogIdentity(
			tx,
			{ owner: "publishing", shape: "work", status: "published", visibility: "private" },
			proposer.account.id,
		),
	);
	const manifest = await preflightUnitMerge(proposer.authorization, {
		sourceUnitId: source.id,
		targetUnitId: target.id,
	});
	const request = await createReviewedUnitMerge(proposer.authorization, {
		sourceUnitId: source.id,
		targetUnitId: target.id,
		confirmationSourceUnitId: source.id,
		confirmationTargetUnitId: target.id,
		expectedSourceRevision: manifest.sourceRevision,
		expectedTargetRevision: manifest.targetRevision,
		requestFingerprint: manifest.fingerprint,
		idempotencyKey: crypto.randomUUID(),
		plan: DefaultMergePlan,
		rules: [{ sourceRealmId: OfficialRealmUnitIds.rule, revisionId: revision.id, ruleId: rule.id }],
	});
	const vote = { decision: "approve" as const, requestFingerprint: manifest.fingerprint };
	return { proposer, first, second, source, target, request, vote };
}

try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			const { proposer, first, second, source, target, request, vote } = await privatePair(tx);
			await assert.rejects(reviewUnitMerge(first.authorization, request.id, vote), UnitNotFound);
			checks++;
			const readGrant = (reviewer: typeof first, id: string) =>
				issueParticipationGrant(tx, proposer.authority, {
					recipient: { kind: "auth", authUserId: reviewer.account.id },
					actingEntityId: reviewer.self.id,
					capability: "catalog.read",
					target: { owner: "publishing", id },
				});
			const firstSource = await readGrant(first, source.id),
				firstTarget = await readGrant(first, target.id),
				secondSource = await readGrant(second, source.id),
				secondTarget = await readGrant(second, target.id);
			await assert.rejects(
				reviewUnitMerge(first.authorization, request.id, {
					...vote,
					readGrants: { source: firstSource },
				}),
				UnitNotFound,
			);
			checks++;
			await assert.rejects(
				reviewUnitMerge(first.authorization, request.id, {
					...vote,
					readGrants: { source: firstTarget, target: firstSource },
				}),
				ParticipationDenied,
			);
			checks++;
			await assert.rejects(
				reviewUnitMerge(first.authorization, request.id, {
					...vote,
					readGrants: { source: secondSource, target: secondTarget },
				}),
				ParticipationDenied,
			);
			checks++;
			await assert.rejects(
				reviewUnitMerge(first.authorization, request.id, {
					...vote,
					readGrants: {
						source: { ...firstSource, revision: firstSource.revision + 1 },
						target: firstTarget,
					},
				}),
				ParticipationDenied,
			);
			checks++;
			await revokeParticipationGrant(tx, proposer.authority, firstSource.id, firstSource.revision);
			await assert.rejects(
				reviewUnitMerge(first.authorization, request.id, {
					...vote,
					readGrants: { source: firstSource, target: firstTarget },
				}),
				ParticipationDenied,
			);
			checks++;
			assert.equal(
				(await tx.select().from(unitMergeReview).where(eq(unitMergeReview.requestId, request.id)))
					.length,
				0,
			);
			checks++;
			const renewed = await readGrant(first, source.id);
			const firstVote = await reviewUnitMerge(first.authorization, request.id, {
				...vote,
				readGrants: { source: renewed, target: firstTarget },
			});
			assert.equal(firstVote.state, "pending_review");
			checks++;
			const accepted = await reviewUnitMerge(second.authorization, request.id, {
				...vote,
				readGrants: { source: secondSource, target: secondTarget },
			});
			assert.equal(accepted.state, "accepted");
			checks++;
			assert.equal(accepted.approvals, 2);
			checks++;
			assert.ok(accepted.operation);
			const [operation] = await tx
				.select()
				.from(unitMergeOperation)
				.where(eq(unitMergeOperation.id, accepted.operation.id));
			assert.ok(operation);
			const [claimed] = await claimUnitMergeOperations(new Date(), 1, [operation.shard]);
			assert.ok(claimed);
			assert.equal(claimed.id, operation.id);
			assert.equal((await processClaimedUnitMergePage(claimed)).outcome, "continued");
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					runWithParticipationAuthority({ ...first.authority, grant: renewed }, () =>
						loadCatalogIdentity(nested, source, first.account.id, false),
					),
				),
				CatalogAccessDenied,
			);
			checks++;
			const retained = await runWithParticipationAuthority(
				{ ...first.authority, grant: firstTarget },
				() => loadCatalogIdentity(tx, source, first.account.id, false),
			);
			assert.equal(retained.status, "archived");
			checks++;
			for (const [grant, count] of [
				[renewed, 0],
				[firstTarget, 1],
			] as const) {
				const visible = await runWithParticipationAuthority(
					{ ...first.authority, grant },
					async () => {
						const scope = await readCatalogAuthorityScope(tx, first.account.id);
						const table = CatalogIdentityTables.publishing;
						return tx
							.select({ id: table.id })
							.from(table)
							.where(
								and(
									eq(table.id, source.id),
									catalogIdentityReadPredicate(scope, "publishing", table),
								),
							);
					},
				);
				assert.equal(visible.length, count);
				checks++;
			}

			await revokeParticipationGrant(tx, proposer.authority, firstTarget.id, firstTarget.revision);
			await assert.rejects(
				tx.transaction((nested) =>
					runWithParticipationAuthority({ ...first.authority, grant: firstTarget }, () =>
						loadCatalogIdentity(nested, source, first.account.id, false),
					),
				),
				ParticipationDenied,
			);
			checks++;

			await assert.rejects(
				tx.transaction((nested) =>
					runWithParticipationAuthority(first.authority, () =>
						loadCatalogIdentity(nested, source, first.account.id, false),
					),
				),
				CatalogAccessDenied,
			);
			checks++;
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
// The first side can expire while the second side is waiting for its grant lock.
const expiryPair = await withDatabaseTransactionDeadline(120000, () =>
	database.transaction(privatePair),
);
const deadline = new Date(Date.now() + 1800);
const selected = await database.transaction(async (tx) => ({
	source: await issueParticipationGrant(tx, expiryPair.proposer.authority, {
		recipient: { kind: "auth", authUserId: expiryPair.first.account.id },
		actingEntityId: expiryPair.first.self.id,
		capability: "catalog.read",
		target: { owner: "publishing", id: expiryPair.source.id },
		expiresAt: deadline,
	}),
	target: await issueParticipationGrant(tx, expiryPair.proposer.authority, {
		recipient: { kind: "auth", authUserId: expiryPair.first.account.id },
		actingEntityId: expiryPair.first.self.id,
		capability: "catalog.read",
		target: { owner: "publishing", id: expiryPair.target.id },
	}),
}));
const pool = new Pool({ connectionString: target.toString(), max: 2, statement_timeout: 14000 });
const held = await pool.connect();
await held.query("begin");
const blocker = (await held.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
await held.query("select id from participation_grant where id=$1 for update", [selected.target.id]);
const started = Promise.withResolvers<number>();
const waiting = withDatabaseTransactionDeadline(14000, async () => {
	started.resolve(
		(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	return reviewUnitMerge(expiryPair.first.authorization, expiryPair.request.id, {
		...expiryPair.vote,
		readGrants: selected,
	});
});
void waiting.catch(started.reject);
const denied = assert.rejects(waiting, ParticipationDenied);
void denied.catch(() => {});
try {
	const pid = await started.promise;
	let blocked = false,
		expired = false;
	for (let attempt = 0; attempt < 500; attempt++) {
		const state = (
			await pool.query<{ blocked: boolean; expired: boolean }>(
				"select $2::integer=any(pg_blocking_pids($1)) as blocked, clock_timestamp()>$3::timestamptz+interval '25 milliseconds' as expired",
				[pid, blocker, deadline],
			)
		).rows[0];
		blocked ||= state?.blocked ?? false;
		expired = state?.expired ?? false;
		if (blocked && expired) break;
		await setTimeout(10);
	}
	assert.ok(blocked && expired);
	checks++;
} finally {
	await held.query("commit");
	held.release();
	try {
		await denied;
		checks++;
	} finally {
		await pool.end();
	}
}
assert.equal(
	(
		await database
			.select()
			.from(unitMergeReview)
			.where(eq(unitMergeReview.requestId, expiryPair.request.id))
	).length,
	0,
);
checks++;
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-private-merge-review.ts",
	"services/main/src/services/units/merge/contracts.ts",
	"services/main/src/services/units/merge/manifest.ts",
	"services/main/src/services/units/merge/service.ts",
	"services/main/src/services/participation/policy.ts",
	"services/main/src/services/catalog/storage.ts",
	"services/main/src/services/catalog/merge-read.ts",
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
		privatePairReviewQualified: true,
		rollbackTransactionCases: true,
		expiryCaseRetained: true,
	}),
);
console.info(
	`Verified ${checks} explicit private merge review authority assertions; transaction cases rolled back; expiry-wait accounts remain only on the disposable target.`,
);
process.exit(0);
