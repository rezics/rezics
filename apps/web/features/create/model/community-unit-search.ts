import { StudioTagCreateHref } from "@/features/create/model/studio-section";

export const CommunityUnitEntityKinds = ["person", "organization", "character"] as const;
export type CommunityUnitEntityKind = (typeof CommunityUnitEntityKinds)[number];

export function isCommunityUnitEntityKind(value: string | null): value is CommunityUnitEntityKind {
	return value !== null && CommunityUnitEntityKinds.some((kind) => kind === value);
}

export type CommunityUnitSearchSubject =
	| {
			readonly filterKind: "book";
			readonly kind: "book";
			readonly searchIndex: "units";
			readonly section: "book";
	  }
	| {
			readonly filterKind: "software";
			readonly kind: "software";
			readonly searchIndex: "units";
			readonly section: "software";
	  }
	| {
			readonly filterKind: "media";
			readonly kind: "media";
			readonly searchIndex: "units";
			readonly section: "media";
	  }
	| {
			readonly filterKind: CommunityUnitEntityKind;
			readonly kind: CommunityUnitEntityKind;
			readonly searchIndex: "entities";
			readonly section: "entity";
	  }
	| {
			readonly kind: "tag";
			readonly searchIndex: "tags";
			readonly section: "tag";
	  };

export function unitCommunityUnitSearchSubject(
	section: "book" | "software" | "media",
): CommunityUnitSearchSubject {
	switch (section) {
		case "book":
			return { filterKind: "book", kind: "book", searchIndex: "units", section };
		case "software":
			return {
				filterKind: "software",
				kind: "software",
				searchIndex: "units",
				section,
			};
		case "media":
			return { filterKind: "media", kind: "media", searchIndex: "units", section };
	}
}

export function entityCommunityUnitSearchSubject(
	kind: CommunityUnitEntityKind,
): CommunityUnitSearchSubject {
	return { filterKind: kind, kind, searchIndex: "entities", section: "entity" };
}

export const TagCommunityUnitSearchSubject = {
	kind: "tag",
	searchIndex: "tags",
	section: "tag",
} as const satisfies CommunityUnitSearchSubject;

export function parseCommunityUnitSearchSubject(
	section: string,
	kind: string | undefined,
): CommunityUnitSearchSubject | undefined {
	switch (section) {
		case "book":
		case "software":
		case "media":
			return kind === section ? unitCommunityUnitSearchSubject(section) : undefined;
		case "entity":
			switch (kind) {
				case "person":
				case "organization":
				case "character":
					return entityCommunityUnitSearchSubject(kind);
				default:
					return undefined;
			}
		case "tag":
			return kind === "tag" ? TagCommunityUnitSearchSubject : undefined;
		default:
			return undefined;
	}
}

export function normalizeCommunityUnitSearchQuery(query: string): string {
	return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function communityUnitSearchHref(
	subject: CommunityUnitSearchSubject,
	query: string,
): string {
	const search = new URLSearchParams({ kind: subject.kind });
	const trimmedQuery = query.trim();
	if (trimmedQuery) search.set("q", trimmedQuery);
	return `/create/${subject.section}/search?${search}`;
}

export function communityUnitCreationHref(
	subject: CommunityUnitSearchSubject,
	query: string,
): string {
	const trimmedQuery = query.trim();
	const search = new URLSearchParams({
		title: trimmedQuery,
	});
	let pathname: string;
	switch (subject.section) {
		case "book":
		case "software":
		case "media":
			pathname = `/units/${subject.section}/new`;
			search.set("ownershipMode", "community_owned");
			break;
		case "entity":
			pathname = "/entities/new";
			search.set("ownershipMode", "community_owned");
			search.set("kind", subject.kind);
			break;
		case "tag":
			pathname = StudioTagCreateHref;
			break;
	}
	return `${pathname}?${search}`;
}

export function communityUnitSearchResultHref(
	subject: CommunityUnitSearchSubject,
	unitId: string,
): string {
	switch (subject.section) {
		case "book":
		case "software":
		case "media":
			return `/units/${subject.section}/${unitId}`;
		case "entity":
			return `/entities/${unitId}`;
		case "tag":
			return `/tags/${unitId}`;
	}
}
