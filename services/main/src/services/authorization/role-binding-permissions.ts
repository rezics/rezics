import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
	AccessPermissionValues,
	constrainAccessPermissions,
	snapshotAccessPermissionCeiling,
	type AccessPermission,
} from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessRole, accessRoleRevision, accessRolePermission } from "../database/schema/access-role";
import {
	accessRoleBinding,
	accessRoleBindingScope,
	accessRoleBindingRevision,
	accessRoleBindingPermission,
} from "../database/schema/access-role-binding";
import { accessMembership } from "../database/schema/access-membership";
import { accessGroupTree } from "../database/schema/access-group";
import { accessGroupMembershipSet } from "../database/schema/access-group-membership";
import { decodeAccessPermissionSnapshot } from "./permission";
import { AccessRoleBindingUnavailable } from "./role-bindings";
import { readAccessMemberSetRecipients } from "./member-set-recipients";

const discoverySchema = z.strictObject({
	subjectId: z.uuid().toLowerCase(),
	targets: z.array(z.strictObject({
		scopeId: z.uuid().toLowerCase(),
		path: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8),
	})).min(1).max(64),
	memberSets: z.array(z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("group"), scopeId: z.uuid().toLowerCase(), groupId: z.uuid().toLowerCase() }),
		z.strictObject({ kind: z.literal("all-members"), scopeId: z.uuid().toLowerCase() }),
	])).max(576),
});
const selectionSchema = z.array(z.strictObject({
	bindingId: z.uuid().toLowerCase(),
	targetScopeId: z.uuid().toLowerCase(),
	version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})).max(256).refine(rows => new Set(rows.map(row => row.bindingId)).size === rows.length,
	"Binding candidates must be unique");

/** A discovery version changed; retry the complete authority transaction and its dependency discovery. @internal */
export class AccessRoleBindingDiscoveryChanged extends Error {
	constructor() { super("Role binding candidates changed during authority discovery"); }
}

/** The complete decision cannot fit its admitted candidate work budget. @internal */
export class AccessRoleBindingBudgetExceeded extends Error {
	constructor() { super("Role binding candidate budget exceeded"); }
}

/**
 * Discover recipient scopes with bounded index seeks while retaining all target fences.
 * @internal
 * @remarks This is structural discovery, before member-set eligibility. Each root
 * visits at most 65 distinct scope keys rather than scanning every binding in a hot
 * scope. More than 64 recipient scopes makes the complete decision unavailable.
 * Exact subject eligibility dependencies are discovered by the binding reader;
 * mutation owners must include them when promoting their full fence closure.
 */
export async function discoverAccessRoleBindingRecipientScopes(
	tx: DatabaseTransaction, scopeIds: string[],
): Promise<string[]> {
	const roots = [...new Set(z.array(z.uuid().toLowerCase()).min(1).max(64).parse(scopeIds))].sort();
	const fences = await tx.select({ id: accessRoleBindingScope.scopeId }).from(accessRoleBindingScope)
		.where(inArray(accessRoleBindingScope.scopeId, roots)).orderBy(accessRoleBindingScope.scopeId).for("share");
	if (fences.length !== roots.length) throw new AccessRoleBindingUnavailable();
	const scopes = await tx.execute<{ recipient: string }>(sql`
		with recursive scope_scan(target,recipient,depth) as (
			select target.id,first.recipient_scope_id,1
			from (values ${sql.join(roots.map(root => sql`(${root}::uuid)`), sql`, `)}) target(id)
			cross join lateral (select b.recipient_scope_id from public.access_role_binding b
				where b.target_scope_id=target.id and b.state='active' and b.recipient_scope_id is not null
				order by b.recipient_scope_id limit 1) first
			union all
			select s.target,next_scope.recipient_scope_id,s.depth+1 from scope_scan s
			cross join lateral (select b.recipient_scope_id from public.access_role_binding b
				where b.target_scope_id=s.target and b.state='active' and b.recipient_scope_id is not null
					and b.recipient_scope_id>s.recipient
				order by b.recipient_scope_id limit 1) next_scope where s.depth<65
		) select distinct recipient from scope_scan order by recipient limit 65`);
	if (scopes.rows.length > 64) throw new AccessRoleBindingBudgetExceeded();
	return scopes.rows.map(row => row.recipient);
}

