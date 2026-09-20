import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { PrincipalRequestContext } from "../auth/principal-context";
import type { DatabaseTransaction } from "../database";
import { accessGroupImpactEvaluation as evaluations, accessGroupImpactEffect as effects } from "@rezics/schema/postgres/access/access-group-impact";
import { lockCompleteGroupImpactDiscovery, readGroupImpactFacts, revalidateGroupImpactDiscovery, retainGroupImpactWitness,
	observeGroupImpactTimes, GroupImpactDiscoveryStop, type GroupImpactReview } from "./group-impact-discovery";
import { compileGroupImpactDelta, GroupImpactEffectSchema, GroupImpactDeltaUnavailable, type GroupImpactEffect } from "./group-impact-delta";
import { findRoleAssignmentCeiling } from "./assignment-ceilings";
import { AccessPermissionSnapshotUnavailable } from "./permission";
import { AccessChanged, AccessDenied, AccessUnavailable } from "./http-errors";
import { readGroupImpactConferAuthority, readGroupImpactCurrentPolicy, type GroupImpactCurrentPolicy } from "./group-impact-policy";
import { requireAccessAdmission } from "./transaction";
import { ManagementAuthorityDenied, ManagementAuthorityUnavailable, type readManagementAuthority } from "./management-authority";

