import {
	PlatformCapabilityValues,
	UnitPermissionValues,
	unitScope,
	type AccessSubjectTarget,
	type PlatformCapability,
	type UnitPermission,
	type RequestedAuthoritySelection,
	type RepresentationReference,
} from "@rezics/access";
import { z } from "zod";

const uuidSchema = z.uuid();
const referenceSchema = z.strictObject({
	id: uuidSchema,
	revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
/** Requested selection only; credential and live representation validation remain server-owned. @alpha */
export const RequestedAuthoritySelectionSchema = z.discriminatedUnion("mode", [
	z.strictObject({ mode: z.literal("direct") }),
	z.strictObject({
		mode: z.literal("represented"),
		entityId: uuidSchema,
		representations: z
			.array(referenceSchema)
			.min(1)
			.max(64)
			.refine(
				(refs) => new Set(refs.map((ref) => ref.id)).size === refs.length,
				"Representation references must be unique",
			),
	}),
]);

/** A registered operation at one exact private authority root and normalized descendant path. @internal */
export interface AuthorityOperation {
	permission: UnitPermission | PlatformCapability;
	scopeId: string;
	path: readonly string[];
}
/** A current policy outcome, not a reusable authorization receipt. @internal */
export type AuthorityOutcome = "allow" | "deny" | "unavailable";
interface Decision {
	outcome: AuthorityOutcome;
	/** Exclusive epoch-millisecond boundary after which the owner must re-evaluate this fact. */
	validUntil?: number;
}
interface OperationDecision extends Decision {
	operation: AuthorityOperation;
}

/**
 * Trusted owner decisions for one authenticated request.
 * @internal
 * @remarks These facts must never be accepted from an API client. Owners produce
 * them after current policy reads/fences and include operation-specific conditions.
 * This combiner neither fetches those facts nor proves their freshness. The result
 * cannot authorize a later transaction or replace revocation/erasure fences.
 */
export interface AuthorityEvaluationInput {
	principalId: string;
	selection: RequestedAuthoritySelection;
	operations: AuthorityOperation[];
	/** Current owning-authority time after its required waits/fences, in epoch milliseconds. */
	now: number;
	actor: Decision & { principalId: string };
	credential: {
		principalId: string;
		/** Only server-verified operator credentials may select any currently authorized context. */
		authority: { mode: "operator" } | RequestedAuthoritySelection;
		decisions: OperationDecision[];
	};
	resourceDecisions: (OperationDecision & { principalId: string; subject: AccessSubjectTarget })[];
	representations: {
		principalId: string;
		entityId: string;
		grant: RepresentationReference;
		decisions: OperationDecision[];
	}[];
}

const permissions = new Set<string>([...UnitPermissionValues, ...PlatformCapabilityValues]);
function sameSubject(first: AccessSubjectTarget, second: AccessSubjectTarget) {
	return first?.kind === second.kind && first.id === second.id;
}
function sameReference(first: RepresentationReference, second: RepresentationReference) {
	return first?.id === second.id && first.revision === second.revision;
}
function operationKey(operation: AuthorityOperation): string | undefined {
	if (
		!operation ||
		!permissions.has(operation.permission) ||
		!uuidSchema.safeParse(operation.scopeId).success ||
		!Array.isArray(operation.path) ||
		operation.path.length > 8 ||
		operation.path.some((segment) => typeof segment !== "string" || segment.length > 256)
	)
		return undefined;
	try {
		unitScope(...operation.path);
	} catch {
		return undefined;
	}
	return JSON.stringify([operation.permission, operation.scopeId, operation.path]);
}
function outcome(decision: Decision, now: number): AuthorityOutcome {
	if (
		decision.validUntil !== undefined &&
		(!Number.isFinite(decision.validUntil) || decision.validUntil <= now)
	)
		return "unavailable";
	return ["allow", "deny", "unavailable"].includes(decision.outcome)
		? decision.outcome
		: "unavailable";
}
type DecisionIndex = Map<string, Decision | null>;
function indexDecisions(decisions: OperationDecision[]): DecisionIndex {
	const index: DecisionIndex = new Map();
	for (const decision of decisions) {
		const key = operationKey(decision.operation);
		if (key !== undefined) index.set(key, index.has(key) ? null : decision);
	}
	return index;
}
function uniqueDecision(index: DecisionIndex, key: string, now: number): AuthorityOutcome {
	const decision = index.get(key);
	return decision ? outcome(decision, now) : "unavailable";
}

/**
 * Combine complete, actor/subject/operation-bound current decisions without pooling identities.
 * @internal
 * @remarks At most 64 operations/bases, 256 operation facts and one actor fact are admitted.
 * Permission inheritance, group membership, path discovery, assignment ceilings and
 * database fence closure remain with their owning evaluators. Independent valid
 * representation paths may cover different operations for the same selected Entity.
 */
export function evaluateAuthorityContext(input: AuthorityEvaluationInput): AuthorityOutcome {
	const selection = RequestedAuthoritySelectionSchema.safeParse(input.selection);
	if (
		!selection.success ||
		!Number.isFinite(input.now) ||
		!uuidSchema.safeParse(input.principalId).success
	)
		return "unavailable";
	if (
		input.operations.length === 0 ||
		input.operations.length > 64 ||
		input.representations.length > 64
	)
		return "unavailable";
	let facts = input.resourceDecisions.length + input.credential.decisions.length;
	if (facts > 256) return "unavailable";
	for (const representation of input.representations) {
		facts += representation.decisions.length;
		if (facts > 256) return "unavailable";
	}
	if (
		input.actor.principalId !== input.principalId ||
		input.credential.principalId !== input.principalId
	)
		return "deny";
	const requested = selection.data;
	const subject: AccessSubjectTarget =
		requested.mode === "direct"
			? { kind: "principal", id: input.principalId }
			: { kind: "entity", id: requested.entityId };
	if (input.credential.authority?.mode !== "operator") {
		const constraint = RequestedAuthoritySelectionSchema.safeParse(input.credential.authority);
		if (!constraint.success || constraint.data.mode !== requested.mode) return "deny";
		if (requested.mode === "represented") {
			if (constraint.data.mode !== "represented" || constraint.data.entityId !== requested.entityId)
				return "deny";
			const approved = constraint.data.representations;
			if (
				!requested.representations.every((ref) =>
					approved.some((allowed) => sameReference(ref, allowed)),
				)
			)
				return "deny";
		}
	}
	const results: AuthorityOutcome[] = [outcome(input.actor, input.now)];
	const resource = indexDecisions(
		input.resourceDecisions.filter(
			(decision) =>
				decision.principalId === input.principalId && sameSubject(decision.subject, subject),
		),
	);
	const credential = indexDecisions(input.credential.decisions);
	const bases = new Map<string, AuthorityEvaluationInput["representations"][number] | null>();
	if (requested.mode === "represented") {
		for (const fact of input.representations) {
			if (fact.principalId === input.principalId && fact.entityId === requested.entityId)
				bases.set(fact.grant.id, bases.has(fact.grant.id) ? null : fact);
		}
	}
	const representationDecisions =
		requested.mode === "represented"
			? requested.representations.map((ref) => {
					const fact = bases.get(ref.id);
					if (fact === null) return "unavailable" as const;
					if (!fact || !sameReference(ref, fact.grant)) return "deny" as const;
					return indexDecisions(fact.decisions);
				})
			: [];
	for (const operation of input.operations) {
		const key = operationKey(operation);
		if (key === undefined) return "unavailable";
		results.push(uniqueDecision(credential, key, input.now));
		results.push(uniqueDecision(resource, key, input.now));
		if (requested.mode === "represented") {
			const pathResults = representationDecisions.map((decision) =>
				typeof decision === "string" ? decision : uniqueDecision(decision, key, input.now),
			);
			results.push(
				pathResults.includes("allow")
					? "allow"
					: pathResults.includes("unavailable")
						? "unavailable"
						: "deny",
			);
		}
	}
	return results.includes("deny")
		? "deny"
		: results.includes("unavailable")
			? "unavailable"
			: "allow";
}
