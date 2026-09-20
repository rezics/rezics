import { lockGroupAdmissionClosure, prepareGroupAdmission } from "./group-admission";
import { accessGroupAdmissionReceipt } from "@rezics/schema/postgres/access/access-group-admission";
import { advanceGroupImpactEvaluation, inspectGroupImpactEvaluation } from "./group-impact-evaluation";
import type { z } from "zod";
import { groupImpactPermission, beginGroupImpactDiscovery, advanceGroupImpactDiscovery, inspectGroupImpactDiscovery, lockGroupImpactReview, groupImpactSummary, type GroupImpactProposalSchema } from "./group-impact-discovery";
import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import type { PrincipalRequestContext } from "../auth/principal-context";
import type { DatabaseTransaction } from "../database";
import { accessGroup, accessGroupEvent, accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { accessRoleBindingScope } from "@rezics/schema/postgres/access/access-role-binding";
import { AccessGroupConflict, applyAccessGroupCommand, readAccessGroupSnapshot, type AccessGroupCommand } from "./groups";
import { readManagementAuthority, ManagementAuthorityUnavailable } from "./management-authority";
import { scopeLifecycleAdmission } from "./scope-policy";
import { requireAccessAdmission, runAccessTransaction } from "./transaction";
import { AccessRecordUnavailable } from "./http-errors";

type GroupImpactProposal = z.infer<typeof GroupImpactProposalSchema>;

/** Private attribution comes exclusively from live server-owned authority. @internal */
export type ManagedGroupCommand = AccessGroupCommand extends infer Command
	? Command extends AccessGroupCommand ? Omit<Command, "operatorAuthUserId" | "authoritySubjectId"> & { reviewId?: string } : never
	: never;

/** Current Group authority under promoted native mutation fences. @internal */
export async function groupAuthority(tx: DatabaseTransaction, context: PrincipalRequestContext, scopeId: string,
	groupId: string | undefined, operation: "read" | "assign" | "remove" | "prune" | ManagedGroupCommand["operation"], promote = false,
) {
	const mutation = operation !== "read", exclusive = mutation || promote;
	const lifecycle = await scopeLifecycleAdmission(tx, scopeId, mutation);
	// Promote both overlapping mutation fences before management/representation
	// readers can acquire shared locks on either through their own Group membership.
	const query = tx.select({ id: accessRoleBindingScope.scopeId }).from(accessRoleBindingScope)
		.where(eq(accessRoleBindingScope.scopeId, scopeId));
	const [bindingFence] = exclusive ? await query.for("update") : await query.for("share");
	if (!bindingFence) throw new ManagementAuthorityUnavailable();
	if (mutation) await tx.insert(accessGroupTree).values({ scopeId }).onConflictDoNothing();
	const treeQuery = tx.select({ id: accessGroupTree.scopeId }).from(accessGroupTree).where(eq(accessGroupTree.scopeId, scopeId));
	if (exclusive) await treeQuery.for("update");
	else await treeQuery.for("share");
	return readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
		path: groupId === undefined ? ["groups"] : ["groups", groupId], permission: operation === "assign" || operation === "remove" || operation === "prune" ? groupImpactPermission(operation) : `access.group.${operation}`,
		apiPermission: mutation ? "access:manage" : "access:read", requireFreshSession: operation === "reparent" || operation === "retire" || operation === "assign" || operation === "remove" || operation === "prune", mutation }, lifecycle);
}

/**
 * A sufficient, bounded proof that one leaf transition changes no recipient authority.
 * @internal
 * @remarks Evaluated by the primitive only after the exclusive tree AND Group head
 * fences. The head's FOR UPDATE conflicts with FK key-share locks on new references;
 * the tree prevents existing direct selections or topology from changing. All
 * Group-targeted binding/representation/ceiling records count, including dormant
 * records, so this does not depend on their current role or validity clocks.
 * No physical selections means exact-selection dependent grants are ineffective;
 * no active children means there are no inherited recipients. Existing recovery
 * authority is unchanged, not independently certified by this proof. Nonempty
 * impact needs complete delta/ceiling evaluation and protected recovery admission;
 * unknown admission must remain unavailable, never an implicit approval.
 */
function emptyLeafTransitionAdmission(scopeId: string, groupId: string): SQL<boolean | null> {
	return sql`nullif((
		exists(select 1 from public.access_group g where g.id=${groupId}::uuid and g.scope_id=${scopeId}::uuid and g.state='active' and g.subtree_height=1)
		and not exists(select 1 from public.access_group_membership m where m.group_id=${groupId}::uuid and m.selected)
		and not exists(select 1 from public.access_role_binding b where b.recipient_group_id=${groupId}::uuid)
		and not exists(select 1 from public.access_representation r where r.recipient_group_id=${groupId}::uuid)
		and not exists(select 1 from public.access_assignment_ceiling c where c.recipient_group_id=${groupId}::uuid)
	),false)`;
}

