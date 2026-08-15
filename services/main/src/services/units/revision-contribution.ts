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

export const defaultRevisionContribution: TrustedRevisionContribution = {
	primary: "unattributed",
};

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
