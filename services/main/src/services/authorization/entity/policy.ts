import {
	type AssociationKind,
	EntityAssociationPolicyModeValues,
} from "../../database/schema/contract-values";

export type { AssociationKind };
export type EntityAssociationPolicyMode = (typeof EntityAssociationPolicyModeValues)[number];
export type EntityAssociationCommand = "direct" | "request" | "invitation";

export const DefaultEntityAssociationPolicy = {
	creditAttribution: "approval",
	subjectAssociation: "open",
} as const satisfies EntityAssociationPolicy;

export type EntityAssociationPolicy = {
	readonly creditAttribution: EntityAssociationPolicyMode;
	readonly subjectAssociation: EntityAssociationPolicyMode;
};

export function policyFieldFor(kind: AssociationKind): keyof EntityAssociationPolicy {
	return kind === "credit" ? "creditAttribution" : "subjectAssociation";
}

export function resolveEntityAssociationPolicy(
	rows: ReadonlyArray<{
		readonly kind: AssociationKind;
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

export type EntityAssociationAdmission =
	| { readonly kind: "materialize" }
	| { readonly kind: "proposal"; readonly awaiting: "source" | "target" }
	| { readonly kind: "forbidden" };

export function resolveEntityAssociationAdmission(input: {
	readonly mode: EntityAssociationPolicyMode;
	readonly command: EntityAssociationCommand;
	readonly targetManager: boolean;
	readonly platformOverride: boolean;
}): EntityAssociationAdmission {
	if (input.command === "direct") {
		if (
			input.platformOverride ||
			input.mode === "open" ||
			(input.targetManager && input.mode !== "closed")
		)
			return { kind: "materialize" };
		return { kind: "forbidden" };
	}
	if (input.command === "request")
		return input.mode === "approval"
			? { kind: "proposal", awaiting: "target" }
			: { kind: "forbidden" };
	if ((input.targetManager || input.platformOverride) && input.mode !== "closed")
		return { kind: "proposal", awaiting: "source" };
	return { kind: "forbidden" };
}
