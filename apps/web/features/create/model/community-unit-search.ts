import { CatalogOwnerValues, type CatalogOwner } from "@rezics/reference";
import { studioSectionCreateHref } from "./studio-section";
export const PrimaryEntityShapes = ["person", "organization", "character"] as const;
export type PrimaryEntityShape = (typeof PrimaryEntityShapes)[number];
export function isPrimaryEntityShape(
	value: string | null | undefined,
): value is PrimaryEntityShape {
	return value != null && PrimaryEntityShapes.some((shape) => shape === value);
}
export type CommunityUnitSearchSubject =
	| {
			readonly owner: CatalogOwner;
			readonly shape?: string;
			readonly searchIndex: "units" | "entities";
			readonly section: CatalogOwner;
	  }
	| { readonly owner: "tag"; readonly searchIndex: "tags"; readonly section: "tag" };
export function nativeCommunityUnitSearchSubject(
	owner: CatalogOwner,
	shape?: string,
): CommunityUnitSearchSubject {
	return {
		owner,
		...(shape ? { shape } : {}),
		searchIndex: owner === "entity" ? "entities" : "units",
		section: owner,
	};
}
export function entityCommunityUnitSearchSubject(
	shape: PrimaryEntityShape,
): CommunityUnitSearchSubject {
	return nativeCommunityUnitSearchSubject("entity", shape);
}
export const TagCommunityUnitSearchSubject = {
	owner: "tag",
	searchIndex: "tags",
	section: "tag",
} as const satisfies CommunityUnitSearchSubject;
export function parseCommunityUnitSearchSubject(
	section: string,
	shape?: string,
): CommunityUnitSearchSubject | undefined {
	if (shape !== undefined && !/^[a-z][a-z0-9_.-]{0,95}$/u.test(shape)) return;
	if (section === "tag")
		return shape === undefined || shape === "tag" ? TagCommunityUnitSearchSubject : undefined;
	const owner = CatalogOwnerValues.find((owner) => owner === section);
	return owner ? nativeCommunityUnitSearchSubject(owner, shape) : undefined;
}
export function communityUnitSearchLabelKey(
	subject: CommunityUnitSearchSubject,
): CatalogOwner | "tag" | PrimaryEntityShape {
	return subject.owner === "entity" && "shape" in subject && isPrimaryEntityShape(subject.shape)
		? subject.shape
		: subject.owner;
}
export function normalizeCommunityUnitSearchQuery(query: string): string {
	return query.trim().replace(/\s+/gu, " ").toLowerCase();
}
export function communityUnitSearchHref(
	subject: CommunityUnitSearchSubject,
	query: string,
): string {
	const search = new URLSearchParams();
	if ("shape" in subject && subject.shape) search.set("shape", subject.shape);
	if (query.trim()) search.set("q", query.trim());
	return `/create/${subject.section}/search${search.size ? `?${search}` : ""}`;
}
export function communityUnitCreationHref(
	subject: CommunityUnitSearchSubject,
	query: string,
): string {
	const search = new URLSearchParams();
	if (query.trim()) search.set("title", query.trim());
	if ("shape" in subject && subject.shape) search.set("shape", subject.shape);
	return `${studioSectionCreateHref(subject.section)}${search.size ? `?${search}` : ""}`;
}
export function communityUnitSearchResultHref(
	subject: CommunityUnitSearchSubject,
	unitId: string,
): string {
	return subject.owner === "tag" ? `/tags/${unitId}` : `/catalog/${subject.owner}/${unitId}`;
}
