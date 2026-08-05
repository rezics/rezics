export const CanonicalPgroongaIndexes = [
	"unit_localization_pgroonga_metadata_idx",
	"unit_localization_pgroonga_content_idx",
] as const;

export type CanonicalPgroongaIndex = (typeof CanonicalPgroongaIndexes)[number];
export type SearchIndexAction = "check" | "reindex" | "reindex-concurrently";

export interface SearchIndexOptions {
	readonly action: SearchIndexAction;
	readonly index: CanonicalPgroongaIndex | "all";
	readonly confirmed: boolean;
}

export class SearchIndexConfigurationError extends Error {
	override readonly name = "SearchIndexConfigurationError";
}

export function parseSearchIndexOptions(arguments_: readonly string[]): SearchIndexOptions {
	const [action, ...flags] = arguments_;
	if (action !== "check" && action !== "reindex" && action !== "reindex-concurrently")
		throw new TypeError(
			"Usage: search-index check|reindex|reindex-concurrently [--index all|<canonical-name>] [--yes]",
		);

	let index: CanonicalPgroongaIndex | "all" = "all";
	let confirmed = false;
	for (let position = 0; position < flags.length; position += 1) {
		const flag = flags[position];
		if (flag === "--yes") {
			confirmed = true;
			continue;
		}
		if (flag !== "--index") throw new TypeError(`Unknown search-index option: ${flag}`);
		const value = flags[position + 1];
		if (!value || value.startsWith("--")) throw new TypeError("--index requires a value");
		position += 1;
		if (value !== "all" && !CanonicalPgroongaIndexes.some((name) => name === value))
			throw new TypeError(`Unknown PGroonga index: ${value}`);
		index = value as CanonicalPgroongaIndex | "all";
	}

	if (action === "check" && confirmed) throw new TypeError("--yes is only valid for reindexing");
	if (action !== "check" && !confirmed)
		throw new SearchIndexConfigurationError(`${action} requires explicit --yes confirmation`);
	return { action, index, confirmed };
}

export function selectCanonicalPgroongaIndexes(
	index: CanonicalPgroongaIndex | "all",
): readonly CanonicalPgroongaIndex[] {
	return index === "all" ? CanonicalPgroongaIndexes : [index];
}

export function quoteCanonicalPgroongaIndex(index: CanonicalPgroongaIndex): string {
	if (!CanonicalPgroongaIndexes.includes(index))
		throw new SearchIndexConfigurationError(`Refusing non-canonical index: ${index}`);
	return `public."${index}"`;
}
