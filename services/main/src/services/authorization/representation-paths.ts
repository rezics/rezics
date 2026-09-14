import {
	AccessPermissionValues, accessPermissionKey, constrainAccessPermissions,
	type AccessPermission, type AccessSubjectTarget, type RepresentationReference,
} from "@rezics/access";
import { z } from "zod";
import { AccessPermissionSchema } from "./permission";
import { RequestedAuthoritySelectionSchema, AuthorityOperationSchema, type AuthorityOperation, type AuthorityOutcome } from "./authority-context";
import type { AccessMemberSetRecipient } from "./member-set-recipients";

const pathSchema = z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8);
const subjectSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("principal"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("entity"), id: z.uuid() }),
]);
const memberSetSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("all-members"), scopeId: z.uuid() }),
	z.strictObject({ kind: z.literal("group"), scopeId: z.uuid(), groupId: z.uuid() }),
]);
const decisionFields = { current: z.enum(["allow", "deny", "unavailable"]), validUntil: z.number().finite().optional() };
const grantSchema = z.strictObject({
	grant: z.strictObject({ id: z.uuid(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
	entityId: z.uuid(), targetScopeId: z.uuid(), targetPath: pathSchema,
	recipient: z.union([subjectSchema, memberSetSchema]),
	permissions: z.array(AccessPermissionSchema).max(AccessPermissionValues.length),
	canRedelegate: z.boolean(), requireFreshSession: z.boolean(), ...decisionFields,
});
const inputSchema = z.strictObject({
	principalId: z.uuid(),
	selection: RequestedAuthoritySelectionSchema,
	operation: AuthorityOperationSchema,
	now: z.number().finite(), freshSession: z.boolean(),
	grants: z.array(grantSchema).max(64),
	subjects: z.array(z.strictObject({
		subject: subjectSchema, ...decisionFields,
		loadedScopes: z.array(z.uuid()).max(64),
		memberSets: z.array(memberSetSchema).max(576),
	})).max(65),
});

/** Native owner facts for one selected exact representation edge, not a client assertion. @internal */
export interface RepresentationPathGrant {
	grant: RepresentationReference;
	entityId: string;
	targetScopeId: string;
	targetPath: string[];
	recipient: AccessSubjectTarget | AccessMemberSetRecipient;
	/** Literal sealed permission approval; prerequisites outside it are not imported. */
	permissions: AccessPermission[];
	canRedelegate: boolean;
	requireFreshSession: boolean;
	/** Includes exact parent lineage, conditions and recipient eligibility from current owners. */
	current: AuthorityOutcome;
	validUntil?: number;
}
/**
 * Verified context and current subject membership facts for bounded path composition.
 * @internal
 * @remarks Every grant and subject fact is loaded after native fence closure.
 * Loaded scopes distinguish proven nonmembership from an unqueried scope. This
 * model does not authenticate, read SQL, grant target permissions or certify
 * independence of approvers. Only explicit selected references are traversed.
 */
export interface RepresentationPathEvaluationInput {
	principalId: string;
	selection: z.infer<typeof RequestedAuthoritySelectionSchema>;
	operation: AuthorityOperation;
	now: number;
	freshSession: boolean;
	grants: RepresentationPathGrant[];
	subjects: {
		subject: AccessSubjectTarget;
		current: AuthorityOutcome;
		validUntil?: number;
		loadedScopes: string[];
		memberSets: AccessMemberSetRecipient[];
	}[];
}
/** A current selected basis, when any complete path permits this one operation. @internal */
export interface RepresentationPathDecision {
	outcome: AuthorityOutcome;
	basis: RepresentationReference | null;
}
function subjectKey(subject: AccessSubjectTarget) { return `${subject.kind}:${subject.id}`; }
function memberSetKey(set: AccessMemberSetRecipient) {
	return set.kind === "all-members" ? `all:${set.scopeId}` : `group:${set.scopeId}:${set.groupId}`;
}
function current(fact: { current: AuthorityOutcome; validUntil?: number }, now: number): AuthorityOutcome {
	return fact.validUntil !== undefined && fact.validUntil <= now ? "unavailable" : fact.current;
}
function combined(...outcomes: AuthorityOutcome[]): AuthorityOutcome {
	return outcomes.includes("deny") ? "deny" : outcomes.includes("unavailable") ? "unavailable" : "allow";
}

/**
 * Find a complete action/target-constrained path to the authenticated principal.
 * @internal
 * @remarks Each Entity hop requires redelegation and its own selected valid edge;
 * intermediate subjects add no unrelated target rights. Group edges test the
 * actual next subject's membership, never a union of operator/persona membership.
 * Breadth-first traversal keeps the shortest certain/uncertain visit per Entity,
 * so cycles cannot generate authority and work cannot grow exponentially. Paths
 * have at most eight edges; a 32,768-visit budget covers graph traversal after bounded fact indexing.
 * Another complete valid path can succeed despite an unavailable alternative.
 */
export function evaluateRepresentationPath(input: RepresentationPathEvaluationInput): RepresentationPathDecision {
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success || parsed.data.selection.mode !== "represented") return { outcome: "unavailable", basis: null };
	const request = parsed.data, selection = parsed.data.selection;
	if (request.subjects.reduce((count, fact) => count + fact.memberSets.length, 0) > 4096)
		return { outcome: "unavailable", basis: null };
	const facts = new Map<string, z.infer<typeof grantSchema> | null>();
	for (const fact of request.grants) facts.set(fact.grant.id, facts.has(fact.grant.id) ? null : fact);
	const subjects = new Map<string, (typeof request.subjects)[number] | null>();
	for (const fact of request.subjects) subjects.set(subjectKey(fact.subject), subjects.has(subjectKey(fact.subject)) ? null : fact);
	const membership = new Map<string, Set<string>>();
	const loaded = new Map<string, Set<string>>();
	for (const [key, fact] of subjects) if (fact) {
		membership.set(key, new Set(fact.memberSets.map(memberSetKey)));
		loaded.set(key, new Set(fact.loadedScopes));
	}
	const permission = accessPermissionKey(request.operation.permission);
	const selected = new Map<string, z.infer<typeof grantSchema> | null>();
	const eligible = new Map<string, AuthorityOutcome>();
	const byEntity = new Map<string, z.infer<typeof grantSchema>[]>();
	for (const reference of selection.representations) {
		const fact = facts.get(reference.id);
		if (fact === null) { selected.set(reference.id, null); continue; }
		if (!fact || fact.grant.revision !== reference.revision) continue;
		selected.set(reference.id, fact);
		const permissions = constrainAccessPermissions(fact.permissions, fact.permissions);
		const fits = fact.targetScopeId === request.operation.scopeId &&
			fact.targetPath.length <= request.operation.path.length &&
			fact.targetPath.every((segment, index) => segment === request.operation.path[index]) &&
			permissions.some(value => accessPermissionKey(value) === permission) &&
			(!fact.requireFreshSession || request.freshSession);
		eligible.set(reference.id, fits ? current(fact, request.now) : "deny");
		const edges = byEntity.get(fact.entityId) ?? [];
		edges.push(fact); byEntity.set(fact.entityId, edges);
	}
	const principal: AccessSubjectTarget = { kind: "principal", id: request.principalId };
	const entityIds = new Set<string>(byEntity.keys());
	for (const fact of selected.values()) if (fact?.recipient.kind === "entity") entityIds.add(fact.recipient.id);
	for (const fact of request.subjects) if (fact.subject.kind === "entity") entityIds.add(fact.subject.id);
	const entities = [...entityIds].map((id): AccessSubjectTarget => ({ kind: "entity", id }));
	function subjectOutcome(subject: AccessSubjectTarget): AuthorityOutcome {
		const fact = subjects.get(subjectKey(subject));
		return fact ? current(fact, request.now) : "unavailable";
	}
	function receives(recipient: RepresentationPathGrant["recipient"], subject: AccessSubjectTarget): AuthorityOutcome {
		if (recipient.kind === "entity" || recipient.kind === "principal")
			return recipient.kind === subject.kind && recipient.id === subject.id ? subjectOutcome(subject) : "deny";
		const key = subjectKey(subject);
		if (subjectOutcome(subject) === "deny") return "deny";
		if (!loaded.get(key)?.has(recipient.scopeId)) return "unavailable";
		return membership.get(key)?.has(memberSetKey(recipient)) ? subjectOutcome(subject) : "deny";
	}
	if (subjectOutcome(principal) === "deny" || subjectOutcome({ kind: "entity", id: selection.entityId }) === "deny")
		return { outcome: "deny", basis: null };
	let probes = 0, unavailable = false;
	for (const reference of selection.representations) {
		const base = selected.get(reference.id);
		if (base === null) { unavailable = true; continue; }
		if (!base || base.entityId !== selection.entityId) continue;
		const queue: { fact: z.infer<typeof grantSchema>; depth: number; prefix: AuthorityOutcome }[] = [{ fact: base, depth: 1, prefix: subjectOutcome({ kind: "entity", id: selection.entityId }) }];
		const visits = new Map<string, number>([[`${selection.entityId}:allow`, 0], [`${selection.entityId}:unavailable`, 0]]);
		for (let index = 0; index < queue.length; index++) {
			if (++probes > 32768) return { outcome: "unavailable", basis: null };
			const item = queue[index]!;
			const edge = combined(item.prefix, eligible.get(item.fact.grant.id) ?? "unavailable");
			if (edge === "deny") continue;
			const terminal = combined(edge, receives(item.fact.recipient, principal));
			if (terminal === "allow") return { outcome: "allow", basis: reference };
			if (terminal === "unavailable") unavailable = true;
			if (!item.fact.canRedelegate || item.depth >= 8) continue;
			for (const entity of entities) {
				if (++probes > 32768) return { outcome: "unavailable", basis: null };
				const prefix = combined(edge, receives(item.fact.recipient, entity));
				if (prefix === "deny") continue;
				const key = `${entity.id}:${prefix}`;
				if ((visits.get(key) ?? Infinity) <= item.depth) continue;
				visits.set(key, item.depth);
				for (const next of byEntity.get(entity.id) ?? []) queue.push({ fact: next, depth: item.depth + 1, prefix });
			}
		}
	}
	return { outcome: unavailable ? "unavailable" : "deny", basis: null };
}
