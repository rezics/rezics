import { and, desc, eq } from "drizzle-orm";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { realmMember, realmRuleAcceptance, realmRuleRevision } from "../database/schema";

export async function findRealmMembership(
	realmId: string,
	profileId: string,
	executor: DatabaseExecutor = database,
) {
	const row = (
		await executor
			.select({
				realmId: realmMember.realmId,
				profileId: realmMember.profileId,
				state: realmMember.state,
				joinedAt: realmMember.joinedAt,
				updatedAt: realmMember.updatedAt,
			})
			.from(realmMember)
			.where(and(eq(realmMember.realmId, realmId), eq(realmMember.profileId, profileId)))
			.limit(1)
	)[0];
	return row;
}

export type RealmMembership = NonNullable<Awaited<ReturnType<typeof findRealmMembership>>>;

export async function getCurrentRealmRules(realmId: string, executor: DatabaseExecutor = database) {
	return (
		await executor
			.select({
				revisionId: realmRuleRevision.id,
				version: realmRuleRevision.version,
				acknowledgementMode: realmRuleRevision.acknowledgementMode,
				requireOnJoin: realmRuleRevision.requireOnJoin,
				requireOnPost: realmRuleRevision.requireOnPost,
			})
			.from(realmRuleRevision)
			.where(eq(realmRuleRevision.realmId, realmId))
			.orderBy(desc(realmRuleRevision.version))
			.limit(1)
	)[0];
}

export async function acknowledgeCurrentRealmRulesOnFollow(
	tx: DatabaseTransaction,
	realmId: string,
	profileId: string,
): Promise<void> {
	const [rules] = await tx
		.select({
			revisionId: realmRuleRevision.id,
			acknowledgementMode: realmRuleRevision.acknowledgementMode,
		})
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, realmId))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (rules?.acknowledgementMode !== "implicit_on_follow") return;
	await tx
		.insert(realmRuleAcceptance)
		.values({ revisionId: rules.revisionId, profileId, language: null })
		.onConflictDoNothing();
}
