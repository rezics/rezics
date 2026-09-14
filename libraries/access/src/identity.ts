/** Private authority subjects; member sets are grant recipients, never callers. @internal */
export type AccessSubjectTarget =
	| { kind: "principal"; id: string }
	| { kind: "entity"; id: string };

/** Immutable authority roots. Public roots reuse the existing Unit REF registry. @internal */
export type AccessScopeTarget =
	| { kind: "platform" }
	| { kind: "account"; id: string }
	| { kind: "resource"; referenceValueId: string };

/** Explicit representation target limit; all-scopes never adds permissions or resource grants. @internal */
export type RepresentationTarget =
	| { kind: "all-scopes" }
	| { kind: "scope"; scopeId: string; path: string[] };

/** An exact representation basis selected by a caller; it is not proof of current authority. @alpha */
export interface RepresentationReference {
	id: string;
	revision: number;
}

/**
 * Requested authority for the forthcoming mixed IAM APIs.
 * @alpha
 * @remarks Direct mode derives the private principal from authentication. A
 * represented payload carries its Entity and grant revisions instead of deriving
 * them from a mutable default. Producers retain it with prepared work; servers
 * validate every basis used.
 */
export type RequestedAuthoritySelection =
	| { mode: "direct" }
	| { mode: "represented"; entityId: string; representations: RepresentationReference[] };