/**
 * Discover a complete bounded set of positive bindings for already resolved recipients.
 * @internal
 * @remarks Member sets come from the selected subject's current owner evaluation,
 * including inherited Groups; never from an API request or the operator's unrelated
 * membership. The caller retains their positive and negative membership fences and
 * supplies every inherited resource root. All target fences are retained even when
 * the result is empty. Candidate exhaustion rejects the whole evaluation. This
 * query is not a public recipient lookup or an authorization decision.
 */
export async function discoverAccessRoleBindingCandidates(
	tx: DatabaseTransaction,
	input: z.infer<typeof discoverySchema>,
): Promise<z.infer<typeof selectionSchema>> {
	const request = discoverySchema.parse(input);
	const roots = [...new Set(request.targets.map(target => target.scopeId))].sort();
	const fences = await tx.select({ id: accessRoleBindingScope.scopeId })
		.from(accessRoleBindingScope).where(inArray(accessRoleBindingScope.scopeId, roots))
		.orderBy(accessRoleBindingScope.scopeId).for("share");
	if (fences.length !== roots.length) throw new AccessRoleBindingUnavailable();
	const recipients = or(
		and(eq(accessRoleBinding.recipientKind, "subject"), eq(accessRoleBinding.recipientSubjectId, request.subjectId)),
		...request.memberSets.map(set => and(eq(accessRoleBinding.recipientKind, set.kind),
			eq(accessRoleBinding.recipientScopeId, set.scopeId),
			set.kind === "group" ? eq(accessRoleBinding.recipientGroupId, set.groupId) : undefined)),
	);
	const targets = or(...request.targets.map(target => {
		const prefixes = Array.from({ length: target.path.length + 1 }, (_, length) =>
			sql`${accessRoleBindingRevision.targetPath}=array[${sql.join(target.path.slice(0, length).map(segment => sql`${segment}`), sql`, `)}]::text[]`);
		return and(eq(accessRoleBinding.targetScopeId, target.scopeId), or(...prefixes));
	}));
	const candidates = await tx.select({ bindingId: accessRoleBinding.id,
		targetScopeId: accessRoleBinding.targetScopeId, version: accessRoleBinding.version })
		.from(accessRoleBinding).innerJoin(accessRoleBindingRevision,
			and(eq(accessRoleBindingRevision.bindingId, accessRoleBinding.id),
				eq(accessRoleBindingRevision.revision, accessRoleBinding.termsRevision)))
		.where(and(recipients, targets, eq(accessRoleBinding.state, "active"), eq(accessRoleBindingRevision.sealed, true),
			sql`${accessRoleBindingRevision.validFrom}<=statement_timestamp()`,
			or(sql`${accessRoleBindingRevision.validUntil} is null`, sql`${accessRoleBindingRevision.validUntil}>statement_timestamp()`)))
		.orderBy(accessRoleBinding.id).limit(257);
	if (candidates.length > 256) throw new AccessRoleBindingBudgetExceeded();
	return candidates;
}

/** Current binding/role terms; permission membership alone does not authorize a request. @internal */
export interface CurrentAccessRoleBindingPermissions {
	binding: typeof accessRoleBinding.$inferSelect;
	terms: typeof accessRoleBindingRevision.$inferSelect;
	roleVersion: number;
	roleRevision: number | null;
	/** False includes revoked/retired, future/expired or ended exact recipient eligibility. */
	active: boolean;
	/** Already clipped to the literal frozen approval, when present. Never expand again. */
	permissions: readonly AccessPermission[];
	/** Owning database time after all local lock waits. Later effects re-evaluate. */
	evaluatedAt: Date;
}

/**
 * Hydrate at most 256 discovered binding versions in batches, retaining current owner fences.
 * @internal
 * @remarks The caller must discover the complete target/recipient candidate set,
 * promote overlapping mutation locks and retain broader actor, restriction,
 * representation and credential fences before this read. This does not discover
 * member sets, prove that the selected subject matches a recipient, evaluate deny
 * precedence or establish assignment authority. Candidate/version changes require
 * whole-transaction retry. Historical definitions are queried by exact revision,
 * never scanned or hydrated once per binding. No result is a reusable allow receipt.
 */
