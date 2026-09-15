import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { accessGroup, accessGroupEvent, accessGroupTree } from "../database/schema/access-group";
import { accessRoleBindingScope } from "../database/schema/access-role-binding";
import { applyAccessGroupCommand, readAccessGroupSnapshot, type AccessGroupCommand } from "./groups";
import { readManagementAuthority, ManagementAuthorityUnavailable } from "./management-authority";
import { scopeLifecycleAdmission } from "./scope-policy";
import { requireAccessAdmission, runAccessTransaction } from "./transaction";
import { AccessRecordUnavailable } from "./http-errors";

/** Private attribution comes exclusively from live server-owned authority. @internal */
export type ManagedGroupCommand = AccessGroupCommand extends infer Command
	? Command extends AccessGroupCommand ? Omit<Command, "operatorAuthUserId" | "authoritySubjectId"> : never
	: never;

async function groupAuthority(tx: DatabaseTransaction, context: PrincipalRequestContext, scopeId: string,
	groupId: string | undefined, operation: "read" | ManagedGroupCommand["operation"],
) {
	const mutation = operation !== "read";
	const lifecycle = await scopeLifecycleAdmission(tx, scopeId, mutation);
	// Promote both overlapping mutation fences before management/representation
	// readers can acquire shared locks on either through their own Group membership.
	const query = tx.select({ id: accessRoleBindingScope.scopeId }).from(accessRoleBindingScope)
		.where(eq(accessRoleBindingScope.scopeId, scopeId));
	const [bindingFence] = mutation ? await query.for("update") : await query.for("share");
	if (!bindingFence) throw new ManagementAuthorityUnavailable();
	if (mutation) await tx.insert(accessGroupTree).values({ scopeId }).onConflictDoNothing();
	const treeQuery = tx.select({ id: accessGroupTree.scopeId }).from(accessGroupTree).where(eq(accessGroupTree.scopeId, scopeId));
	if (mutation) await treeQuery.for("update");
	else await treeQuery.for("share");
	return readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
		path: groupId === undefined ? ["groups"] : ["groups", groupId], permission: `access.group.${operation}`,
		apiPermission: mutation ? "access:manage" : "access:read", requireFreshSession: operation === "reparent" || operation === "retire", mutation }, lifecycle);
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
 * impact needs the still-unimplemented ceiling and protected recovery owners;
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
 * @remarks Reparent/retire currently admit only dependency-free empty leaves.
 * Populated topology impact remains unavailable pending ceiling/recovery management.
 */
export async function writeManagedGroup(context: PrincipalRequestContext, input: ManagedGroupCommand) {
	return runAccessTransaction(async tx => {
		const authority = await groupAuthority(tx, context, input.scopeId, input.groupId, input.operation);
		return applyAccessGroupCommand(tx, { ...input, operatorAuthUserId: authority.principalId, authoritySubjectId: authority.subjectId },
			authority.admission, input.operation === "reparent" || input.operation === "retire"
				? emptyLeafTransitionAdmission(input.scopeId, input.groupId) : authority.admission);
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