type Evaluation = typeof evaluations.$inferSelect;
type Authority = Awaited<ReturnType<typeof readManagementAuthority>>;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const noPolicy: GroupImpactCurrentPolicy = { outcome: "unavailable",reason: "not-evaluated",validUntil: null,subjects: [],restrictions: [] };
/** Exact private authority source identity for retained approvals and recovery. @internal */
export function groupAuthoritySourceDigest(authority: Authority) {
	return digest({ scopeId: authority.scopeId,path: authority.path,permission: authority.permission,principalId: authority.principalId,subjectId: authority.subjectId,selection: authority.selection,
		sourceEvidence: authority.sourceEvidence,bindingId: authority.sourceBindingId,termsRevision: authority.sourceBinding?.terms.revision ?? null,roleVersion: authority.sourceBinding?.roleVersion ?? null,roleRevision: authority.sourceBinding?.roleRevision ?? null,representationPath: authority.representationPath });
}
async function completeReview(tx: DatabaseTransaction, review: GroupImpactReview) {
	return lockCompleteGroupImpactDiscovery(tx,{ reviewId: review.id,scopeId: review.scopeId,groupId: review.groupId,
		principalId: review.operatorAuthUserId,subjectId: review.authoritySubjectId,operation: review.operation,
		expectedGroupVersion: review.expectedGroupVersion,expectedTreeVersion: review.expectedTreeVersion,proposedParentId: review.proposedParentId });
}
async function persist(tx: DatabaseTransaction, evaluation: Evaluation) {
	await tx.update(evaluations).set({ status: evaluation.status,reason: evaluation.reason,pageVersion: evaluation.pageVersion,cursor: evaluation.cursor,
		effectCount: evaluation.effectCount,byteCount: evaluation.byteCount,effectDigest: evaluation.effectDigest }).where(eq(evaluations.reviewId,evaluation.reviewId));
}
async function validate(tx: DatabaseTransaction, review: GroupImpactReview, evaluation: Evaluation, authority: Authority) {
	await revalidateGroupImpactDiscovery(tx,review);
	if (review.status !== "complete") {
		evaluation.status = review.status === "invalidated" ? "invalidated" : "unavailable"; evaluation.reason = review.reason ?? "discovery-incomplete";
	} else if (evaluation.managerDigest !== groupAuthoritySourceDigest(authority)) {
		evaluation.status = "invalidated"; evaluation.reason = "manager-sources-changed";
	}
	await persist(tx,evaluation);
}
function summary(review: GroupImpactReview, evaluation: Evaluation, policy: GroupImpactCurrentPolicy = noPolicy) {
	return { reviewId: review.id,status: evaluation.status,reason: evaluation.reason,pageVersion: evaluation.pageVersion,
		processedEffects: evaluation.cursor,totalEffects: evaluation.effectCount,validUntil: new Date(Math.min(review.validUntil.getTime(),policy.validUntil ?? Infinity)).toISOString(),
		delta: (evaluation.byteCount === 0 || evaluation.reason === "missing" || evaluation.status === "invalidated") ? "unavailable" as const : "complete" as const,
		currentPolicy: policy.outcome,policyReason: policy.reason,admission: "not-admitted" as const };
}
async function readEffects(tx: DatabaseTransaction, evaluation: Evaluation) {
	const rows = await tx.select().from(effects).where(eq(effects.reviewId,evaluation.reviewId)).orderBy(effects.ordinal).limit(4097);
	if (rows.length !== evaluation.effectCount || rows.some((row,index) => row.ordinal !== index+1)) throw new GroupImpactDeltaUnavailable("missing");
	const payloads = rows.map(row => {
		const parsed = GroupImpactEffectSchema.safeParse(row.payload);
		if (!parsed.success) throw new GroupImpactDeltaUnavailable("missing");
		if ((row.decision === "covered" && (!parsed.data.confer || parsed.data.kind !== "binding" || row.ceilingId === null)) ||
			(row.decision === "approval-required" && (!parsed.data.confer || parsed.data.kind === "binding")) ||
			(row.decision !== "covered" && row.ceilingId !== null) || (row.decision === "not-required" && parsed.data.confer) ||
			(row.ordinal > evaluation.cursor && row.decision !== "pending")) throw new GroupImpactDeltaUnavailable("missing");
		return parsed.data;
	});
	if (digest(payloads) !== evaluation.effectDigest || Buffer.byteLength(JSON.stringify(payloads),"utf8") !== evaluation.byteCount) throw new GroupImpactDeltaUnavailable("missing");
	if (rows.some(row => row.ordinal <= evaluation.cursor && row.decision === "pending") ||
		(evaluation.status === "complete" && (evaluation.cursor !== evaluation.effectCount || rows.some(row => !["covered","not-required","approval-required"].includes(row.decision))))) throw new GroupImpactDeltaUnavailable("missing");
	return { rows,payloads };
}
async function observeAuthority(tx: DatabaseTransaction, review: GroupImpactReview, authority: Authority) {
	if (authority.sourceBindingId) await retainGroupImpactWitness(tx,review,"binding",authority.sourceBindingId);
	if (authority.sourceBinding) {
		const source = authority.sourceBinding;
		await retainGroupImpactWitness(tx,review,"role",source.binding.roleId);
		await retainGroupImpactWitness(tx,review,"tree",source.binding.targetScopeId);
		if (source.binding.recipientScopeId) await retainGroupImpactWitness(tx,review,"tree",source.binding.recipientScopeId);
		if (source.terms.membershipId) await retainGroupImpactWitness(tx,review,"membership",source.terms.membershipId);
		if (source.terms.selectionGroupId) await retainGroupImpactWitness(tx,review,"group",source.terms.selectionGroupId);
	}
	for (const reference of authority.representationPath) await retainGroupImpactWitness(tx,review,"representation",reference.id);
	if (authority.validUntil !== null) review.validUntil = new Date(Math.min(review.validUntil.getTime(),authority.validUntil));
}
async function findCeiling(tx: DatabaseTransaction, review: GroupImpactReview, effect: GroupImpactEffect, subjectId: string) {
	if (effect.scopeId === null || effect.roleId === null) throw new GroupImpactDeltaUnavailable("missing");
	// Retain absence at the authority root before discovering manager candidates.
	await retainGroupImpactWitness(tx,review,"binding-scope",effect.scopeId);
	const paths = effect.afterPaths.filter(path => path.membershipId !== null && path.generation !== null);
	// A scope-member approval must keep one exact admission; the same subject cannot
	// gain coverage by unioning admissions or approvals from different scopes.
	const eligibility = paths[0];
	return findRoleAssignmentCeiling(tx,{ scopeId: effect.scopeId,roleId: effect.roleId,targetPath: effect.targetPath,operation: "bind",
		permissions: effect.after,validFrom: new Date(effect.validFrom),validUntil: effect.validUntil === null ? null : new Date(effect.validUntil),
		recipient: { kind: "subject",subjectId: effect.subjectId },managerSubjectId: subjectId,recipientGroupEffect: effect.recipientGroup,
		recipientEligibility: eligibility?.membershipId && eligibility.generation ? { membershipId: eligibility.membershipId,generation: eligibility.generation } : null,
	},async ({ manager,approvals,memberScopes,memberships,recipientMemberSets }) => {
		for (const scopeId of [...new Set([...manager.recipientScopes,...memberScopes])].sort()) await retainGroupImpactWitness(tx,review,"tree",scopeId);
		for (const member of [...manager.memberships,...memberships,...(recipientMemberSets?.memberships ?? [])]) await retainGroupImpactWitness(tx,review,"membership",member.id);
		for (const source of manager.bindings) {
			await retainGroupImpactWitness(tx,review,"binding",source.binding.id);
			await retainGroupImpactWitness(tx,review,"role",source.binding.roleId);
			if (source.terms.membershipId) await retainGroupImpactWitness(tx,review,"membership",source.terms.membershipId);
			if (source.terms.selectionGroupId) await retainGroupImpactWitness(tx,review,"group",source.terms.selectionGroupId);
			observeGroupImpactTimes(review,{ valid_from: source.terms.validFrom.toISOString(),valid_until: source.terms.validUntil?.toISOString() ?? null });
		}
		for (const { approval } of approvals) {
			await retainGroupImpactWitness(tx,review,"ceiling",approval.id);
			observeGroupImpactTimes(review,{ valid_from: approval.validFrom.toISOString(),valid_until: approval.validUntil?.toISOString() ?? null,grant_not_after: approval.grantNotAfter?.toISOString() ?? null });
		}
	});
}
function unavailableReason(error: unknown): string | null {
	if (error instanceof GroupImpactDeltaUnavailable || error instanceof GroupImpactDiscoveryStop) return error.reason;
	if (error instanceof AccessPermissionSnapshotUnavailable || error instanceof z.ZodError) return "missing";
	return null;
}