export async function readCurrentAccessRoleBindingPermissions(
	tx: DatabaseTransaction,
	input: { bindingId: string; targetScopeId: string; version: number }[],
): Promise<CurrentAccessRoleBindingPermissions[]> {
	const selected = selectionSchema.parse(input);
	if (!selected.length) return [];
	const scopeIds = [...new Set(selected.map(row => row.targetScopeId))].sort();
	const fences = await tx.select({ id: accessRoleBindingScope.scopeId })
		.from(accessRoleBindingScope).where(inArray(accessRoleBindingScope.scopeId, scopeIds))
		.orderBy(accessRoleBindingScope.scopeId).for("share");
	if (fences.length !== scopeIds.length) throw new AccessRoleBindingUnavailable();
	const heads = await tx.select({ binding: accessRoleBinding, terms: accessRoleBindingRevision })
		.from(accessRoleBinding).innerJoin(accessRoleBindingRevision,
			and(eq(accessRoleBindingRevision.bindingId, accessRoleBinding.id),
				eq(accessRoleBindingRevision.revision, accessRoleBinding.termsRevision),
				eq(accessRoleBindingRevision.sealed, true)))
		.where(inArray(accessRoleBinding.id, selected.map(row => row.bindingId))).limit(257);
	if (heads.length !== selected.length) throw new AccessRoleBindingDiscoveryChanged();
	const expected = new Map(selected.map(row => [row.bindingId, row]));
	for (const { binding } of heads) {
		const candidate = expected.get(binding.id);
		if (!candidate || candidate.version !== binding.version || candidate.targetScopeId !== binding.targetScopeId)
			throw new AccessRoleBindingDiscoveryChanged();
	}

	// All trees precede all enrollments, which precede all selection sets and roles.
	// A single binding may depend on another scope's admission.
	const membershipIds = [...new Set(heads.flatMap(row => row.terms.membershipId ? [row.terms.membershipId] : []))].sort();
	if (membershipIds.length) {
		const memberships = await tx.select({ id: accessMembership.id, scopeId: accessMembership.scopeId })
			.from(accessMembership).where(inArray(accessMembership.id, membershipIds));
		if (memberships.length !== membershipIds.length) throw new AccessRoleBindingUnavailable();
		const treeIds = [...new Set(memberships.map(row => row.scopeId))].sort();
		const trees = await tx.select({ id: accessGroupTree.scopeId }).from(accessGroupTree)
			.where(inArray(accessGroupTree.scopeId, treeIds)).orderBy(accessGroupTree.scopeId).for("share");
		if (trees.length !== treeIds.length) throw new AccessRoleBindingUnavailable();
		await tx.select({ id: accessMembership.id }).from(accessMembership)
			.where(inArray(accessMembership.id, membershipIds)).orderBy(accessMembership.id).for("share");
		const sets = new Map<string, { membershipId: string; generation: number }>();
		for (const { terms } of heads) if (terms.selectionGroupId !== null) {
			if (terms.membershipId === null || terms.membershipGeneration === null) throw new AccessRoleBindingUnavailable();
			sets.set(`${terms.membershipId}:${terms.membershipGeneration}`, { membershipId: terms.membershipId, generation: terms.membershipGeneration });
		}
		if (sets.size) {
			const locked = await tx.select({ id: accessGroupMembershipSet.membershipId }).from(accessGroupMembershipSet)
				.where(or(...[...sets.values()].map(set => and(
					eq(accessGroupMembershipSet.membershipId, set.membershipId), eq(accessGroupMembershipSet.generation, set.generation)))))
				.orderBy(accessGroupMembershipSet.membershipId, accessGroupMembershipSet.generation).for("share");
			if (locked.length !== sets.size) throw new AccessRoleBindingUnavailable();
		}
	}
	const roleIds = [...new Set(heads.map(row => row.binding.roleId))].sort();
	const roles = await tx.select().from(accessRole).where(inArray(accessRole.id, roleIds))
		.orderBy(accessRole.id).for("share");
	if (roles.length !== roleIds.length) throw new AccessRoleBindingUnavailable();
	const activeRoles = roles.filter(role => role.state === "active" && role.activeRevision !== null);
	const definitions = activeRoles.length ? await tx.select().from(accessRoleRevision).where(or(...activeRoles.map(role =>
		and(eq(accessRoleRevision.roleId, role.id), eq(accessRoleRevision.revision, role.activeRevision!))))) : [];
	const roleMembers = activeRoles.length ? await tx.select().from(accessRolePermission).where(or(...activeRoles.map(role =>
		and(eq(accessRolePermission.roleId, role.id), eq(accessRolePermission.revision, role.activeRevision!)))))
		.limit(activeRoles.length * AccessPermissionValues.length + 1) : [];
	const bindingMembers = await tx.select().from(accessRoleBindingPermission).where(or(...heads.map(({ terms }) =>
		and(eq(accessRoleBindingPermission.bindingId, terms.bindingId), eq(accessRoleBindingPermission.revision, terms.revision)))))
		.limit(heads.length * AccessPermissionValues.length + 1);
	const roleRows = new Map(roles.map(role => [role.id, role]));
	const definitionRows = new Map(definitions.map(definition => [definition.roleId, definition]));
	const authoredByRole = new Map<string, AccessPermission[]>();
	const roleMembersById = new Map<string, typeof roleMembers>();
	for (const row of roleMembers) {
		const members = roleMembersById.get(row.roleId) ?? [];
		members.push(row); roleMembersById.set(row.roleId, members);
	}
	for (const role of activeRoles) {
		const definition = definitionRows.get(role.id);
		if (!definition?.sealed || definition.revision !== role.activeRevision) throw new AccessRoleBindingUnavailable();
		authoredByRole.set(role.id, decodeAccessPermissionSnapshot(roleMembersById.get(role.id) ?? [], definition.permissionCount, definition.permissionDigest));
	}
	const approvedByBinding = new Map<string, typeof bindingMembers>();
	for (const row of bindingMembers) {
		const members = approvedByBinding.get(row.bindingId) ?? [];
		members.push(row); approvedByBinding.set(row.bindingId, members);
	}
	const state = await tx.execute<{ id: string; eligible: boolean | null; now: string }>(sql`
		select b.id, public.access_role_binding_recipient_is_current(b.id,b.terms_revision) as eligible,
		statement_timestamp()::text as now from public.access_role_binding b
		where b.id in (${sql.join(heads.map(row => sql`${row.binding.id}::uuid`), sql`, `)})`);
	const states = new Map(state.rows.map(row => [row.id, row]));
	return heads.map(({ binding, terms }) => {
		const role = roleRows.get(binding.roleId), current = states.get(binding.id);
		if (!role || !current || current.eligible === null) throw new AccessRoleBindingUnavailable();
		const evaluatedAt = new Date(current.now);
		if (!Number.isFinite(evaluatedAt.getTime())) throw new AccessRoleBindingUnavailable();
		const approved = decodeAccessPermissionSnapshot(approvedByBinding.get(binding.id) ?? [], terms.permissionCount, terms.permissionDigest);
		if (terms.permissionPolicy === "local-role" && (approved.length || role.scopeId !== binding.targetScopeId ||
			(binding.recipientScopeId !== null && binding.recipientScopeId !== binding.targetScopeId)))
			throw new AccessRoleBindingUnavailable();
		const active = binding.state === "active" && role.state === "active" && current.eligible &&
			terms.validFrom <= evaluatedAt && (terms.validUntil === null || terms.validUntil > evaluatedAt);
		const authored = authoredByRole.get(role.id) ?? [];
		return { binding, terms, roleVersion: role.version, roleRevision: role.activeRevision, active,
			evaluatedAt, permissions: active ? terms.permissionPolicy === "local-role"
				? snapshotAccessPermissionCeiling(authored) : constrainAccessPermissions(authored, approved) : [] };
	});
}

