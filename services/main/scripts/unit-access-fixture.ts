import assert from "node:assert/strict";
import type { DatabaseTransaction } from "../src/services/database";
import { realm, realmRule, realmRuleRevision } from "../src/services/database/schema/realm";
import { createGovernanceDecision } from "../src/services/governance/decision-service";

/** Supply real finalized rule-backed evidence for an isolated restriction fixture. */
export async function createFixtureRestrictionDecision(
	tx: DatabaseTransaction,
	input: { authUserId: string; selfEntityId: string; targetId: string },
) {
	const [source] = await tx.insert(realm).values({}).returning({ id: realm.id });
	assert.ok(source);
	const [revision] = await tx
		.insert(realmRuleRevision)
		.values({
			realmId: source.id,
			version: 1,
			createdByProfileId: input.selfEntityId,
			publishedAt: new Date(),
		})
		.returning({ id: realmRuleRevision.id });
	assert.ok(revision);
	const [rule] = await tx
		.insert(realmRule)
		.values({ revisionId: revision.id, position: 0 })
		.returning({ id: realmRule.id });
	assert.ok(rule);
	return createGovernanceDecision(tx, {
		action: "unit.access.restrict",
		actorProfileId: input.selfEntityId,
		authority: { kind: "realm", realmId: source.id },
		targetUnitId: input.targetId,
		subject: { kind: "unit_access_profile", id: input.authUserId },
		basis: {
			kind: "rules",
			rules: [{ sourceRealmId: source.id, revisionId: revision.id, ruleId: rule.id }],
		},
	});
}
