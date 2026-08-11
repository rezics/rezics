export const AuditEventCategoryValues = [
	"admin_activity",
	"policy_denied",
	"system_event",
] as const;
export type AuditEventCategory = (typeof AuditEventCategoryValues)[number];

export const AuditEventOutcomeValues = ["succeeded", "denied", "failed"] as const;
export type AuditEventOutcome = (typeof AuditEventOutcomeValues)[number];

export const AuditCredentialKindValues = ["session", "api_token", "bootstrap", "system"] as const;
export type AuditCredentialKind = (typeof AuditCredentialKindValues)[number];

export const AuditAuthorityKindValues = ["platform", "realm", "zone", "unit"] as const;
export type AuditAuthorityKind = (typeof AuditAuthorityKindValues)[number];

export type AuditActor =
	| {
			readonly kind: "profile";
			readonly profileId: string;
			readonly credentialKind?: Exclude<AuditCredentialKind, "system">;
			readonly credentialId?: string;
	  }
	| {
			readonly kind: "system";
			readonly credentialKind?: "system" | "bootstrap";
			readonly credentialId?: string;
	  };

export type AuditAuthority =
	| { readonly kind: "platform" }
	| { readonly kind: "realm" | "zone" | "unit"; readonly id: string };

export interface AuditTarget {
	readonly kind: string;
	readonly id?: string;
	readonly path?: string;
}

export interface AuditRecord {
	readonly category: AuditEventCategory;
	readonly outcome: AuditEventOutcome;
	readonly actor: AuditActor;
	readonly authority: AuditAuthority;
	readonly action: string;
	/** Machine outcome only; human policy basis belongs to governanceDecisionId. */
	readonly outcomeCode?: string;
	readonly governanceDecisionId?: string;
	readonly requestId?: string;
	readonly traceId?: string;
	readonly target?: AuditTarget;
	readonly details?: Readonly<Record<string, unknown>>;
	readonly createdAt?: Date;
}
