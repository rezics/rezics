import {
	RevisionAttributionAssuranceValues,
	RevisionContributionRoleValues,
	UnitRevisionPrimaryContributionKindValues,
	type RevisionAttributionAssurance,
	type RevisionContributionRole,
	type UnitRevisionPrimaryContributionKind,
} from "../database/schema/contract-values";

export {
	RevisionAttributionAssuranceValues,
	RevisionContributionRoleValues,
	UnitRevisionPrimaryContributionKindValues,
};
export type {
	RevisionAttributionAssurance,
	RevisionContributionRole,
	UnitRevisionPrimaryContributionKind,
};

/** Untrusted contribution declaration accepted at a mutation boundary. */
export type RevisionContributionInput =
	| { readonly primary: "human" }
	| {
			readonly primary: "ai";
			readonly creditedEntityId: string;
			readonly role: RevisionContributionRole;
	  }
	| { readonly primary: "unattributed" };

/** Server-owned contribution value persisted with a revision. */
export type TrustedRevisionContribution =
	| { readonly primary: "human" }
	| {
			readonly primary: "ai";
			readonly creditedEntityId: string;
			readonly role: RevisionContributionRole;
			readonly assurance: RevisionAttributionAssurance;
	  }
	| { readonly primary: "unattributed" };

/** Nullable columns produced by the revision-to-credit outer join. */
export type StoredRevisionPrimaryContribution = {
	readonly kind: UnitRevisionPrimaryContributionKind;
	readonly creditedEntityId: string | null;
	readonly role: RevisionContributionRole | null;
	readonly assurance: RevisionAttributionAssurance | null;
};

/** Public discriminated contribution value reconstructed from normalized storage. */
export type RevisionPrimaryContribution =
	| { readonly kind: "human" }
	| {
			readonly kind: "ai";
			readonly creditAttribution: {
				readonly creditedEntityId: string;
				readonly role: RevisionContributionRole;
				readonly assurance: RevisionAttributionAssurance;
			};
	  }
	| { readonly kind: "unattributed" };

export const defaultRevisionContribution: TrustedRevisionContribution = {
	primary: "unattributed",
};

export function presentStoredRevisionPrimaryContribution(
	stored: StoredRevisionPrimaryContribution,
): RevisionPrimaryContribution {
	if (stored.kind === "ai") {
		if (stored.creditedEntityId === null || stored.role === null || stored.assurance === null)
			throw new TypeError("AI revision is missing its credit attribution");
		return {
			kind: "ai",
			creditAttribution: {
				creditedEntityId: stored.creditedEntityId,
				role: stored.role,
				assurance: stored.assurance,
			},
		};
	}
	if (stored.creditedEntityId !== null || stored.role !== null || stored.assurance !== null)
		throw new TypeError(`${stored.kind} revision cannot have AI credit attribution`);
	return { kind: stored.kind };
}

export function isRevisionContributionRole(value: string): value is RevisionContributionRole {
	return (RevisionContributionRoleValues as readonly string[]).includes(value);
}

export function isRevisionAttributionAssurance(
	value: string,
): value is RevisionAttributionAssurance {
	return (RevisionAttributionAssuranceValues as readonly string[]).includes(value);
}

export function isUnitRevisionPrimaryContributionKind(
	value: string,
): value is UnitRevisionPrimaryContributionKind {
	return (UnitRevisionPrimaryContributionKindValues as readonly string[]).includes(value);
}
