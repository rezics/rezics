import {
	EntityAssociationKindValues,
	EntityAssociationPolicyModeValues,
} from "../../database/schema/contract-values";

export type EntityAssociationKind = (typeof EntityAssociationKindValues)[number];
export type EntityAssociationPolicyMode = (typeof EntityAssociationPolicyModeValues)[number];
export type EntityAssociationActorKind = "community" | "owner" | "platform";

export const DefaultEntityAssociationPolicy = {
	creditAttribution: "open",
	subjectAssociation: "open",
} as const satisfies EntityAssociationPolicy;

export type EntityAssociationPolicy = {
	readonly creditAttribution: EntityAssociationPolicyMode;
	readonly subjectAssociation: EntityAssociationPolicyMode;
};

export function policyFieldFor(kind: EntityAssociationKind): keyof EntityAssociationPolicy {
	return kind === "credit" ? "creditAttribution" : "subjectAssociation";
}

export function resolveEntityAssociationPolicy(
	rows: ReadonlyArray<{
		readonly kind: EntityAssociationKind;
		readonly mode: EntityAssociationPolicyMode;
	}>,
): EntityAssociationPolicy {
	const policy: {
		creditAttribution: EntityAssociationPolicyMode;
		subjectAssociation: EntityAssociationPolicyMode;
	} = { ...DefaultEntityAssociationPolicy };
	for (const row of rows) policy[policyFieldFor(row.kind)] = row.mode;
	return policy;
}

export function associationPolicyAllows(
	mode: EntityAssociationPolicyMode,
	actor: EntityAssociationActorKind,
): boolean {
	if (actor === "platform") return true;
	if (mode === "open") return true;
	return mode === "owner_only" && actor === "owner";
}
