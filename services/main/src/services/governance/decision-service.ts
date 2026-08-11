import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { OfficialRealmUnitIds } from "@rezics/slug";

import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import {
	GovernanceMaxRuleReferences,
	GovernanceMaxRuleSources,
	governanceDecision,
	governanceDecisionRule,
	realm,
	realmRule,
	realmRuleRevision,
	unit,
	zone,
} from "../database/schema";
import {
	GovernanceReversalUnavailable,
	GovernanceRuleChanged,
	GovernanceRuleSourceForbidden,
} from "../api/governance/errors";
import { currentRealmRuleRevisionReadLock } from "../realms/rule-revision-lock";

export interface GovernanceRuleReference {
	readonly sourceRealmId: string;
	readonly revisionId: string;
	readonly ruleId: string;
}

export type GovernanceAuthority =
	| { readonly kind: "platform" }
	| { readonly kind: "realm"; readonly realmId: string }
	| { readonly kind: "zone"; readonly zoneId: string }
	| { readonly kind: "unit"; readonly unitId: string };

interface GovernanceDecisionCommon {
	readonly action: string;
	readonly actorProfileId: string;
	readonly authority: GovernanceAuthority;
	readonly subject: {
		readonly kind: string;
		readonly id: string;
	};
	readonly requestId?: string;
}

export type GovernanceDecisionBasis =
	| {
			readonly kind: "rules";
			readonly rules: readonly GovernanceRuleReference[];
	  }
	| {
			readonly kind: "reversal";
			readonly reversesDecisionId: string;
	  };

export type CreateGovernanceDecisionInput = GovernanceDecisionCommon &
	(
		| {
				readonly targetUnitId: string;
				readonly targetUserId?: never;
		  }
		| {
				readonly targetUnitId?: never;
				readonly targetUserId: string;
		  }
	) & { readonly basis: GovernanceDecisionBasis };

export interface CreatedGovernanceDecision {
	readonly id: string;
	readonly rules: GovernanceRuleReference[];
}

function authorityColumns(authority: GovernanceAuthority) {
	return {
		authorityKind: authority.kind,
		authorityRealmId: authority.kind === "realm" ? authority.realmId : null,
		authorityZoneId: authority.kind === "zone" ? authority.zoneId : null,
		authorityUnitId: authority.kind === "unit" ? authority.unitId : null,
	};
}

function authorityMatches(
	authority: GovernanceAuthority,
	row: {
		readonly authorityKind: "platform" | "realm" | "zone" | "unit";
		readonly authorityRealmId: string | null;
		readonly authorityZoneId: string | null;
		readonly authorityUnitId: string | null;
	},
): boolean {
	if (authority.kind !== row.authorityKind) return false;
	if (authority.kind === "platform") return true;
	if (authority.kind === "realm") return authority.realmId === row.authorityRealmId;
	if (authority.kind === "zone") return authority.zoneId === row.authorityZoneId;
	return authority.unitId === row.authorityUnitId;
}

/** Resolves the only Rule Realms that the server will accept for an authority. */
export async function resolveGovernanceRuleSourceRealmIds(
	tx: DatabaseTransaction,
	authority: GovernanceAuthority,
): Promise<readonly string[]> {
	if (authority.kind === "realm") {
		const [record] = await tx
			.select({ id: realm.id })
			.from(realm)
			.where(eq(realm.id, authority.realmId))
			.limit(1);
		if (!record) throw new GovernanceRuleSourceForbidden();
		return [...new Set([OfficialRealmUnitIds.rule, authority.realmId])].sort();
	}
	if (authority.kind === "zone") {
		const [record] = await tx
			.select({ localRuleRealmId: zone.localRuleRealmId })
			.from(zone)
			.where(eq(zone.id, authority.zoneId))
			.limit(1)
			.for("share");
		if (!record) throw new GovernanceRuleSourceForbidden();
		return [
			...new Set([
				OfficialRealmUnitIds.rule,
				...(record?.localRuleRealmId ? [record.localRuleRealmId] : []),
			]),
		].sort();
	}
	return [OfficialRealmUnitIds.rule];
}

/**
 * Locks each source in stable order and proves every selected Rule belongs to
 * that source's current immutable revision.
 */
