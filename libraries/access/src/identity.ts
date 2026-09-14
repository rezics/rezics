/** Private authority subjects; member sets are grant recipients, never callers. @internal */
export type AccessSubjectTarget =
	| { kind: "principal"; id: string }
	| { kind: "entity"; id: string };

/** Immutable authority roots. Public roots reuse the existing Unit REF registry. @internal */
export type AccessScopeTarget =
	| { kind: "platform" }
	| { kind: "account"; id: string }
	| { kind: "resource"; referenceValueId: string };