/**
 * Apply a versioned Group command with live authority and private audit attribution.
 * @internal
 * @remarks Populated reparent/retire consume an exact review, independent approval
 * and pre-change protected recovery proof in the same transaction as the effect.
 */
export async function writeManagedGroup(context: PrincipalRequestContext, input: ManagedGroupCommand) {
	return runAccessTransaction(async tx => {
  const { reviewId, ...command } = input;
  if (command.operation !== "create") await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId,input.scopeId)).for("update");
  // Replay still uses the primitive's exact command digest and live manager authority.
  // Do not reopen a consumed review whose own successful effect invalidated its tree.
  const [prior] = await tx.select().from(accessGroupEvent).where(and(eq(accessGroupEvent.groupId,input.groupId),eq(accessGroupEvent.operationId,input.operationId)));
  const topology = command.operation === "reparent" || command.operation === "retire";
  const review = topology && reviewId && !prior ? await lockGroupAdmissionClosure(tx,context,{ scopeId: input.scopeId,groupId: input.groupId,reviewId }) : null;
  const authority = await groupAuthority(tx, context, input.scopeId, input.groupId, input.operation);
  if (prior) {
   const [admitted] = await tx.select().from(accessGroupAdmissionReceipt).where(eq(accessGroupAdmissionReceipt.operationId,input.operationId));
   if ((admitted?.reviewId ?? undefined) !== reviewId) throw new AccessGroupConflict();
  }
  const admitted = review && (command.operation === "reparent" || command.operation === "retire")
   ? await prepareGroupAdmission(tx,context,review,authority,{ operationId: command.operationId,operation: command.operation,
    expectedVersion: command.expectedVersion,parentId: command.operation === "reparent" ? command.parentId : null }) : null;
  return applyAccessGroupCommand(tx,{ ...command,operatorAuthUserId: authority.principalId,authoritySubjectId: authority.subjectId },authority.admission,
   admitted?.admission ?? (topology ? emptyLeafTransitionAdmission(input.scopeId,input.groupId) : authority.admission),admitted?.afterEffect);
	});
}

/** Exact current/historical presentation, authorized by current Group management rights. @internal */
export async function getManagedGroup(context: PrincipalRequestContext, scopeId: string, groupId: string, version?: number) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, scopeId, groupId, "read");
		const snapshot = await readAccessGroupSnapshot(tx, { scopeId, groupId, version: version ?? "current" });
		await requireAccessAdmission(tx, authority.admission);
		if (!snapshot) throw new AccessRecordUnavailable();
		return snapshot;
	});
}

/** Broad directory authority is required for a bounded scope/id keyset page. @internal */
export async function listManagedGroups(context: PrincipalRequestContext, scopeId: string, afterId?: string) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, scopeId, undefined, "read");
		const rows = await tx.select({ groupId: accessGroup.id, version: accessGroupEvent.version,
			state: accessGroupEvent.stateAfter, parentId: accessGroupEvent.parentAfterId,
			label: accessGroupEvent.label, description: accessGroupEvent.description }).from(accessGroup)
			.innerJoin(accessGroupEvent, and(eq(accessGroup.id, accessGroupEvent.groupId), eq(accessGroup.version, accessGroupEvent.version)))
			.where(and(eq(accessGroup.scopeId, scopeId), afterId === undefined ? undefined : gt(accessGroup.id, afterId)))
			.orderBy(accessGroup.id).limit(101);
		await requireAccessAdmission(tx, authority.admission);
		const page = rows.slice(0, 100);
		return { items: page, nextCursor: rows.length > 100 ? page.at(-1)?.groupId ?? null : null };
	});
}

/** Bounded immutable snapshots/receipts omit private operator and authority-subject identifiers. @internal */
export async function listManagedGroupHistory(context: PrincipalRequestContext, scopeId: string, groupId: string, afterVersion?: number) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, scopeId, groupId, "read");
		const [head] = await tx.select({ id: accessGroup.id }).from(accessGroup)
			.where(and(eq(accessGroup.id, groupId), eq(accessGroup.scopeId, scopeId))).limit(1);
		if (!head) {
			await requireAccessAdmission(tx, authority.admission);
			throw new AccessRecordUnavailable();
		}
		const rows = await tx.select({ version: accessGroupEvent.version, operationId: accessGroupEvent.operationId,
			operation: accessGroupEvent.operation, state: accessGroupEvent.stateAfter, parentId: accessGroupEvent.parentAfterId,
			label: accessGroupEvent.label, description: accessGroupEvent.description, createdAt: accessGroupEvent.createdAt })
			.from(accessGroupEvent).where(and(eq(accessGroupEvent.groupId, groupId),
				afterVersion === undefined ? undefined : gt(accessGroupEvent.version, afterVersion)))
			.orderBy(accessGroupEvent.version).limit(101);
		await requireAccessAdmission(tx, authority.admission);
		const page = rows.slice(0, 100);
		return { items: page.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
			nextCursor: rows.length > 100 ? page.at(-1)?.version ?? null : null };
	});
}

