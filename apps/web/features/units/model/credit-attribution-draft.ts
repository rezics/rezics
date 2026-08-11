import type { EntityPickerValue } from "@rezics/ui";

import {
	type CreditAttributionRole,
	isCreditAttributionRoleForUnitType,
} from "../attribution-role";
import type { VariantUnitType } from "../unit-types";

export interface CreditAttributionDraft {
	readonly key: string;
	readonly entity?: EntityPickerValue;
	readonly role?: CreditAttributionRole;
}

export interface CreditAttributionDraftIssue {
	readonly duplicate: boolean;
	readonly entityRequired: boolean;
	readonly roleRequired: boolean;
}

const DefaultCreditAttributionRoleByUnitType = {
	book: "author",
	software: "developer",
	media: "director",
} as const satisfies Record<VariantUnitType, CreditAttributionRole>;

export function createCreditAttributionDraft(type: VariantUnitType): CreditAttributionDraft {
	return {
		key: crypto.randomUUID(),
		role: DefaultCreditAttributionRoleByUnitType[type],
	};
}

export type CreditAttributionDraftValidation =
	| {
			readonly ok: true;
			readonly creditAttributions: {
				readonly entityId: string;
				readonly role: CreditAttributionRole;
			}[];
			readonly issues: Readonly<Record<string, CreditAttributionDraftIssue>>;
	  }
	| {
			readonly ok: false;
			readonly issues: Readonly<Record<string, CreditAttributionDraftIssue>>;
	  };

const EmptyIssue: CreditAttributionDraftIssue = {
	duplicate: false,
	entityRequired: false,
	roleRequired: false,
};

export function validateCreditAttributionDrafts(
	type: VariantUnitType,
	drafts: readonly CreditAttributionDraft[],
): CreditAttributionDraftValidation {
	const creditAttributions: {
		entityId: string;
		role: CreditAttributionRole;
	}[] = [];
	const issues: Record<string, CreditAttributionDraftIssue> = {};
	const pairs = new Set<string>();
	let invalid = false;

	for (const draft of drafts) {
		const entityRequired = !draft.entity;
		const role =
			draft.role && isCreditAttributionRoleForUnitType(type, draft.role) ? draft.role : undefined;
		const roleRequired = !role;
		const pair = draft.entity && role ? `${draft.entity.id}\u0000${role}` : undefined;
		const duplicate = pair ? pairs.has(pair) : false;
		if (pair) pairs.add(pair);
		const issue =
			entityRequired || roleRequired || duplicate
				? { duplicate, entityRequired, roleRequired }
				: EmptyIssue;
		issues[draft.key] = issue;
		if (!draft.entity || !role || duplicate) {
			invalid = true;
			continue;
		}
		creditAttributions.push({ entityId: draft.entity.id, role });
	}

	if (invalid) return { ok: false, issues };
	return {
		ok: true,
		creditAttributions,
		issues,
	};
}
