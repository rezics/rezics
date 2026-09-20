import { z } from "zod";
import { constrainAccessPermissions, snapshotAccessPermissionCeiling } from "@rezics/access";
import { AccessPermissionSchema, decodeAccessPermissionSnapshot } from "./permission";
import type { GroupImpactReview } from "./group-impact-discovery";

const id = z.uuid().toLowerCase(), version = z.number().int().safe().nonnegative();
const instant = z.string().transform(value => new Date(value)).refine(value => Number.isFinite(value.getTime()));
const path = z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8);
const permissionRows = z.array(z.object({ family: z.string(), permission: z.string() }));
const snapshot = z.object({ sealed: z.literal(true), permission_count: version, permission_digest: z.string() });
const basis = z.object({ membership_id: id.nullable(), membership_generation: version.nullable(), selection_group_id: id.nullable(), selection_version: version.nullable() });
const terms = snapshot.extend({ revision: version.min(1), valid_from: instant, valid_until: instant.nullable(), ...basis.shape });
const recipient = z.object({ recipient_kind: z.enum(["subject", "group", "all-members", "scope-members"]),
	recipient_subject_id: id.nullable(), recipient_group_id: id.nullable(), recipient_scope_id: id.nullable() });
const group = z.object({ id, scope_id: id, parent_id: id.nullable(), state: z.enum(["draft", "active", "retired"]), version });
const selection = z.object({ membership_id: id, generation: version.min(1), scope_id: id, group_id: id, version: version.min(1), selected: z.boolean() });
const admission = z.object({ membership_id: id, generation: version.min(1) });
const member = z.object({ id, scope_id: id, subject_id: id, version, active_generation: version.nullable(),
	admission: admission.optional(), selections: z.array(selection).max(64).optional(),
	selectionSet: z.object({ membership_id: id, generation: version.min(1), version }).optional() });
const eligibility = z.object({ admission, selection: selection.nullable(), expectedSelectionVersion: version.nullable() });
const binding = recipient.extend({ recipient_kind: z.enum(["subject", "group", "all-members"]), id, version, state: z.enum(["draft", "active", "revoked"]), terms_revision: version.nullable(), role_id: id, target_scope_id: id,
	terms: terms.extend({ binding_id: id, permission_policy: z.enum(["local-role", "frozen-ceiling"]), target_path: path }).optional(),
	permissions: permissionRows.optional(), eligibility: eligibility.nullable().optional() });
const role = z.object({ id, scope_id: id, version, state: z.enum(["draft", "active", "retired"]), active_revision: version.nullable(),
	terms: snapshot.extend({ role_id: id, revision: version.min(1) }).optional(), permissions: permissionRows.optional() });
const representation = recipient.extend({ recipient_kind: z.enum(["subject", "group", "all-members"]), id, version, state: z.enum(["draft", "active", "revoked"]), terms_revision: version.nullable(), entity_id: id,
	parent_grant_id: id.nullable(), parent_revision: version.nullable(), parent_subject_id: id.nullable(),
	parent_membership_id: id.nullable(), parent_membership_generation: version.nullable(), parent_selection_group_id: id.nullable(), parent_selection_version: version.nullable(),
	terms: terms.extend({ grant_id: id, target_kind: z.enum(["scope", "all-scopes"]), target_scope_id: id.nullable(), target_path: path,
		can_redelegate: z.boolean(), require_fresh_session: z.boolean() }).optional(), permissions: permissionRows.optional(),
	eligibility: eligibility.nullable().optional(), parentBasis: eligibility.nullable().optional(),
	parentTerms: terms.extend({ grant_id: id }).optional(), parentPermissions: permissionRows.optional(), parentTermsEligibility: eligibility.nullable().optional() });
const ceiling = recipient.extend({ ...snapshot.shape, id, scope_id: id, role_id: id, manager_binding_id: id, manager_terms_revision: version.min(1),
	state: z.enum(["draft", "active", "revoked"]), version, target_path: path, valid_from: instant, valid_until: instant.nullable(),
	maximum_grant_duration_seconds: version.nullable(), grant_not_after: instant.nullable(),
	permissions: permissionRows, managerTerms: terms.extend({ binding_id: id }), managerPermissions: permissionRows,
	managerEligibility: eligibility.nullable(), member_subject_kind: z.enum(["principal", "entity"]).nullable() });

