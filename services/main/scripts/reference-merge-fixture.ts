import assert from "node:assert/strict";
import { and, desc, eq, ne } from "drizzle-orm";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { database, type DatabaseTransaction } from "../src/services/database";
import { replacePlatformUserAccountState } from "../src/services/platform-users/service";
import {
	users,
	realm,
	realmRule,
	realmRuleRevision,
	platformCapabilityGrant,
	unitMergeOperation,
	unitMergeRedirect,
	unitMergeRequest,
	unitMergeReview,
	governanceDecisionRule,
	authEntity,
	userAccountState,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import {
	createReviewedUnitMerge,
	preflightUnitMerge,
	reviewUnitMerge,
} from "../src/services/units/merge/service";
import {
	claimUnitMergeOperations,
	processClaimedUnitMergePage,
} from "../src/services/units/merge/worker";
import { issueParticipationGrant } from "../src/services/participation/commands";
import { DefaultMergePlan } from "../src/services/units/merge/contracts";

type FixtureMergeOptions = {
	visibility?: "public" | "private";
	firstSourceReadLifetimeMs?: number;
};

/** Prepare actual human accounts, a native pair, rule-backed intent and optional private read grants. @internal */
export async function prepareFixtureMerge(
	tx: DatabaseTransaction,
	options: FixtureMergeOptions = {},
) {
	async function reviewer(name: string, capability: "unit.merge.propose" | "unit.merge.review") {
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
			.values({ authUserId: account.id, capability, grantedByAuthUserId: account.id });
		return {
			account,
			self,
			authority,
			authorization: new Authorization(self.id, account.id, authority),
		};
	}
	const proposer = await reviewer("Reference merge proposer", "unit.merge.propose"),
		first = await reviewer("Reference merge reviewer one", "unit.merge.review"),
		second = await reviewer("Reference merge reviewer two", "unit.merge.review");
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
		.select()
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.limit(1);
	if (!rule)
		[rule] = await tx
			.insert(realmRule)
			.values({ revisionId: revision.id, position: 0 })
			.returning();
	assert.ok(rule);
	const source = await runWithParticipationAuthority(proposer.authority, () =>
		createCatalogIdentity(
			tx,
			{
				owner: "publishing",
				shape: "work",
				status: "published",
				visibility: options.visibility ?? "public",
			},
			proposer.account.id,
		),
	);
	const target = await runWithParticipationAuthority(proposer.authority, () =>
		createCatalogIdentity(
			tx,
			{
				owner: "publishing",
				shape: "work",
				status: "published",
				visibility: options.visibility ?? "public",
			},
			proposer.account.id,
		),
	);
	const manifest = await preflightUnitMerge(proposer.authorization, {
		sourceUnitId: source.id,
		targetUnitId: target.id,
		plan: DefaultMergePlan,
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
	async function readGrants(reviewer: typeof first) {
		if (options.visibility !== "private") return undefined;
		return {
			source: await issueParticipationGrant(tx, proposer.authority, {
				recipient: { kind: "auth", authUserId: reviewer.account.id },
				actingEntityId: reviewer.self.id,
				capability: "catalog.read",
				target: { owner: source.owner, id: source.id },
				expiresAt:
					reviewer.account.id === first.account.id && options.firstSourceReadLifetimeMs
						? new Date(Date.now() + options.firstSourceReadLifetimeMs)
						: undefined,
			}),
			target: await issueParticipationGrant(tx, proposer.authority, {
				recipient: { kind: "auth", authUserId: reviewer.account.id },
				actingEntityId: reviewer.self.id,
				capability: "catalog.read",
				target: { owner: target.owner, id: target.id },
			}),
		};
	}
	const firstReadGrants = await readGrants(first),
		secondReadGrants = await readGrants(second);
	return { proposer, first, second, source, target, request, firstReadGrants, secondReadGrants };
}

/** Queue an independently reviewed native pair in the caller's deadline transaction. @internal */
export async function createReviewedFixtureMerge(
	tx: DatabaseTransaction,
	options: FixtureMergeOptions = {},
) {
	const prepared = await prepareFixtureMerge(tx, options);
	const { first, second, request, firstReadGrants, secondReadGrants } = prepared;
	await reviewUnitMerge(first.authorization, request.id, {
		decision: "approve",
		requestFingerprint: request.manifest.fingerprint,
		readGrants: firstReadGrants,
	});
	const accepted = await reviewUnitMerge(second.authorization, request.id, {
		decision: "approve",
		requestFingerprint: request.manifest.fingerprint,
		readGrants: secondReadGrants,
	});
	assert.ok(accepted.operation);
	const [operation] = await tx
		.select()
		.from(unitMergeOperation)
		.where(eq(unitMergeOperation.id, accepted.operation.id));
	assert.ok(operation);
	return { ...prepared, operation };
}

/** Create a real approved public redirect inside a fixture's rollback/deadline transaction. */
export async function createMergedFixtureReference(tx: DatabaseTransaction) {
	const { source, target, operation } = await createReviewedFixtureMerge(tx);
	const [claim] = await claimUnitMergeOperations(new Date(), 1, [operation.shard]);
	assert.equal(
		claim?.id,
		operation.id,
		"The isolated fixture must claim only its own merge operation",
	);
	assert.ok(claim);
	const result = await processClaimedUnitMergePage(claim);
	assert.equal(result.outcome, "continued");
	const [redirect] = await tx
		.select()
		.from(unitMergeRedirect)
		.where(eq(unitMergeRedirect.sourceUnitId, source.id));
	assert.equal(redirect?.targetUnitId, target.id);
	return { owner: "publishing" as const, sourceId: source.id, targetId: target.id };
}

/** Change only a fixture merge participant through an independently authorized rule-backed command. @internal */
export async function setMergeFixtureAccountState(input: {
	requestId: string;
	targetAuthUserId: string;
	state: "active" | "suspended" | "closed";
}) {
	const [request] = await database
		.select()
		.from(unitMergeRequest)
		.where(eq(unitMergeRequest.id, input.requestId));
	assert.ok(request);
	const reviews = await database
		.select()
		.from(unitMergeReview)
		.where(eq(unitMergeReview.requestId, input.requestId));
	assert.ok(
		[request.proposerAuthUserId, ...reviews.map((review) => review.reviewerAuthUserId)].includes(
			input.targetAuthUserId,
		),
	);
	const [reviewer] = await database
		.select({
			authUserId: unitMergeReview.reviewerAuthUserId,
			profileId: unitMergeReview.reviewerProfileId,
			revision: authEntity.revision,
		})
		.from(unitMergeReview)
		.innerJoin(authEntity, eq(authEntity.authUserId, unitMergeReview.reviewerAuthUserId))
		.where(
			and(
				eq(unitMergeReview.requestId, input.requestId),
				ne(unitMergeReview.reviewerAuthUserId, input.targetAuthUserId),
			),
		)
		.limit(1);
	assert.ok(reviewer);
	await database
		.insert(platformCapabilityGrant)
		.values({
			authUserId: reviewer.authUserId,
			capability: "platform.user.status.update",
			grantedByAuthUserId: reviewer.authUserId,
		})
		.onConflictDoNothing();
	const rules = await database
		.select({
			sourceRealmId: governanceDecisionRule.ruleSourceRealmId,
			revisionId: governanceDecisionRule.ruleRevisionId,
			ruleId: governanceDecisionRule.ruleId,
		})
		.from(governanceDecisionRule)
		.where(eq(governanceDecisionRule.decisionId, request.decisionId));
	const [before] = await database
		.select()
		.from(userAccountState)
		.where(eq(userAccountState.userId, input.targetAuthUserId));
	return replacePlatformUserAccountState({
		authorization: new Authorization(reviewer.profileId, reviewer.authUserId, {
			principal: { kind: "auth", authUserId: reviewer.authUserId },
			actingEntityId: reviewer.profileId,
			authorizationRevision: reviewer.revision,
		}),
		targetUserId: input.targetAuthUserId,
		command: { state: input.state, expectedRevision: before?.revision ?? 0, rules },
	});
}
