import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { OfficialRealmUnitIds } from "@rezics/slug";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("DATABASE_URL and REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 are required");
const url = new URL(connectionString);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/rezics")
	throw new Error("Merge policy fixtures require the loopback local rezics database");

const { database, withDatabaseTransactionDeadline } = await import("../src/services/database");
const { unit, users, profile, realmRule, realmRuleRevision, unitMergeRequest } = await import(
	"../src/services/database/schema"
);
const { createReviewedUnitMerge, reviewUnitMerge, getUnitMergeRequest } = await import(
	"../src/services/units/merge/service"
);
const { buildUnitMergeManifest } = await import("../src/services/units/merge/manifest");
const { createGovernanceDecision } = await import("../src/services/governance/decision-service");
const { UnitMergeReviewSelfForbidden, UnitMergeReviewDuplicate, UnitMergeManifestStale } =
	await import("../src/services/api/governance/errors");
const rollback = new Error("rollback disposable merge fixture");
try {
	await withDatabaseTransactionDeadline(30_000, async () => {
		const [rule] = await database
			.select({
				sourceRealmId: realmRuleRevision.realmId,
				revisionId: realmRuleRevision.id,
				ruleId: realmRule.id,
			})
			.from(realmRuleRevision)
			.innerJoin(realmRule, eq(realmRule.revisionId, realmRuleRevision.id))
			.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
			.orderBy(desc(realmRuleRevision.version), realmRule.id)
			.limit(1);
		assert.ok(rule, "Install the local platform rules before this fixture");
		const actors: string[] = [];
		for (let index = 0; index < 3; index++) {
			const [account] = await database
				.insert(users)
				.values({ name: "Merge policy fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning();
			const [self] = await database.insert(unit).values({ kind: "profile" }).returning();
			assert.ok(account && self);
			await database.insert(profile).values({ id: self.id, authUserId: account.id });
			actors.push(self.id);
		}
		const [proposer, firstReviewer, secondReviewer] = actors;
		assert.ok(proposer && firstReviewer && secondReviewer);
		const pair = await database
			.insert(unit)
			.values([{ kind: "book" }, { kind: "book" }])
			.returning();
		const [source, target] = pair;
		assert.ok(source && target);
		const hasSearchDocument = async (id: string) =>
			(
				await database.execute<{ present: boolean }>(
					sql`select exists(select 1 from public.unit_search_document where unit_id = ${id}::uuid) as present`,
				)
			).rows[0]?.present;
		assert.equal(await hasSearchDocument(source.id), true);
		const request = await createReviewedUnitMerge({
			sourceUnitId: source.id,
			targetUnitId: target.id,
			expectedSourceUpdatedAt: source.updatedAt,
			expectedTargetUpdatedAt: target.updatedAt,
			proposerProfileId: proposer,
			idempotencyKey: crypto.randomUUID(),
			rules: [rule],
		});
		assert.equal(request.policy.version, 2);
		assert.equal(request.policy.requiredApprovals, 2);
		const [template] = await database
			.select()
			.from(unitMergeRequest)
			.where(eq(unitMergeRequest.id, request.id));
		assert.ok(template);
		const review = (reviewerProfileId: string) =>
			reviewUnitMerge({
				requestId: request.id,
				reviewerProfileId,
				decision: "approve",
				requestFingerprint: request.manifest.fingerprint,
			});
		await assert.rejects(() => review(proposer), UnitMergeReviewSelfForbidden);
		assert.equal((await review(firstReviewer)).state, "pending_review");
		await assert.rejects(() => review(firstReviewer), UnitMergeReviewDuplicate);
		assert.equal((await review(secondReviewer)).state, "accepted");
		assert.equal(await hasSearchDocument(source.id), false);
		const [ordinary] = await database.insert(unit).values({ kind: "book" }).returning();
		assert.ok(ordinary);
		await database.update(unit).set({ deletedAt: new Date() }).where(eq(unit.id, ordinary.id));
		assert.equal(await hasSearchDocument(ordinary.id), false);
		await database.update(unit).set({ deletedAt: null }).where(eq(unit.id, ordinary.id));
		assert.equal(await hasSearchDocument(ordinary.id), true);

		const legacyPair = await database
			.insert(unit)
			.values([{ kind: "book" }, { kind: "book" }])
			.returning();
		const [legacySource, legacyTarget] = legacyPair;
		assert.ok(legacySource && legacyTarget);
		const legacyRequestId = crypto.randomUUID();
		await database.transaction(async (tx) => {
			const manifest = await buildUnitMergeManifest(tx, {
				sourceUnitId: legacySource.id,
				targetUnitId: legacyTarget.id,
			});
			const fingerprint = createHash("sha256")
				.update(
					JSON.stringify({
						version: manifest.version,
						policyVersion: 1,
						sourceUnitId: manifest.sourceUnitId,
						targetUnitId: manifest.targetUnitId,
						unitKind: manifest.unitKind,
						sourceUpdatedAt: manifest.sourceUpdatedAt.toISOString(),
						targetUpdatedAt: manifest.targetUpdatedAt.toISOString(),
						sourceGraphRevision: manifest.sourceGraphRevision,
						targetGraphRevision: manifest.targetGraphRevision,
						graphPlan: manifest.graphPlan,
					}),
				)
				.digest("hex");
			const decision = await createGovernanceDecision(tx, {
				action: "unit.merge.propose",
				actorProfileId: proposer,
				authority: { kind: "platform" },
				targetUnitId: legacySource.id,
				subject: { kind: "unit_merge_request", id: legacyRequestId },
				basis: { kind: "rules", rules: [rule] },
			});
			await tx.insert(unitMergeRequest).values({
				...template,
				id: legacyRequestId,
				decisionId: decision.id,
				sourceUnitId: legacySource.id,
				targetUnitId: legacyTarget.id,
				sourceUpdatedAt: legacySource.updatedAt,
				targetUpdatedAt: legacyTarget.updatedAt,
				sourceGraphRevision: manifest.sourceGraphRevision,
				targetGraphRevision: manifest.targetGraphRevision,
				graphPlan: manifest.graphPlan,
				requestFingerprint: fingerprint,
				idempotencyKey: crypto.randomUUID(),
				policyVersion: 1,
				requiredApprovals: 4,
			});
			await assert.rejects(
				() =>
					reviewUnitMerge({
						requestId: legacyRequestId,
						reviewerProfileId: firstReviewer,
						decision: "approve",
						requestFingerprint: fingerprint,
					}),
				UnitMergeManifestStale,
			);
		});
		const legacy = await getUnitMergeRequest(legacyRequestId);
		assert.equal(legacy.state, "superseded");
		assert.equal(legacy.policy.requiredApprovals, 4);
		assert.equal(
			(
				await database
					.select()
					.from(unitMergeRequest)
					.where(and(eq(unitMergeRequest.id, request.id), eq(unitMergeRequest.state, "accepted")))
			).length,
			1,
		);
		throw rollback;
	});
} catch (error) {
	if (error !== rollback) throw error;
	console.info(
		JSON.stringify({
			twoReviewerQuorum: true,
			proposerDenied: true,
			duplicateDenied: true,
			legacyPolicyPreservedAndSuperseded: true,
			fixtureMergesRolledBack: true,
			searchProjectionDeletionAndRestore: true,
		}),
	);
} finally {
	await database.$client.end();
}
