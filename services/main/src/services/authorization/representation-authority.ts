import { eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AccessSubjectTarget, RequestedAuthoritySelection } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { AuthorityOperationSchema, RequestedAuthoritySelectionSchema, type AuthorityOperation, type AuthorityOutcome } from "./authority-context";
import { readCurrentAccessRepresentations, AccessRepresentationBudgetExceeded } from "./representation-reader";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { readAccessMemberSetRecipients } from "./member-set-recipients";
import { evaluateRepresentationPath, type RepresentationPathEvaluationInput, type RepresentationPathGrant } from "./representation-paths";
import { AccessRepresentationUnavailable } from "./representations";

function combined(outcomes: AuthorityOutcome[]): AuthorityOutcome {
	return outcomes.includes("deny") ? "deny" : outcomes.includes("unavailable") ? "unavailable" : "allow";
}

/**
 * Evaluate one represented operation from native current grant, subject and membership owners.
 * @internal
 * @remarks Principal and fresh-session facts come from verified authentication;
 * credential/installation limits must already admit the entire explicit selection.
 * The resource owner supplies the operation and read/write/contribute classification.
 * This closes representation's local evidence, not resource permission, restrictions,
 * assignment authority, independent approval or complete mutation fence promotion.
 * The caller retains the transaction and re-evaluates before later effects.
 */
