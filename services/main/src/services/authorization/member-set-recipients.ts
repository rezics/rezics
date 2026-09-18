import { lockAccessMembershipScopePolicy } from "./memberships";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { accessScope, accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { accessGroupMembershipSet } from "@rezics/schema/postgres/access/access-group-membership";
import { AccessGroupMembershipUnavailable, AccessGroupMembershipBudgetExceeded } from "./group-memberships";

const inputSchema = z.strictObject({
	subjectId: z.uuid().toLowerCase(),
	scopeIds: z.array(z.uuid().toLowerCase()).max(64).refine(ids => new Set(ids).size === ids.length, "Scope keys must be unique"),
});
/** Derived recipient alternatives for exactly one selected subject; never authenticated callers. @internal */
export type AccessMemberSetRecipient =
	| { kind: "all-members"; scopeId: string }
	| { kind: "group"; scopeId: string; groupId: string };

/**
 * Resolve current enrollment and inherited Groups without expanding a roster.
 * @internal
 * @remarks The caller discovers every relevant recipient scope, acquires preceding
 * target fences and promotes any overlapping mutation locks before this function.
 * This reader retains pair-local negative enrollment fences, then tree, enrollment
 * and selection-set fences. READ COMMITTED is required for fresh statements after
 * advisory-lock waits. Actor eligibility, membership policy, mute/ban and disclosure
 * remain separate mandatory owner decisions; these rows supply positive recipients
 * only. At most 64 scopes and 64 total direct selections per evaluation are admitted;
 * larger authority compositions fail unavailable through the budget error.
 */
export async function readAccessMemberSetRecipients(
	tx: DatabaseTransaction,
	input: z.infer<typeof inputSchema>,
): Promise<{
	subjectId: string;
	memberships: (typeof accessMembership.$inferSelect)[];
	selections: { membershipId: string; generation: number; setVersion: number }[];
	recipients: AccessMemberSetRecipient[];
}> {
	const request = inputSchema.parse(input);
	const isolation = await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`);
	if (isolation.rows[0]?.isolation !== "read committed") throw new AccessGroupMembershipUnavailable();
	const [subject] = await tx.select({ id: accessSubject.id }).from(accessSubject)
		.where(eq(accessSubject.id, request.subjectId)).limit(1);
	if (!subject) throw new AccessGroupMembershipUnavailable();
	const scopeIds = [...request.scopeIds].sort();
	if (!scopeIds.length) return { subjectId: request.subjectId, memberships: [], selections: [], recipients: [] };
	const scopes = await tx.select({ id: accessScope.id }).from(accessScope).where(inArray(accessScope.id, scopeIds));
	if (scopes.length !== scopeIds.length) throw new AccessGroupMembershipUnavailable();
	// The SQL owner loops in key order; expression evaluation order cannot order locks.
	await tx.execute(sql`select public.lock_access_membership_keys(
		array[${sql.join(scopeIds.map(scopeId => sql`${scopeId}::uuid`), sql`, `)}],${request.subjectId}::uuid,false)`);
	const candidates = await tx.select().from(accessMembership)
		.where(and(eq(accessMembership.subjectId, request.subjectId), inArray(accessMembership.scopeId, scopeIds)));
	if (!candidates.length) return { subjectId: request.subjectId, memberships: [], selections: [], recipients: [] };
	const treeIds = [...new Set(candidates.map(member => member.scopeId))].sort();
	const trees = await tx.select({ id: accessGroupTree.scopeId }).from(accessGroupTree)
		.where(inArray(accessGroupTree.scopeId, treeIds)).orderBy(accessGroupTree.scopeId).for("share");
	if (trees.length !== treeIds.length) throw new AccessGroupMembershipUnavailable();
	await lockAccessMembershipScopePolicy(tx,treeIds);
	const memberships = await tx.select().from(accessMembership)
		.where(inArray(accessMembership.id, candidates.map(member => member.id))).orderBy(accessMembership.id).for("share");
	if (memberships.length !== candidates.length) throw new AccessGroupMembershipUnavailable();
	await tx.execute(sql`select e.id from public.access_scope s join public.reference_value r on r.id=s.unit_ref
  join public.entity_identity e on e.id=r.target_entity_id join public.entity_participation p on p.entity_id=e.id
  where s.id in (${sql.join(treeIds.map(id => sql`${id}::uuid`),sql`, `)}) and e.shape='organization' order by e.id for share of e,p`);
 const lifecycle = (await tx.execute<{ id: string; eligible: boolean | null }>(sql`select id,public.access_membership_scope_is_eligible(id) as eligible from public.access_scope where id in (${sql.join(treeIds.map(id => sql`${id}::uuid`),sql`, `)})`)).rows;
 if (lifecycle.length!==treeIds.length || lifecycle.some(row => row.eligible===null)) throw new AccessGroupMembershipUnavailable();
 const admittedScopes = new Set(lifecycle.filter(row => row.eligible).map(row => row.id));
 const eligibleMembers = (await tx.execute<{ id:string; eligible:boolean|null }>(sql`select id,public.access_membership_is_eligible(id) as eligible from public.access_membership where id in (${sql.join(memberships.map(member=>sql`${member.id}::uuid`),sql`, `)})`)).rows;
 if(eligibleMembers.length!==memberships.length||eligibleMembers.some(row=>row.eligible===null)) throw new AccessGroupMembershipUnavailable();
 const eligibleIds=new Set(eligibleMembers.filter(row=>row.eligible).map(row=>row.id));
 const active = memberships.filter(member => member.activeGeneration !== null && admittedScopes.has(member.scopeId) && eligibleIds.has(member.id));
	if (!active.length) return { subjectId: request.subjectId, memberships, selections: [], recipients: [] };
	const sets = await tx.select().from(accessGroupMembershipSet).where(or(...active.map(member =>
		and(eq(accessGroupMembershipSet.membershipId, member.id), eq(accessGroupMembershipSet.generation, member.activeGeneration!)))))
		.orderBy(accessGroupMembershipSet.membershipId, accessGroupMembershipSet.generation).for("share");
	if (sets.length !== active.length) throw new AccessGroupMembershipUnavailable();
	const selections = sets.map(set => ({ membershipId: set.membershipId, generation: set.generation, setVersion: set.version }));
	const recipients: AccessMemberSetRecipient[] = active.map(member => ({ kind: "all-members", scopeId: member.scopeId }));
	const roots = (await tx.execute<{ membership_id: string; generation: string; scope_id: string; group_id: string; version: string }>(sql`
		select selected.membership_id,selected.generation::text,selected.scope_id,selected.group_id,selected.version::text
		from (values ${sql.join(active.map(member => sql`(${member.id}::uuid,${member.activeGeneration}::bigint)`), sql`, `)}) as admitted(id,generation)
		cross join lateral (select * from public.access_group_membership g
			where g.membership_id=admitted.id and g.generation=admitted.generation and g.selected
			order by g.group_id limit 65) selected
		limit 65`)).rows;
	if (roots.length > 64) throw new AccessGroupMembershipBudgetExceeded();
	if (!roots.length) return { subjectId: request.subjectId, memberships, selections, recipients };
	const paths = (await tx.execute<{
		direct_id: string; scope_id: string; id: string; parent_id: string | null;
		state: string; version: string; depth: number;
	}>(sql`
		with recursive paths(direct_id,scope_id,id,parent_id,state,version,depth) as (
			select g.id,g.scope_id,g.id,g.parent_id,g.state,g.version,1 from public.access_group g
			join (values ${sql.join(roots.map(root => sql`(${root.scope_id}::uuid,${root.group_id}::uuid)`), sql`, `)}) selected(scope_id,group_id)
			on g.scope_id=selected.scope_id and g.id=selected.group_id
			union all
			select p.direct_id,g.scope_id,g.id,g.parent_id,g.state,g.version,p.depth+1
			from paths p join public.access_group g on g.id=p.parent_id and g.scope_id=p.scope_id
			where p.state='active' and p.depth<8
		) select direct_id,scope_id,id,parent_id,state,version::text,depth from paths order by direct_id,depth limit 513`)).rows;
	if (paths.length > 512) throw new AccessGroupMembershipBudgetExceeded();
	const byRoot = new Map<string, typeof paths>();
	for (const row of paths) {
		const path = byRoot.get(row.direct_id) ?? [];
		path.push(row); byRoot.set(row.direct_id, path);
	}
	const seen = new Set<string>();
	for (const root of roots) {
		const path = byRoot.get(root.group_id), first = path?.[0];
		if (!first || first.depth !== 1 || first.scope_id !== root.scope_id) throw new AccessGroupMembershipUnavailable();
		if (first.state === "retired" && path.length === 1) continue;
		if (path.at(-1)?.parent_id !== null) throw new AccessGroupMembershipUnavailable();
		const ancestors = new Set<string>();
		for (const [index, row] of path.entries()) {
			const version = Number(row.version);
			if (row.state !== "active" || row.scope_id !== root.scope_id || row.depth !== index + 1 || ancestors.has(row.id) ||
				!Number.isSafeInteger(version) || version < 1 || (index > 0 && path[index - 1]!.parent_id !== row.id))
				throw new AccessGroupMembershipUnavailable();
			ancestors.add(row.id);
			const key = `${row.scope_id}:${row.id}`;
			if (!seen.has(key)) { seen.add(key); recipients.push({ kind: "group", scopeId: row.scope_id, groupId: row.id }); }
		}
	}
	return { subjectId: request.subjectId, memberships, selections, recipients };
}
