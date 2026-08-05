/** Canonical derived PGroonga indexes rebuilt from authoritative Unit rows. */
export const CanonicalPgroongaIndexes = [
	"unit_localization_pgroonga_metadata_idx",
	"unit_localization_pgroonga_content_idx",
	"unit_alias_term_search_idx",
] as const;

export type CanonicalPgroongaIndex = (typeof CanonicalPgroongaIndexes)[number];

/** Expression indexes qualified for PGroonga's explicit large-key/posting-list mode. */
export const LargeCapacityPgroongaIndexes: readonly CanonicalPgroongaIndex[] =
	CanonicalPgroongaIndexes.slice(0, 2);