/**
 * Initialize one atomic complete delta, then resume at most sixteen confer effects per request.
 * @internal
 * @remarks This is production evaluation, not mutation admission. No SQL truth value
 * is returned. Representation/ceiling expansion effects retain an explicit independent-approval
 * requirement; losses also reach protected-recovery admission. Current policies
 * are reloaded when consuming complete evaluation, never cached as durable authority.
 */
export async function advanceGroupImpactEvaluation(tx: DatabaseTransaction, context: PrincipalRequestContext,
	review: GroupImpactReview, authority: Authority, expectedPageVersion: number) {
	await completeReview(tx,review);
	let [evaluation] = await tx.select().from(evaluations).where(eq(evaluations.reviewId,review.id)).for("update");
	if (!evaluation) {
		if (expectedPageVersion !== 0) throw new AccessChanged();
		const [created] = await tx.insert(evaluations).values({ reviewId: review.id,status: "evaluating",managerDigest: groupAuthoritySourceDigest(authority),effectDigest: digest([]) }).returning();
		if (!created) throw new AccessUnavailable(); evaluation = created;
		try {
			await tx.transaction(async work => {
				const facts: Awaited<ReturnType<typeof readGroupImpactFacts>> = [];
				while (facts.length < review.factCount) {
					const page = await readGroupImpactFacts(work,review.id,facts.at(-1)?.ordinal ?? 0);
					if (!page.length) throw new GroupImpactDeltaUnavailable("missing"); facts.push(...page);
				}
				const delta = compileGroupImpactDelta(review,facts), bytes = Buffer.byteLength(JSON.stringify(delta),"utf8");
				if (bytes > 16*1024*1024) throw new GroupImpactDeltaUnavailable("budget");
				// One complete delta or no delta rows. An interrupted build can be retried.
				for (let offset = 0; offset < delta.length; offset += 100) await work.insert(effects).values(delta.slice(offset,offset+100)
					.map((payload,index) => ({ id: randomUUID(),reviewId: review.id,ordinal: offset+index+1,payload })));
				evaluation!.effectCount = delta.length; evaluation!.byteCount = bytes; evaluation!.effectDigest = digest(delta);
				await persist(work,evaluation!);
			});
		} catch (error) {
			const reason = unavailableReason(error); if (!reason) throw error;
			evaluation.status = "unavailable"; evaluation.reason = reason; evaluation.effectCount = 0; evaluation.byteCount = 0; evaluation.effectDigest = digest([]);
			await persist(tx,evaluation);
		}
	}
	await validate(tx,review,evaluation,authority);
	if (expectedPageVersion > evaluation.pageVersion) throw new AccessChanged();
	if (evaluation.status !== "evaluating" || expectedPageVersion < evaluation.pageVersion) {
		if (evaluation.byteCount > 0) await readEffects(tx,evaluation);
		return summary(review,evaluation);
	}
	const { rows,payloads } = await readEffects(tx,evaluation);
	const next = { ...evaluation }, nextReview = { ...review };
	try {
		await tx.transaction(async work => {
			await observeAuthority(work,nextReview,authority);
			for (const row of rows.slice(next.cursor,next.cursor+16)) {
				const effect = payloads[row.ordinal-1]!;
				let decision: typeof row.decision = "not-required", reason: string | null = null, ceilingId: string | null = null;
				if (effect.confer) {
					if (effect.kind !== "binding") {
						const sources = await readGroupImpactConferAuthority(work,context,[effect]);
						for (const source of sources) { await observeAuthority(work,nextReview,source); await requireAccessAdmission(work,source.admission); }
						decision = "approval-required";
					} else {
						try {
							const sources = await readGroupImpactConferAuthority(work,context,[effect]);
							for (const source of sources) { await observeAuthority(work,nextReview,source); await requireAccessAdmission(work,source.admission); }
							ceilingId = await findCeiling(work,nextReview,effect,authority.subjectId);
							decision = ceilingId === null ? "denied" : "covered"; reason = ceilingId === null ? "explicit-ceiling-required" : null;
						} catch (error) {
							if (error instanceof ManagementAuthorityDenied) { decision = "denied"; reason = "manager-authority"; }
							else if (error instanceof ManagementAuthorityUnavailable) { decision = "unavailable"; reason = "manager-authority"; }
							else throw error;
						}
					}
				}
				await work.update(effects).set({ decision,reason,ceilingId }).where(eq(effects.id,row.id)); next.cursor = row.ordinal;
			}
			next.pageVersion++;
			if (next.cursor === next.effectCount) {
				const decisions = await work.select({ decision: effects.decision }).from(effects).where(eq(effects.reviewId,review.id));
				if (decisions.some(row => row.decision === "pending")) throw new GroupImpactDeltaUnavailable("missing");
				next.status = decisions.some(row => row.decision === "unavailable") ? "unavailable" : decisions.some(row => row.decision === "denied") ? "denied" : "complete";
				next.reason = next.status === "unavailable" ? "approval-owner-required" : next.status === "denied" ? "explicit-ceiling-required" : null;
			}
			await revalidateGroupImpactDiscovery(work,nextReview);
			if (nextReview.status !== "complete") { next.status = "invalidated"; next.reason = nextReview.reason; }
			await requireAccessAdmission(work,authority.admission); await persist(work,next);
		});
		Object.assign(evaluation,next); Object.assign(review,nextReview);
	} catch (error) {
		const reason = unavailableReason(error); if (!reason) throw error;
		evaluation.status = "unavailable"; evaluation.reason = reason; await persist(tx,evaluation);
	}
	return summary(review,evaluation);
}