/**
 * Resolve the positive RoleBinding contribution for one selected private subject.
 * @internal
 * @remarks Targets include every inherited authority root supplied by the resource
 * owner. This composes native member-set discovery, candidate limits and current
 * role/approval hydration. The owner still requires actor/credential/representation
 * eligibility, restrictions, conditions, assignment lineage and current domain
 * invariants before allowing an operation. No controller/operator rights are pooled.
 * Mutation callers discover/promote their complete fence closure before entering.
 */
export async function readSubjectRoleBindingPermissions(
	tx: DatabaseTransaction,
	input: { subjectId: string; targets: { scopeId: string; path: string[] }[] },
) {
	const request = discoverySchema.omit({ memberSets: true }).parse(input);
	const recipientScopes = await discoverAccessRoleBindingRecipientScopes(tx, [...new Set(request.targets.map(target => target.scopeId))]);
	const memberSets = await readAccessMemberSetRecipients(tx, { subjectId: request.subjectId, scopeIds: recipientScopes });
	const candidates = await discoverAccessRoleBindingCandidates(tx, { ...request, memberSets: memberSets.recipients });
	const bindings = await readCurrentAccessRoleBindingPermissions(tx, candidates);
	return { subjectId: request.subjectId, bindings, recipientScopes, memberships: memberSets.memberships, selections: memberSets.selections };
}