export async function evaluateCurrentRepresentationAuthority(
	tx: DatabaseTransaction,
	input: {
		principalId: string;
		selection: Extract<RequestedAuthoritySelection, { mode: "represented" }>;
		operation: AuthorityOperation;
		action: "read" | "write" | "contribute";
		freshSession: boolean;
		freshSessionValidUntil?: number | null;
	},
) {
	const request = z.strictObject({ principalId: z.uuid().toLowerCase(), selection: RequestedAuthoritySelectionSchema,
		operation: AuthorityOperationSchema, action: z.enum(["read", "write", "contribute"]), freshSession: z.boolean(), freshSessionValidUntil: z.number().finite().nullable().default(null) }).parse(input);
	if (request.selection.mode !== "represented") throw new AccessRepresentationUnavailable();
	const selection = request.selection;
	const loaded = await readCurrentAccessRepresentations(tx, selection.representations);
	const entityIds = [...new Set([selection.entityId, ...loaded.grants.map(grant => grant.head.entityId)])];
	const subjects = await tx.select().from(accessSubject).where(or(
		eq(accessSubject.authUserId, request.principalId), inArray(accessSubject.entityId, entityIds),
		loaded.dependencySubjectIds.length ? inArray(accessSubject.id, loaded.dependencySubjectIds) : undefined,
	)).limit(257);
	if (subjects.length > 256) throw new AccessRepresentationBudgetExceeded();
	const principal = subjects.find(subject => subject.authUserId === request.principalId);
	const represented = subjects.find(subject => subject.entityId === selection.entityId);
	if (!principal || !represented) return { outcome: "deny" as const, basis: null, path: [], validUntil: null };
	const byId = new Map(subjects.map(subject => [subject.id, subject]));
	const subjectTargets = new Map<string, AccessSubjectTarget>();
	for (const subject of subjects) subjectTargets.set(subject.id, subject.authUserId !== null
		? { kind: "principal", id: subject.authUserId } : { kind: "entity", id: z.uuid().toLowerCase().parse(subject.entityId) });
	for (const subjectId of loaded.dependencySubjectIds) if (!byId.has(subjectId)) throw new AccessRepresentationUnavailable();
	// Lock subject lifecycles before recipient membership discovery; reread time-sensitive
	// policy once every membership wait has completed.
	await readAccessSubjectEligibility(tx, { subjectIds: subjects.map(subject => subject.id), action: request.action });
	const graphSubjectIds = new Set<string>([principal.id, represented.id]);
	for (const grant of loaded.grants) {
		const owner = subjects.find(subject => subject.entityId === grant.head.entityId);
		if (!owner) throw new AccessRepresentationUnavailable();
		graphSubjectIds.add(owner.id);
		if (grant.head.recipientSubjectId) {
			const target = byId.get(grant.head.recipientSubjectId);
			if (!target) throw new AccessRepresentationUnavailable();
			if (target.entityId !== null) graphSubjectIds.add(target.id);
		}
	}
	if (graphSubjectIds.size > 65) throw new AccessRepresentationBudgetExceeded();
	const scopes = [...new Set(loaded.grants.flatMap(grant => grant.head.recipientScopeId ? [grant.head.recipientScopeId] : []))].sort();
	if (scopes.length * graphSubjectIds.size > 256) throw new AccessRepresentationBudgetExceeded();
	const membership = new Map<string, Awaited<ReturnType<typeof readAccessMemberSetRecipients>>>();
	let memberSetCount = 0;
	for (const subjectId of [...graphSubjectIds].sort()) {
		const sets = await readAccessMemberSetRecipients(tx, { subjectId, scopeIds: scopes });
		memberSetCount += sets.recipients.length;
		if (memberSetCount > 4096) throw new AccessRepresentationBudgetExceeded();
		membership.set(subjectId, sets);
	}
	const eligibility = await readAccessSubjectEligibility(tx, { subjectIds: subjects.map(subject => subject.id), action: request.action });
	const eligibilityById = new Map(eligibility.map(fact => [fact.subjectId, fact]));
	const nowRows = (await tx.execute<{ id: string; liveness: boolean | null; now: string }>(sql`
		select selected.id,public.access_representation_is_current(selected.id,selected.revision) as liveness,
		clock_timestamp()::text as now from (values
		${sql.join(selection.representations.map(ref => sql`(${ref.id}::uuid,${ref.revision}::bigint)`), sql`, `)}) selected(id,revision)`)).rows;
	const current = new Map(nowRows.map(row => [row.id, row]));
	const now = Math.max(...nowRows.map(row => new Date(row.now).getTime()));
	if (!Number.isFinite(now)) throw new AccessRepresentationUnavailable();
	const grants: RepresentationPathGrant[] = loaded.grants.map(({ head, terms, permissions, parentSubjectIds }) => {
		const row = current.get(head.id);
		if (!row) throw new AccessRepresentationUnavailable();
		let recipient: RepresentationPathGrant["recipient"];
		if (head.recipientKind === "subject" && head.recipientSubjectId) {
			const target = subjectTargets.get(head.recipientSubjectId);
			if (!target) throw new AccessRepresentationUnavailable();
			recipient = target;
		} else if (head.recipientKind === "group" && head.recipientScopeId && head.recipientGroupId)
			recipient = { kind: "group", scopeId: head.recipientScopeId, groupId: head.recipientGroupId };
		else if (head.recipientKind === "all-members" && head.recipientScopeId)
			recipient = { kind: "all-members", scopeId: head.recipientScopeId };
		else throw new AccessRepresentationUnavailable();
		const parents = parentSubjectIds.map(id => eligibilityById.get(id));
		if (parents.some(parent => !parent)) throw new AccessRepresentationUnavailable();
		const deadlines = row.liveness === true
			? [terms.validUntil?.getTime(), ...parents.map(parent => parent?.validUntil)]
				.filter((deadline): deadline is number => deadline !== undefined)
			: [];
		return { grant: { id: head.id, revision: terms.revision }, entityId: head.entityId,
			target: terms.targetKind === "all-scopes" ? { kind: "all-scopes" }
				: { kind: "scope", scopeId: z.uuid().toLowerCase().parse(terms.targetScopeId), path: terms.targetPath }, recipient, permissions,
			canRedelegate: terms.canRedelegate, requireFreshSession: terms.requireFreshSession,
			current: combined([row.liveness === true ? "allow" : row.liveness === false ? "deny" : "unavailable",
				...parents.map(parent => parent?.outcome ?? "unavailable")]),
			...(deadlines.length ? { validUntil: Math.min(...deadlines) } : {}) };
	});
	const graphSubjects: RepresentationPathEvaluationInput["subjects"] = [...graphSubjectIds].map(subjectId => {
		const fact = eligibilityById.get(subjectId), sets = membership.get(subjectId);
		if (!fact || !sets) throw new AccessRepresentationUnavailable();
		return { subject: fact.subject, current: fact.outcome, loadedScopes: scopes, memberSets: sets.recipients,
			...(fact.validUntil !== undefined ? { validUntil: fact.validUntil } : {}) };
	});
	const result = evaluateRepresentationPath({ principalId: request.principalId, selection,
		operation: request.operation, now, freshSession: request.freshSession, freshSessionValidUntil: request.freshSessionValidUntil, grants, subjects: graphSubjects });
 return { ...result, sourceEvidence: {
  grants: loaded.grants.map(grant => ({ id: grant.head.id,version: grant.head.version,revision: grant.terms.revision })).sort((a,b) => a.id.localeCompare(b.id)),
  memberSets: [...membership.values()].map(value => ({ subjectId: value.subjectId,
   memberships: value.memberships.map(member => ({ id: member.id,scopeId: member.scopeId,version: member.version,generation: member.activeGeneration })),
   selections: value.selections,recipients: value.recipients,
  })).sort((a,b) => a.subjectId.localeCompare(b.subjectId)),
 } };
}