/** Private bounded inspection; current policies are loaded independently of cached ceiling progress. @internal */
export async function inspectGroupImpactEvaluation(tx: DatabaseTransaction, context: PrincipalRequestContext,
	review: GroupImpactReview, authority: Authority, afterOrdinal = 0) {
	const [evaluation] = await tx.select().from(evaluations).where(eq(evaluations.reviewId,review.id)).for("update");
	if (!evaluation) throw new AccessUnavailable();
	await validate(tx,review,evaluation,authority);
	let policy = noPolicy;
	if (review.status === "complete" && evaluation.byteCount > 0 && evaluation.status !== "invalidated") {
		await completeReview(tx,review);
		const { payloads } = await readEffects(tx,evaluation);
		const sources = evaluation.status === "complete" ? await readGroupImpactConferAuthority(tx,context,payloads) : [];
		try { policy = await readGroupImpactCurrentPolicy(tx,payloads); }
		catch (error) {
			const reason = unavailableReason(error);
			if (!reason) throw error;
			policy = { ...noPolicy,reason };
		}
		for (const source of sources) { await observeAuthority(tx,review,source); await requireAccessAdmission(tx,source.admission); }
		await revalidateGroupImpactDiscovery(tx,review);
		await requireAccessAdmission(tx,authority.admission);
		await validate(tx,review,evaluation,authority);
	}
	const rows = await tx.select().from(effects).where(and(eq(effects.reviewId,review.id),gt(effects.ordinal,afterOrdinal))).orderBy(effects.ordinal).limit(101);
	const items = rows.slice(0,100).map(row => {
		const parsed = GroupImpactEffectSchema.safeParse(row.payload);
		if (!parsed.success) throw new GroupImpactDeltaUnavailable("missing");
		const value = parsed.data;
		return { itemId: row.id,ordinal: row.ordinal,kind: value.kind,beforePermissions: value.before.length,afterPermissions: value.after.length,
			beforePaths: value.beforePaths.length,afterPaths: value.afterPaths.length,confer: value.confer,decision: row.decision,reason: row.reason };
	});
	return { ...summary(review,evaluation,policy),items,nextCursor: rows.length > 100 ? items.at(-1)?.ordinal ?? null : null };
}