/** Live Group/tree preconditions for starting a private impact review. @internal */
export async function getManagedGroupImpactContext(context: PrincipalRequestContext, scopeId: string, groupId: string) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, scopeId, groupId, "read");
		const [group] = await tx.select({ groupVersion: accessGroup.version, state: accessGroup.state }).from(accessGroup)
			.where(and(eq(accessGroup.id, groupId), eq(accessGroup.scopeId, scopeId)));
		const [tree] = await tx.select({ treeVersion: accessGroupTree.version }).from(accessGroupTree).where(eq(accessGroupTree.scopeId, scopeId));
		await requireAccessAdmission(tx, authority.admission);
		if (!group || !tree) throw new AccessRecordUnavailable();
		return { ...group, ...tree };
	});
}

/** Private structural discovery; each request reauthorizes the original reviewer and selected subject. @internal */
export async function startManagedGroupImpact(context: PrincipalRequestContext, input: GroupImpactProposal & { scopeId: string; groupId: string }) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, input.scopeId, input.groupId, "read");
		const review = await beginGroupImpactDiscovery(tx, { ...input, principalId: authority.principalId, subjectId: authority.subjectId,
			reviewerSources: { bindingId: authority.sourceBindingId, representationIds: authority.representationPath.map(reference => reference.id), validUntil: authority.validUntil } });
		await requireAccessAdmission(tx, authority.admission);
		return groupImpactSummary(review);
	});
}

/** Advance a bounded page without accepting a client-supplied dependency cursor or approval. @internal */
export async function advanceManagedGroupImpact(context: PrincipalRequestContext, input: {
	scopeId: string; groupId: string; reviewId: string; expectedPageVersion: number;
}) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, input.scopeId, input.groupId, "read");
		const review = await lockGroupImpactReview(tx, { ...input, principalId: authority.principalId, subjectId: authority.subjectId });
		await advanceGroupImpactDiscovery(tx, review, input.expectedPageVersion);
		await requireAccessAdmission(tx, authority.admission);
		return groupImpactSummary(review);
	});
}

/** Read one currently authorized, redacted inspection page; terminal discovery states remain visible. @internal */
export async function inspectManagedGroupImpact(context: PrincipalRequestContext, input: {
	scopeId: string; groupId: string; reviewId: string; afterOrdinal?: number;
}) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, input.scopeId, input.groupId, "read");
		const review = await lockGroupImpactReview(tx, { ...input, principalId: authority.principalId, subjectId: authority.subjectId });
		const result = await inspectGroupImpactDiscovery(tx, review, input.afterOrdinal);
		await requireAccessAdmission(tx, authority.admission);
		return result;
	});
}

/** Evaluate the exact proposal under current topology-management authority and a fresh session. @internal */
export async function advanceManagedGroupImpactEvaluation(context: PrincipalRequestContext, input: {
	scopeId: string; groupId: string; reviewId: string; expectedPageVersion: number;
}) {
	return runAccessTransaction(async tx => {
		// Read attribution first; operation comes only from the private retained proposal.
		const reader = await groupAuthority(tx,context,input.scopeId,input.groupId,"read",true);
		const review = await lockGroupImpactReview(tx,{ ...input,principalId: reader.principalId,subjectId: reader.subjectId });
		const authority = await groupAuthority(tx,context,input.scopeId,input.groupId,review.operation);
		const result = await advanceGroupImpactEvaluation(tx,context,review,authority,input.expectedPageVersion);
		await requireAccessAdmission(tx,authority.admission);
		return result;
	});
}

/** Evaluation inspection is private and requires the proposal's live management authority. @internal */
export async function inspectManagedGroupImpactEvaluation(context: PrincipalRequestContext, input: {
	scopeId: string; groupId: string; reviewId: string; afterOrdinal?: number;
}) {
	return runAccessTransaction(async tx => {
		const reader = await groupAuthority(tx,context,input.scopeId,input.groupId,"read",true);
		const review = await lockGroupImpactReview(tx,{ ...input,principalId: reader.principalId,subjectId: reader.subjectId });
		const authority = await groupAuthority(tx,context,input.scopeId,input.groupId,review.operation);
		const result = await inspectGroupImpactEvaluation(tx,context,review,authority,input.afterOrdinal);
		await requireAccessAdmission(tx,authority.admission);
		return result;
	});
}
