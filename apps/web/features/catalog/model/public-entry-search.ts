export const PublicEntryEntityKinds = ["person", "organization", "character"] as const;
export type PublicEntryEntityKind = (typeof PublicEntryEntityKinds)[number];

export function isPublicEntryEntityKind(value: string | null): value is PublicEntryEntityKind {
	return value !== null && PublicEntryEntityKinds.some((kind) => kind === value);
}

export type PublicEntrySearchSubject =
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
			readonly filterKind: PublicEntryEntityKind;
			readonly kind: PublicEntryEntityKind;
			readonly searchIndex: "entity";
			readonly section: "entity";
	  }
	| {
			readonly kind: "tag";
			readonly searchIndex: "tags";
			readonly section: "tag";
	  };

export const PublicEntrySearchConfirmationParam = "publicEntrySearch";

export function unitPublicEntrySearchSubject(
	section: "book" | "software" | "media",
): PublicEntrySearchSubject {
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

export function entityPublicEntrySearchSubject(
	kind: PublicEntryEntityKind,
): PublicEntrySearchSubject {
	return { filterKind: kind, kind, searchIndex: "entity", section: "entity" };
}

export const TagPublicEntrySearchSubject = {
	kind: "tag",
	searchIndex: "tags",
	section: "tag",
} as const satisfies PublicEntrySearchSubject;

export function parsePublicEntrySearchSubject(
	section: string,
	kind: string | undefined,
): PublicEntrySearchSubject | undefined {
	switch (section) {
		case "book":
		case "software":
		case "media":
			return kind === section ? unitPublicEntrySearchSubject(section) : undefined;
		case "entity":
			switch (kind) {
				case "person":
				case "organization":
				case "character":
					return entityPublicEntrySearchSubject(kind);
				default:
					return undefined;
			}
		case "tag":
			return kind === "tag" ? TagPublicEntrySearchSubject : undefined;
		default:
			return undefined;
	}
}

export function normalizePublicEntrySearchQuery(query: string): string {
	return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function publicEntrySearchConfirmation(
	subject: PublicEntrySearchSubject,
	query: string,
): string {
	return JSON.stringify([
		1,
		subject.section,
		subject.kind,
		normalizePublicEntrySearchQuery(query),
	]);
}

export function isPublicEntrySearchConfirmed(
	subject: PublicEntrySearchSubject,
	query: string,
	confirmation: string | null | undefined,
): boolean {
	return (
		normalizePublicEntrySearchQuery(query).length > 0 &&
		confirmation === publicEntrySearchConfirmation(subject, query)
	);
}

export function publicEntrySearchHref(subject: PublicEntrySearchSubject, query: string): string {
	const search = new URLSearchParams({ kind: subject.kind });
	const trimmedQuery = query.trim();
	if (trimmedQuery) search.set("q", trimmedQuery);
	return `/create/${subject.section}/search?${search}`;
}

export function publicEntryCreationHref(subject: PublicEntrySearchSubject, query: string): string {
	const trimmedQuery = query.trim();
	const search = new URLSearchParams({
		[PublicEntrySearchConfirmationParam]: publicEntrySearchConfirmation(subject, trimmedQuery),
		title: trimmedQuery,
	});
	let pathname: string;
	switch (subject.section) {
		case "book":
		case "software":
		case "media":
			pathname = `/units/${subject.section}/new`;
			search.set("catalogMode", "public_entry");
			break;
		case "entity":
			pathname = "/entities/new";
			search.set("catalogMode", "public_entry");
			search.set("kind", subject.kind);
			break;
		case "tag":
			pathname = "/tags/new";
			break;
	}
	return `${pathname}?${search}`;
}

export function publicEntrySearchResultHref(
	subject: PublicEntrySearchSubject,
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