/**
 * Exact private handoff for protected recovery in the SAME retained transaction.
 * @internal
 * @remarks The recovery owner first promotes the full mutation fence closure, calls
 * this owner and proves independent pre-change recovery/approver continuity. It must
 * revalidate the complete review, source authority, current policy and clock in the
 * final effect statement. The result deliberately has no mutation admission boolean.
 */
export async function lockCompleteGroupImpactEvaluation(tx: DatabaseTransaction, context: PrincipalRequestContext,
	review: GroupImpactReview, authority: Authority) {
	await completeReview(tx,review);
	const [evaluation] = await tx.select().from(evaluations).where(eq(evaluations.reviewId,review.id)).for("update");
	if (!evaluation) throw new AccessUnavailable();
	await validate(tx,review,evaluation,authority);
	if (evaluation.status === "denied") throw new AccessDenied();
	if (evaluation.status !== "complete") throw new AccessUnavailable();
	const { rows,payloads } = await readEffects(tx,evaluation);
	const sources = await readGroupImpactConferAuthority(tx,context,payloads);
	const policy = await readGroupImpactCurrentPolicy(tx,payloads);
	for (const source of sources) await requireAccessAdmission(tx,source.admission);
	for (const row of rows) if (row.decision === "covered" && await findCeiling(tx,review,payloads[row.ordinal-1]!,authority.subjectId) !== row.ceilingId) throw new AccessUnavailable();
	await requireAccessAdmission(tx,authority.admission);
	await revalidateGroupImpactDiscovery(tx,review);
	if (review.status !== "complete") throw new AccessUnavailable();
	return { reviewId: review.id,effectDigest: evaluation.effectDigest,effects: payloads,
		ceilings: rows.map(row => ({ ordinal: row.ordinal,ceilingId: row.ceilingId })),policy,sources,
		validUntil: new Date(Math.min(review.validUntil.getTime(),policy.validUntil ?? Infinity)),admission: "not-admitted" as const };
}

/** Complete retained evidence for an independently authorized approver; does not impersonate the reviewer. @internal */
export async function readCompleteGroupApprovalEvidence(tx: DatabaseTransaction, review: GroupImpactReview) {
 await completeReview(tx,review);
 const [evaluation] = await tx.select().from(evaluations).where(eq(evaluations.reviewId,review.id)).for("update");
 if (evaluation?.status === "denied") throw new AccessDenied();
 if (!evaluation || evaluation.status !== "complete") throw new AccessUnavailable();
 const { payloads } = await readEffects(tx,evaluation);
 return { effectDigest: evaluation.effectDigest, effects: payloads };
}
