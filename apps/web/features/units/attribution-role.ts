import {
	GetApiUnitsByTypeByUnitIdStatus200AttributionsRoleEnum,
	GetApiUnitsByTypeByUnitIdStatus200SubjectAssociationsRoleEnum,
	type GetApiUnitsByTypeByUnitIdStatus200AttributionsRoleEnum as CreditAttributionRole,
	type GetApiUnitsByTypeByUnitIdStatus200SubjectAssociationsRoleEnum as SubjectAssociationRole,
} from "@rezics/openapi-tanstack-query";

import type { UnitType } from "./unit-types";

export const CreditAttributionRoles = Object.values(
	GetApiUnitsByTypeByUnitIdStatus200AttributionsRoleEnum,
);
export const SubjectAssociationRoles = Object.values(
	GetApiUnitsByTypeByUnitIdStatus200SubjectAssociationsRoleEnum,
);

export type { CreditAttributionRole, SubjectAssociationRole };

export const CreditAttributionRolesByUnitType = {
	book: [
		"author",
		"co-author",
		"translator",
		"illustrator",
		"editor",
		"publisher",
		"letterer",
		"colorist",
	],
	software: ["developer", "publisher", "composer", "designer", "director", "producer", "writer"],
	media: [
		"director",
		"producer",
		"writer",
		"publisher",
		"composer",
		"actor",
		"narrator",
		"studio",
		"distributor",
	],
	series: ["author", "editor", "publisher"],
} as const satisfies Record<UnitType, readonly CreditAttributionRole[]>;

export function isKnownAttributionRole(role: string): role is CreditAttributionRole {
	return (CreditAttributionRoles as readonly string[]).includes(role);
}

export function isCreditAttributionRoleForUnitType(
	type: UnitType,
	role: string,
): role is CreditAttributionRole {
	return (CreditAttributionRolesByUnitType[type] as readonly string[]).includes(role);
}

export function isSubjectAssociationRole(role: string): role is SubjectAssociationRole {
	return (SubjectAssociationRoles as readonly string[]).includes(role);
}

export function findPrimaryBookAuthor<Item extends { readonly role: CreditAttributionRole }>(
	attributions: readonly Item[],
): Item | undefined {
	return attributions.find(({ role }) => role === "author");
}

export function groupByAssociationRole<Item extends { readonly role: string }>(
	items: readonly Item[],
): readonly {
	readonly role: Item["role"];
	readonly items: readonly Item[];
}[] {
	const groups = new Map<Item["role"], Item[]>();
	for (const item of items) {
		const group = groups.get(item.role);
		if (group) group.push(item);
		else groups.set(item.role, [item]);
	}
	return [...groups].map(([role, groupedItems]) => ({ role, items: groupedItems }));
}