/** Exact structural recipient path; membership and selection generations are never inferred from identity alone. @internal */
export const GroupImpactPathSchema = z.strictObject({ membershipId: id.nullable(), generation: version.nullable(),
	selectionGroupId: id.nullable(), selectionVersion: version.nullable(), selectionSetVersion: version.nullable(), groups: z.array(id).max(8) });
/** Full positive contribution at a logical target path; restrictions are retained separately, never used to clip confer intent. @internal */
export const GroupImpactEffectSchema = z.strictObject({ kind: z.enum(["binding", "representation", "ceiling"]), sourceId: id, sourceVersion: version,
	termsRevision: version.nullable(), roleId: id.nullable(), roleRevision: version.nullable(), entityId: id.nullable(),dependencySubjectIds: z.array(id).max(8),
	conditions: z.strictObject({ requireFreshSession: z.boolean(),canRedelegate: z.boolean() }).nullable(),
	scopeId: id.nullable(), targetPath: path, subjectId: id,
	recipientGroup: z.strictObject({ scopeId: id,groupId: id }).nullable(),
	before: z.array(AccessPermissionSchema), after: z.array(AccessPermissionSchema),
	beforePaths: z.array(GroupImpactPathSchema).max(64), afterPaths: z.array(GroupImpactPathSchema).max(64),
	lineage: z.array(z.strictObject({ id, revision: version.min(1) })).max(8),
	lineageBases: z.array(z.strictObject({ grantId: id,subjectId: id,membershipId: id.nullable(),generation: version.nullable(),
		selectionGroupId: id.nullable(),selectionVersion: version.nullable(),beforeGroups: z.array(id).max(8),afterGroups: z.array(id).max(8) })).max(8),
	validFrom: z.iso.datetime(), validUntil: z.iso.datetime().nullable(),
	/** Symbolic confer recipient boundary when a manager gains/loses a ceiling. */
 ceilingRecipient: z.strictObject({ kind: z.enum(["subject","group","all-members","scope-members"]),subjectId: id.nullable(),groupId: id.nullable(),scopeId: id.nullable(),
  memberSubjectKind: z.enum(["principal","entity"]).nullable(),maximumGrantDurationSeconds: version.nullable(),grantNotAfter: z.iso.datetime().nullable() }).optional(),
	confer: z.boolean(),
});
/** Private complete contribution delta, including redundant paths for later recovery analysis. @internal */
export type GroupImpactEffect = z.infer<typeof GroupImpactEffectSchema>;
/** Incomplete input or bounded evaluation exhaustion never certifies a partial delta. @internal */
export class GroupImpactDeltaUnavailable extends Error {
	constructor(readonly reason: "missing" | "budget") { super(reason); }
}
function required<T>(value: T | null | undefined): T {
	if (value === undefined || value === null) throw new GroupImpactDeltaUnavailable("missing");
	return value;
}
function decoded(value: unknown, rows: unknown) {
	const metadata = snapshot.parse(value);
	return decodeAccessPermissionSnapshot(permissionRows.parse(rows), metadata.permission_count, metadata.permission_digest);
}
function unique<T>(map: Map<string, T>, key: string, value: T) {
	if (map.has(key) && JSON.stringify(map.get(key)) !== JSON.stringify(value)) throw new GroupImpactDeltaUnavailable("missing");
	map.set(key, value);
}

/**
 * Compile complete, version-bound server facts into all changed source/recipient contributions.
 * @internal
 * @remarks Target paths remain symbolic; no descendant resource matrix is materialized.
 * Contributions retain redundant direct/inherited paths instead of subtracting unrelated
 * grants or conflating an Entity's representation approval with its own resource rights.
 * A whole source permission set is required for every gained recipient/path, even if
 * another preexisting path already supplies it. This conservative confer rule avoids
 * using an independent grant as approval for a new administrative source.
 */
