import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues, type AccessPermission, type RepresentationReference } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import {
	accessRepresentation, accessRepresentationEntity, accessRepresentationRevision, accessRepresentationPermission,
} from "../database/schema/access-representation";
import { accessMembership } from "../database/schema/access-membership";
import { accessGroupTree } from "../database/schema/access-group";
import { accessGroupMembershipSet } from "../database/schema/access-group-membership";
import { decodeAccessPermissionSnapshot } from "./permission";
import { AccessRepresentationUnavailable } from "./representations";
import type { AuthorityOutcome } from "./authority-context";

const referencesSchema = z.array(z.strictObject({ id: z.uuid().toLowerCase(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }))
	.max(64).refine(refs => new Set(refs.map(ref => ref.id)).size === refs.length, "Selected grants must be unique");
/** Selected representation graph/lineage exceeds one bounded request evaluation. @internal */
export class AccessRepresentationBudgetExceeded extends Error {
	constructor() { super("Representation dependency budget exceeded"); }
}
/** Exact selected terms with native lifecycle/dependency liveness; broader subject policy remains mandatory. @internal */
export interface CurrentAccessRepresentation {
	head: typeof accessRepresentation.$inferSelect;
	terms: typeof accessRepresentationRevision.$inferSelect;
	permissions: AccessPermission[];
	/** Live authority subjects used by this grant's retained parent lineage. */
	parentSubjectIds: string[];
	liveness: AuthorityOutcome;
	evaluatedAt: Date;
}

/**
 * Read selected exact representation terms and at most 256 retained lineage revisions.
 * @internal
 * @remarks Entity, Group, admission and selection fences remain held. Mutation
 * owners promote their complete actor/resource/credential and grant fence set
 * before entering this reader. Native liveness checks revocation, expiry, exact
 * parents and their enrollment/Group bases; it does not prove that a request actor
 * may use a delegate, validate actor/Entity eligibility or disclose these private
 * identities. Missing selected terms are omitted, never guessed from a new head.
 */
export async function readCurrentAccessRepresentations(
	tx: DatabaseTransaction, input: RepresentationReference[],
): Promise<{ grants: CurrentAccessRepresentation[]; dependencySubjectIds: string[] }> {
	const references = referencesSchema.parse(input);
	if (!references.length) return { grants: [], dependencySubjectIds: [] };
	const heads = await tx.select().from(accessRepresentation)
		.where(inArray(accessRepresentation.id, references.map(ref => ref.id))).limit(65);
	if (!heads.length) return { grants: [], dependencySubjectIds: [] };
	const entityIds = [...new Set(heads.map(head => head.entityId))].sort();
	const fences = await tx.select({ id: accessRepresentationEntity.entityId }).from(accessRepresentationEntity)
		.where(inArray(accessRepresentationEntity.entityId, entityIds)).orderBy(accessRepresentationEntity.entityId).for("share");
	if (fences.length !== entityIds.length) throw new AccessRepresentationUnavailable();
	const known = new Set(heads.map(head => head.id));
	const selected = references.filter(ref => known.has(ref.id));
	const lineage = (await tx.execute<{ base_id: string; grant_id: string; revision: string }>(sql`
		select selected.id as base_id,l.grant_id,l.revision::text from
		(values ${sql.join(selected.map(ref => sql`(${ref.id}::uuid,${ref.revision}::bigint)`), sql`, `)}) selected(id,revision)
		cross join lateral public.access_representation_lineage(selected.id,selected.revision) l
		order by selected.id,l.depth limit 577`)).rows;
	if (lineage.length > 576) throw new AccessRepresentationBudgetExceeded();
	const distinctLineage = new Map(lineage.map(row => [`${row.grant_id}:${row.revision}`, row]));
	if (distinctLineage.size > 256) throw new AccessRepresentationBudgetExceeded();
	const revisions = [...distinctLineage.values()].map(row => ({ id: row.grant_id, revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(Number(row.revision)) }));
	const snapshots = await tx.select({ head: accessRepresentation, terms: accessRepresentationRevision })
		.from(accessRepresentation).innerJoin(accessRepresentationRevision, eq(accessRepresentationRevision.grantId, accessRepresentation.id))
		.where(or(...revisions.map(ref => and(eq(accessRepresentation.id, ref.id), eq(accessRepresentationRevision.revision, ref.revision)))))
		.limit(257);
	if (snapshots.length > 256 || snapshots.some(row => !entityIds.includes(row.head.entityId))) throw new AccessRepresentationUnavailable();
	const membershipIds = [...new Set(snapshots.flatMap(row => [row.terms.membershipId, row.head.parentMembershipId]).filter((id): id is string => id !== null))].sort();
	const memberships = membershipIds.length ? await tx.select({ id: accessMembership.id, scopeId: accessMembership.scopeId })
		.from(accessMembership).where(inArray(accessMembership.id, membershipIds)) : [];
	if (memberships.length !== membershipIds.length) throw new AccessRepresentationUnavailable();
	const treeIds = [...new Set([
		...memberships.map(member => member.scopeId),
		...snapshots.flatMap(row => row.head.recipientKind === "group" && row.head.recipientScopeId ? [row.head.recipientScopeId] : []),
	])].sort();
	if (treeIds.length) {
		const trees = await tx.select({ id: accessGroupTree.scopeId }).from(accessGroupTree)
			.where(inArray(accessGroupTree.scopeId, treeIds)).orderBy(accessGroupTree.scopeId).for("share");
		if (trees.length !== treeIds.length) throw new AccessRepresentationUnavailable();
	}
	if (membershipIds.length) await tx.select({ id: accessMembership.id }).from(accessMembership)
		.where(inArray(accessMembership.id, membershipIds)).orderBy(accessMembership.id).for("share");
	const sets = new Map<string, { membershipId: string; generation: number }>();
	for (const { head, terms } of snapshots) {
		if (terms.selectionGroupId !== null) {
			if (terms.membershipId === null || terms.membershipGeneration === null) throw new AccessRepresentationUnavailable();
			sets.set(`${terms.membershipId}:${terms.membershipGeneration}`, { membershipId: terms.membershipId, generation: terms.membershipGeneration });
		}
		if (head.parentSelectionGroupId !== null) {
			if (head.parentMembershipId === null || head.parentMembershipGeneration === null) throw new AccessRepresentationUnavailable();
			sets.set(`${head.parentMembershipId}:${head.parentMembershipGeneration}`, { membershipId: head.parentMembershipId, generation: head.parentMembershipGeneration });
		}
	}
	if (sets.size) {
		const locked = await tx.select({ id: accessGroupMembershipSet.membershipId }).from(accessGroupMembershipSet)
			.where(or(...[...sets.values()].map(set => and(eq(accessGroupMembershipSet.membershipId, set.membershipId), eq(accessGroupMembershipSet.generation, set.generation)))))
			.orderBy(accessGroupMembershipSet.membershipId, accessGroupMembershipSet.generation).for("share");
		if (locked.length !== sets.size) throw new AccessRepresentationUnavailable();
	}
	const memberRows = await tx.select().from(accessRepresentationPermission)
		.where(or(...selected.map(ref => and(eq(accessRepresentationPermission.grantId, ref.id), eq(accessRepresentationPermission.revision, ref.revision)))))
		.limit(selected.length * AccessPermissionValues.length + 1);
	const members = new Map<string, typeof memberRows>();
	for (const row of memberRows) {
		const key = `${row.grantId}:${row.revision}`, values = members.get(key) ?? [];
		values.push(row); members.set(key, values);
	}
	const selectedKeys = new Set(selected.map(ref => `${ref.id}:${ref.revision}`));
	const states = (await tx.execute<{ id: string; liveness: boolean | null; now: string }>(sql`
		select selected.id,public.access_representation_is_current(selected.id,selected.revision) as liveness,
		clock_timestamp()::text as now from
		(values ${sql.join(selected.map(ref => sql`(${ref.id}::uuid,${ref.revision}::bigint)`), sql`, `)}) selected(id,revision)`)).rows;
	const byId = new Map(states.map(state => [state.id, state]));
	const parentSubjects = new Map<string, Set<string>>();
	const byRevision = new Map(snapshots.map(row => [`${row.head.id}:${row.terms.revision}`, row]));
	for (const row of lineage) {
		const parentSubjectId = byRevision.get(`${row.grant_id}:${row.revision}`)?.head.parentSubjectId;
		if (parentSubjectId) {
			const ids = parentSubjects.get(row.base_id) ?? new Set<string>();
			ids.add(parentSubjectId); parentSubjects.set(row.base_id, ids);
		}
	}
	const grants: CurrentAccessRepresentation[] = [];
	for (const { head, terms } of snapshots) {
		const key = `${head.id}:${terms.revision}`;
		if (!selectedKeys.has(key)) continue;
		if (!terms.sealed) throw new AccessRepresentationUnavailable();
		const state = byId.get(head.id);
		if (!state) throw new AccessRepresentationUnavailable();
		const evaluatedAt = new Date(state.now);
		if (!Number.isFinite(evaluatedAt.getTime())) throw new AccessRepresentationUnavailable();
		grants.push({ head, terms, evaluatedAt, parentSubjectIds: [...(parentSubjects.get(head.id) ?? [])].sort(),
			permissions: decodeAccessPermissionSnapshot(members.get(key) ?? [], terms.permissionCount, terms.permissionDigest),
			liveness: state.liveness === true ? "allow" : state.liveness === false ? "deny" : "unavailable" });
	}
	const dependencySubjectIds = [...new Set(snapshots.flatMap(({ head }) =>
		[head.parentSubjectId, head.recipientSubjectId]).filter((id): id is string => id !== null))].sort();
	return { grants, dependencySubjectIds };
}
