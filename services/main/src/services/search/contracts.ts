import type { SearchCategory } from "@rezics/filter";
import { isPortableTextValueBlock, normalizePortableText } from "@rezics/portable-text";

import type { UnitOwner } from "@rezics/reference";

/** Authoritative native resource owners addressable by each public Search category. */
export const CurrentSearchOwnersByCategory = {
	units: ["publishing", "music", "program", "software", "grouping", "reference", "distribution", "video", "audio", "zone"],
	entities: ["entity"],
	tags: ["tag"],
	posts: ["post"],
	realms: ["realm"],
	collections: ["collection"],
	reviews: ["post"],
	polls: ["poll"],
} as const satisfies Record<SearchCategory, readonly UnitOwner[]>;

/**
 * Extracts only user-visible Portable Text spans for deterministic PGroonga fixtures.
 *
 * @remarks
 * The database owns the equivalent immutable `current_search_text_v1(jsonb)` function used by
 * expression indexes. Keeping this implementation independent makes malformed/editor-only JSON
 * regression tests possible without requiring PostgreSQL.
 */
export function extractCanonicalSearchText(value: unknown): string {
	const record =
		value !== null && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: undefined;
	const content = record?._type === "portable-text" ? record.content : value;
	return normalizePortableText(content)
		.flatMap((block) =>
			isPortableTextValueBlock(block)
				? block.children.flatMap((child) => (child._type === "span" ? [child.text] : []))
				: [],
		)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}