export function compileGroupImpactDelta(review: GroupImpactReview, facts: { ordinal: number; kind: string; payload: Record<string, unknown> }[]): GroupImpactEffect[] {
	if (facts.length !== review.factCount || facts.some((fact, index) => fact.ordinal !== index + 1)) throw new GroupImpactDeltaUnavailable("missing");
	const groups = new Map<string, z.infer<typeof group>>(), members = new Map<string, z.infer<typeof member>>();
	const bindings = new Map<string, z.infer<typeof binding>>(), roles = new Map<string, z.infer<typeof role>>();
	const representations = new Map<string, z.infer<typeof representation>>(), ceilings = new Map<string, z.infer<typeof ceiling>>();
	const affectedBindings = new Set<string>(), affectedRepresentations = new Set<string>();
	for (const fact of facts) {
		const value = fact.payload;
		if (["subtree", "group", "group-context", "roster"].includes(fact.kind)) { const row = group.parse(value); unique(groups,row.id,row); }
		else if (fact.kind === "membership") {
			const row = member.parse(value);
			if (row.active_generation !== null) {
				if (required(row.admission).membership_id !== row.id || row.admission?.generation !== row.active_generation ||
					required(row.selectionSet).membership_id !== row.id || row.selectionSet?.generation !== row.active_generation) throw new GroupImpactDeltaUnavailable("missing");
				for (const selected of required(row.selections)) if (selected.membership_id !== row.id || selected.generation !== row.active_generation || selected.scope_id !== row.scope_id || !selected.selected) throw new GroupImpactDeltaUnavailable("missing");
			}
			unique(members,row.id,row);
		} else if (["binding", "binding-context"].includes(fact.kind)) {
			const row = binding.parse(value); if (row.state === "active" && row.terms_revision === null) throw new GroupImpactDeltaUnavailable("missing"); unique(bindings,row.id,row); if (fact.kind === "binding") affectedBindings.add(row.id);
		} else if (fact.kind === "role") { const row = role.parse(value); if (row.state === "active" && row.active_revision === null) throw new GroupImpactDeltaUnavailable("missing"); unique(roles,row.id,row); }
		else if (["representation", "representation-context"].includes(fact.kind)) {
			const row = representation.parse(value); if (row.state === "active" && row.terms_revision === null) throw new GroupImpactDeltaUnavailable("missing"); unique(representations,row.id,row); if (fact.kind === "representation") affectedRepresentations.add(row.id);
		} else if (fact.kind === "ceiling") { const row = ceiling.parse(value); unique(ceilings,row.id,row); }
	}
	const memberKeys = new Set<string>();
	for (const m of members.values()) {
		const key = `${m.scope_id}:${m.subject_id}`;
		if (memberKeys.has(key)) throw new GroupImpactDeltaUnavailable("missing"); memberKeys.add(key);
	}
	const root = required(groups.get(review.groupId));
	if (root.scope_id !== review.scopeId || root.version !== review.expectedGroupVersion || (root.state !== "active" && !(review.membershipId && review.operation !== "assign" && root.state === "retired"))) throw new GroupImpactDeltaUnavailable("missing");
	let work = 0;
	function charge() { if (++work > 65536) throw new GroupImpactDeltaUnavailable("budget"); }
	function groupPath(groupId: string, scopeId: string, after: boolean): string[] {
		const result: string[] = []; let key: string | null = groupId;
		while (key !== null) {
			charge(); const row: z.infer<typeof group> = required(groups.get(key));
			if (row.scope_id !== scopeId || result.includes(key) || result.length >= 8) throw new GroupImpactDeltaUnavailable("missing");
			if (row.state !== "active" || (after && key === review.groupId && review.operation === "retire")) return [];
			result.push(key); key = after && review.operation === "reparent" && key === review.groupId ? review.proposedParentId : row.parent_id;
		}
		return result;
	}
	function changedSelection(membershipId: string, generation: number | null, groupId: string | null, after: boolean) {
  return after && review.membershipId === membershipId && review.generation === generation && review.groupId === groupId;
 }
 function selectedRoots(m: z.infer<typeof member>, after: boolean) {
  const roots = required(m.selections);
  if (!review.membershipId || !after || m.id !== review.membershipId || m.active_generation !== review.generation) return roots;
  const retained = roots.filter(row => row.group_id !== review.groupId);
  if (review.operation === "assign") retained.push({ membership_id: m.id, generation: required(review.generation), scope_id: m.scope_id,
   group_id: review.groupId, version: required(review.expectedSelectionVersion) + 1, selected: true });
  if (retained.length > 64) throw new GroupImpactDeltaUnavailable("budget");
  return retained.sort((a,b) => a.group_id.localeCompare(b.group_id));
 }
 function setVersion(m: z.infer<typeof member>, after: boolean) {
  return required(m.selectionSet).version + (after && m.id === review.membershipId && m.active_generation === review.generation ? 1 : 0);
 }
 // Set revisions fence completeness, while exact selection revisions identify
 // paths. An unrelated set stamp change alone is not a newly conferred path.
 function pathIdentity(value: z.infer<typeof GroupImpactPathSchema>) {
  return JSON.stringify({ ...value, selectionSetVersion: null });
 }
	function eligible(b: z.infer<typeof basis>, evidence: z.infer<typeof eligibility> | null | undefined, subjectId: string, after: boolean) {
		if (b.membership_id === null) {
			if (b.membership_generation !== null || b.selection_group_id !== null || b.selection_version !== null) throw new GroupImpactDeltaUnavailable("missing");
			return true;
		}
		const m = required(members.get(b.membership_id)), e = required(evidence);
		if (e.admission.membership_id !== m.id || e.admission.generation !== b.membership_generation) throw new GroupImpactDeltaUnavailable("missing");
		if (m.subject_id !== subjectId || m.active_generation !== b.membership_generation) return false;
		if (b.selection_group_id === null) return true;
		const selected = required(e.selection);
		if (selected.membership_id !== m.id || selected.generation !== b.membership_generation || selected.group_id !== b.selection_group_id || selected.scope_id !== m.scope_id) throw new GroupImpactDeltaUnavailable("missing");
		return !changedSelection(m.id, b.membership_generation, b.selection_group_id, after) && selected.selected && selected.version === b.selection_version && e.expectedSelectionVersion === b.selection_version && groupPath(selected.group_id,m.scope_id,after).length > 0;
	}
	const emptyPath: z.infer<typeof GroupImpactPathSchema> = { membershipId: null, generation: null, selectionGroupId: null, selectionVersion: null, selectionSetVersion: null, groups: [] };
	function recipients(r: z.infer<typeof recipient>, after: boolean): Map<string,z.infer<typeof GroupImpactPathSchema>[]> {
		const found = new Map<string,z.infer<typeof GroupImpactPathSchema>[]>();
		if (r.recipient_kind === "subject") { found.set(required(r.recipient_subject_id),[{ ...emptyPath }]); return found; }
		for (const m of members.values()) {
			charge(); if (m.scope_id !== r.recipient_scope_id || m.active_generation === null) continue;
			if (r.recipient_kind === "all-members" || r.recipient_kind === "scope-members") {
				found.set(m.subject_id,[{ ...emptyPath,membershipId: m.id,generation: m.active_generation,selectionSetVersion: setVersion(m,after) }]); continue;
			}
			const paths: z.infer<typeof GroupImpactPathSchema>[] = [];
			for (const selected of selectedRoots(m,after)) {
				const chain = groupPath(selected.group_id,m.scope_id,after), index = chain.indexOf(required(r.recipient_group_id));
				if (index >= 0) paths.push({ membershipId: m.id,generation: m.active_generation,selectionGroupId: selected.group_id,
					selectionVersion: selected.version,selectionSetVersion: setVersion(m,after),groups: chain.slice(0,index+1) });
			}
			if (paths.length) found.set(m.subject_id,paths);
		}
		return found;
	}
	const currentTime = review.createdAt.getTime();
	function live(start: Date,end: Date | null) { return start.getTime() <= currentTime && (end === null || end.getTime() > currentTime); }
	function representationLive(row: z.infer<typeof representation>, after: boolean, lineage: { id: string; revision: number }[]): boolean {
		charge(); if (lineage.length >= 8 || lineage.some(parent => parent.id === row.id)) throw new GroupImpactDeltaUnavailable("missing");
		if (row.terms_revision === null) return false;
		const t = required(row.terms); decoded(t,row.permissions);
		if (t.revision !== row.terms_revision || t.grant_id !== row.id) throw new GroupImpactDeltaUnavailable("missing");
		lineage.push({ id: row.id, revision: t.revision });
		if (row.state !== "active" || !live(t.valid_from,t.valid_until)) return false;
		if (t.membership_id !== null && (row.recipient_kind !== "subject" || !eligible(t,row.eligibility,required(row.recipient_subject_id),after))) return false;
		if (row.recipient_kind === "group" && !groupPath(required(row.recipient_group_id),required(row.recipient_scope_id),after).length) return false;
		if (row.parent_grant_id !== null) {
			const parent = required(representations.get(row.parent_grant_id));
			const selected = required(row.parentTerms); decoded(selected,row.parentPermissions);
			if (selected.grant_id !== parent.id || selected.revision !== row.parent_revision) throw new GroupImpactDeltaUnavailable("missing");
			if (parent.entity_id !== row.entity_id) throw new GroupImpactDeltaUnavailable("missing");
			if (parent.terms_revision !== row.parent_revision) return false;
			const parentSubject = required(row.parent_subject_id);
			if (!eligible({ membership_id: row.parent_membership_id,membership_generation: row.parent_membership_generation,
				selection_group_id: row.parent_selection_group_id,selection_version: row.parent_selection_version },row.parentBasis,parentSubject,after)) return false;
			if (parent.recipient_kind === "subject") { if (parent.recipient_subject_id !== parentSubject) return false; }
			else {
				const m = required(members.get(required(row.parent_membership_id)));
				if (m.scope_id !== parent.recipient_scope_id || m.subject_id !== parentSubject) return false;
				if (parent.recipient_kind === "group" && !groupPath(required(row.parent_selection_group_id),m.scope_id,after).includes(required(parent.recipient_group_id))) return false;
			}
			return representationLive(parent,after,lineage);
		}
		return true;
	}
	const effects: GroupImpactEffect[] = [];
	function append(base: Omit<GroupImpactEffect,"subjectId"|"before"|"after"|"beforePaths"|"afterPaths"|"confer">,
		beforeRecipients: ReturnType<typeof recipients>, afterRecipients: ReturnType<typeof recipients>, permissions: z.infer<typeof AccessPermissionSchema>[]) {
		for (const subjectId of [...new Set([...beforeRecipients.keys(),...afterRecipients.keys()])].sort()) {
			charge(); const beforePaths = beforeRecipients.get(subjectId) ?? [], afterPaths = afterRecipients.get(subjectId) ?? [];
			if (JSON.stringify(beforePaths.map(pathIdentity)) === JSON.stringify(afterPaths.map(pathIdentity))) continue;
			const oldPaths = new Set(beforePaths.map(pathIdentity));
			effects.push({ ...base,subjectId,before: beforePaths.length ? permissions : [],after: afterPaths.length ? permissions : [],beforePaths,afterPaths,
				confer: permissions.length > 0 && afterPaths.some(value => !oldPaths.has(pathIdentity(value))) });
			if (effects.length > 4096) throw new GroupImpactDeltaUnavailable("budget");
		}
	}
	for (const key of [...affectedBindings].sort()) {
		const row = required(bindings.get(key)); if (row.terms_revision === null) continue;
		const t = required(row.terms), r = required(roles.get(row.role_id)), approved = decoded(t,row.permissions);
		if (t.binding_id !== row.id || t.revision !== row.terms_revision) throw new GroupImpactDeltaUnavailable("missing");
		if (t.permission_policy === "local-role" && (approved.length || r.scope_id !== row.target_scope_id || (row.recipient_scope_id !== null && row.recipient_scope_id !== row.target_scope_id))) throw new GroupImpactDeltaUnavailable("missing");
		let permissions: z.infer<typeof AccessPermissionSchema>[] = [];
		if (r.active_revision !== null) {
			const rt = required(r.terms); if (rt.role_id !== r.id || rt.revision !== r.active_revision) throw new GroupImpactDeltaUnavailable("missing");
			const authored = decoded(rt,r.permissions);
			permissions = [...(t.permission_policy === "local-role" ? snapshotAccessPermissionCeiling(authored) : constrainAccessPermissions(authored,approved))];
		}
		const recipientPaths = (after: boolean) => row.state === "active" && r.state === "active" && live(t.valid_from,t.valid_until) &&
			(t.membership_id === null || (row.recipient_kind === "subject" && eligible(t,row.eligibility,required(row.recipient_subject_id),after))) ? (() => {
				const found = recipients(row,after);
				if (t.membership_id !== null && row.recipient_subject_id !== null) {
					const m = required(members.get(t.membership_id));
					found.set(row.recipient_subject_id,[{ membershipId: m.id,generation: t.membership_generation,
						selectionGroupId: t.selection_group_id,selectionVersion: t.selection_version,selectionSetVersion: m.selectionSet?.version ?? null,
						groups: t.selection_group_id === null ? [] : [t.selection_group_id] }]);
				}
				return found;
			})() : new Map<string,z.infer<typeof GroupImpactPathSchema>[]>();
		append({ kind: "binding",sourceId: row.id,sourceVersion: row.version,termsRevision: t.revision,roleId: r.id,roleRevision: r.active_revision,entityId: null,dependencySubjectIds: [],conditions: null,
			recipientGroup: row.recipient_kind === "group" ? { scopeId: required(row.recipient_scope_id),groupId: required(row.recipient_group_id) } : null,
			scopeId: row.target_scope_id,targetPath: t.target_path,lineage: [],lineageBases: [],validFrom: t.valid_from.toISOString(),validUntil: t.valid_until?.toISOString() ?? null },recipientPaths(false),recipientPaths(true),permissions);
	}
	for (const key of [...affectedRepresentations].sort()) {
		const row = required(representations.get(key)); if (row.terms_revision === null) continue;
		const t = required(row.terms), approved = decoded(t,row.permissions), lineage: { id: string; revision: number }[] = [];
		const exactRecipients = (after: boolean) => {
			const found = recipients(row,after);
			if (t.membership_id !== null && row.recipient_subject_id !== null) {
				const m = required(members.get(t.membership_id));
				found.set(row.recipient_subject_id,[{ membershipId: m.id,generation: t.membership_generation,selectionGroupId: t.selection_group_id,
					selectionVersion: t.selection_version,selectionSetVersion: m.selectionSet?.version ?? null,
					groups: t.selection_group_id === null ? [] : [t.selection_group_id] }]);
			}
			return found;
		};
		const before = representationLive(row,false,lineage) ? exactRecipients(false) : new Map<string,z.infer<typeof GroupImpactPathSchema>[]>();
		const afterLineage: typeof lineage = [];
		const after = representationLive(row,true,afterLineage) ? exactRecipients(true) : new Map<string,z.infer<typeof GroupImpactPathSchema>[]>();
		append({ kind: "representation",sourceId: row.id,sourceVersion: row.version,termsRevision: t.revision,roleId: null,roleRevision: null,entityId: row.entity_id,
			dependencySubjectIds: [...new Set([...lineage,...afterLineage].flatMap(reference => {
				const subject = representations.get(reference.id)?.parent_subject_id; return subject ? [subject] : [];
			}))],conditions: { requireFreshSession: t.require_fresh_session,canRedelegate: t.can_redelegate },
			recipientGroup: row.recipient_kind === "group" ? { scopeId: required(row.recipient_scope_id),groupId: required(row.recipient_group_id) } : null,
			scopeId: t.target_scope_id,targetPath: t.target_path,lineage: lineage.length >= afterLineage.length ? lineage : afterLineage,
			lineageBases: [...new Map([...lineage,...afterLineage].map(reference => [reference.id,reference])).values()].flatMap(reference => {
				const edge = required(representations.get(reference.id));
				if (edge.parent_grant_id === null) return [];
				const scopeId = edge.parent_membership_id === null ? null : required(members.get(edge.parent_membership_id)).scope_id;
				return [{ grantId: edge.id,subjectId: required(edge.parent_subject_id),membershipId: edge.parent_membership_id,generation: edge.parent_membership_generation,
					selectionGroupId: edge.parent_selection_group_id,selectionVersion: edge.parent_selection_version,
					beforeGroups: edge.parent_selection_group_id === null ? [] : groupPath(edge.parent_selection_group_id,required(scopeId),false),
					afterGroups: edge.parent_selection_group_id === null ? [] : groupPath(edge.parent_selection_group_id,required(scopeId),true) }];
			}),
			validFrom: t.valid_from.toISOString(),validUntil: t.valid_until?.toISOString() ?? null },before,after,[...constrainAccessPermissions(approved,approved)]);
	}
 // A selected manager path can gain/lose the ability to exercise its attached
 // ceiling even when the ceiling's own recipient set does not change. Retain
 // that recipient predicate symbolically; enumerating its population is neither
 // necessary nor a bounded representation of confer authority.
 for (const row of ceilings.values()) {
  const manager = required(bindings.get(row.manager_binding_id)), mt = required(manager.terms), role = required(roles.get(manager.role_id));
  if (row.state !== "active" || !live(row.valid_from,row.valid_until) || manager.terms_revision !== row.manager_terms_revision || manager.state !== "active" || role.state !== "active" || role.active_revision === null || !live(mt.valid_from,mt.valid_until)) continue;
  const authored = decoded(required(role.terms),role.permissions), approved = decoded(mt,manager.permissions);
  const authority = mt.permission_policy === "local-role" ? authored : constrainAccessPermissions(authored,approved);
  if (!authority.some(permission => permission.family === "management" && permission.key === "access.role-binding.manage")) continue;
  const managerPaths = (after: boolean) => {
   if (mt.membership_id !== null && (manager.recipient_kind !== "subject" || !eligible(mt,manager.eligibility,required(manager.recipient_subject_id),after))) return new Map<string,z.infer<typeof GroupImpactPathSchema>[]>();
   const found = recipients(manager,after);
   if (mt.membership_id !== null && manager.recipient_subject_id !== null) {
    const m = required(members.get(mt.membership_id));
    found.set(manager.recipient_subject_id,[{ membershipId: m.id,generation: mt.membership_generation,selectionGroupId: mt.selection_group_id,
     selectionVersion: mt.selection_version,selectionSetVersion: m.selectionSet?.version ?? null,groups: mt.selection_group_id ? [mt.selection_group_id] : [] }]);
   }
   return found;
  };
  append({ kind: "ceiling",sourceId: row.id,sourceVersion: row.version,termsRevision: row.manager_terms_revision,roleId: row.role_id,roleRevision: null,
   entityId: null,dependencySubjectIds: [],conditions: null,recipientGroup: null,scopeId: row.scope_id,targetPath: row.target_path,lineage: [],lineageBases: [],
   validFrom: row.valid_from.toISOString(),validUntil: row.valid_until?.toISOString() ?? null,
   ceilingRecipient: { kind: row.recipient_kind,subjectId: row.recipient_subject_id,groupId: row.recipient_group_id,scopeId: row.recipient_scope_id,
    memberSubjectKind: row.member_subject_kind,maximumGrantDurationSeconds: row.maximum_grant_duration_seconds,grantNotAfter: row.grant_not_after?.toISOString() ?? null },
  },managerPaths(false),managerPaths(true),decoded(row,row.permissions));
 }
	// A ceiling changes confer eligibility, never data access. Keep it in a separate effect family.
	for (const row of [...ceilings.values()].sort((a,b) => a.id.localeCompare(b.id))) {
		const permissions = decoded(row,row.permissions); decoded(row.managerTerms,row.managerPermissions);
		if (row.recipient_kind !== "group" || row.state !== "active" || !live(row.valid_from,row.valid_until)) continue;
		append({ kind: "ceiling",sourceId: row.id,sourceVersion: row.version,termsRevision: null,roleId: row.role_id,roleRevision: null,entityId: null,dependencySubjectIds: [],conditions: null,
			recipientGroup: row.recipient_kind === "group" ? { scopeId: required(row.recipient_scope_id),groupId: required(row.recipient_group_id) } : null,
			scopeId: row.scope_id,targetPath: row.target_path,lineage: [],lineageBases: [],validFrom: row.valid_from.toISOString(),validUntil: row.valid_until?.toISOString() ?? null },recipients(row,false),recipients(row,true),permissions);
	}
	return effects.map(effect => GroupImpactEffectSchema.parse(effect));
}