export async function validateGovernanceRuleReferences(
	tx: DatabaseTransaction,
	input: {
		readonly authority: GovernanceAuthority;
		readonly rules: readonly GovernanceRuleReference[];
	},
): Promise<GovernanceRuleReference[]> {
	const rules = [...input.rules].sort((left, right) =>
		left.sourceRealmId === right.sourceRealmId
			? left.ruleId.localeCompare(right.ruleId)
			: left.sourceRealmId.localeCompare(right.sourceRealmId),
	);
	if (rules.length < 1 || rules.length > GovernanceMaxRuleReferences)
		throw new GovernanceRuleChanged();
	if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length)
		throw new GovernanceRuleChanged();

	const sourceRealmIds = [...new Set(rules.map((rule) => rule.sourceRealmId))].sort();
	if (sourceRealmIds.length > GovernanceMaxRuleSources) throw new GovernanceRuleSourceForbidden();
	const allowedSourceRealmIds = new Set(
		await resolveGovernanceRuleSourceRealmIds(tx, input.authority),
	);
	if (sourceRealmIds.some((sourceRealmId) => !allowedSourceRealmIds.has(sourceRealmId)))
		throw new GovernanceRuleSourceForbidden();

	for (const sourceRealmId of sourceRealmIds)
		await tx.execute(currentRealmRuleRevisionReadLock(sourceRealmId));

	for (const sourceRealmId of sourceRealmIds) {
		const sourceRules = rules.filter((rule) => rule.sourceRealmId === sourceRealmId);
		const [currentRevision] = await tx
			.select({ id: realmRuleRevision.id })
			.from(realmRuleRevision)
			.innerJoin(
				unit,
				and(eq(unit.id, realmRuleRevision.realmId), eq(unit.kind, "realm"), isNull(unit.deletedAt)),
			)
			.where(eq(realmRuleRevision.realmId, sourceRealmId))
			.orderBy(desc(realmRuleRevision.version))
			.limit(1)
			.for("share");
		if (!currentRevision || sourceRules.some((rule) => rule.revisionId !== currentRevision.id))
			throw new GovernanceRuleChanged();
		const selectedRules = await tx
			.select({ id: realmRule.id })
			.from(realmRule)
			.where(
				and(
					eq(realmRule.revisionId, currentRevision.id),
					inArray(
						realmRule.id,
						sourceRules.map((rule) => rule.ruleId),
					),
				),
			);
		if (selectedRules.length !== sourceRules.length) throw new GovernanceRuleChanged();
	}
	return rules;
}

/** Appends one decision and its immutable Rule basis inside the caller's transaction. */
export async function createGovernanceDecision(
	tx: DatabaseTransaction,
	input: CreateGovernanceDecisionInput,
): Promise<CreatedGovernanceDecision> {
	let rules: GovernanceRuleReference[] = [];
	if (input.basis.kind === "rules")
		rules = await validateGovernanceRuleReferences(tx, {
			authority: input.authority,
			rules: input.basis.rules,
		});

	if (input.basis.kind === "reversal") {
		const [reversed] = await tx
			.select({
				id: governanceDecision.id,
				targetUnitId: governanceDecision.targetUnitId,
				targetUserId: governanceDecision.targetUserId,
				subjectKind: governanceDecision.subjectKind,
				subjectId: governanceDecision.subjectId,
				authorityKind: governanceDecision.authorityKind,
				authorityRealmId: governanceDecision.authorityRealmId,
				authorityZoneId: governanceDecision.authorityZoneId,
				authorityUnitId: governanceDecision.authorityUnitId,
			})
			.from(governanceDecision)
			.where(eq(governanceDecision.id, input.basis.reversesDecisionId))
			.for("update")
			.limit(1);
		const [existingReversal] = await tx
			.select({ id: governanceDecision.id })
			.from(governanceDecision)
			.where(eq(governanceDecision.reversesDecisionId, input.basis.reversesDecisionId))
			.limit(1);
		if (
			!reversed ||
			existingReversal ||
			reversed.targetUnitId !== (input.targetUnitId ?? null) ||
			reversed.targetUserId !== (input.targetUserId ?? null) ||
			reversed.subjectKind !== input.subject.kind ||
			reversed.subjectId !== input.subject.id ||
			!authorityMatches(input.authority, reversed)
		)
			throw new GovernanceReversalUnavailable();
	}

	const [decision] = await tx
		.insert(governanceDecision)
		.values({
			action: input.action,
			basisKind: input.basis.kind,
			actorProfileId: input.actorProfileId,
			...authorityColumns(input.authority),
			targetUnitId: input.targetUnitId ?? null,
			targetUserId: input.targetUserId ?? null,
			subjectKind: input.subject.kind,
			subjectId: input.subject.id,
			reversesDecisionId: input.basis.kind === "reversal" ? input.basis.reversesDecisionId : null,
			requestId: input.requestId,
		})
		.returning({ id: governanceDecision.id });
	if (!decision) throw new Error("Governance decision insertion returned no row");
	if (rules.length)
		await tx.insert(governanceDecisionRule).values(
			rules.map((rule) => ({
				decisionId: decision.id,
				ruleSourceRealmId: rule.sourceRealmId,
				ruleRevisionId: rule.revisionId,
				ruleId: rule.ruleId,
			})),
		);
	await tx
		.update(governanceDecision)
		.set({ finalized: true })
		.where(eq(governanceDecision.id, decision.id));
	return { id: decision.id, rules };
}

export async function listGovernanceDecisionRules(
	tx: DatabaseExecutor,
	decisionId: string,
): Promise<GovernanceRuleReference[]> {
	return tx
		.select({
			sourceRealmId: governanceDecisionRule.ruleSourceRealmId,
			revisionId: governanceDecisionRule.ruleRevisionId,
			ruleId: governanceDecisionRule.ruleId,
		})
		.from(governanceDecisionRule)
		.where(eq(governanceDecisionRule.decisionId, decisionId))
		.orderBy(governanceDecisionRule.ruleSourceRealmId, governanceDecisionRule.ruleId);
}
