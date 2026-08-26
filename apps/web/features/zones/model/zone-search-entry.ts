import {
	isSearchSortAvailable,
	parseSearchFeatureInput,
	type SearchInjection,
	type SharedSearchQueryState,
	unitFilterSearchQuery,
} from "@rezics/filter";

import type { SearchFeatureRequest } from "@/features/search/search-feature";

export const ZoneSearchEntrySearchParam = "entry";

const MaximumZoneSearchEntryCharacters = 1_048_576;

export interface ZoneSearchEntryRequest {
	readonly injections: readonly SearchInjection[];
	readonly state: SharedSearchQueryState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntryValue(value: unknown): ZoneSearchEntryRequest {
	if (!isRecord(value)) throw new TypeError("Zone Search entry must be an object");
	const keys = Object.keys(value);
	if (keys.length !== 2 || !keys.includes("injections") || !keys.includes("state"))
		throw new TypeError("Zone Search entry has unexpected fields");
	const input = parseSearchFeatureInput({
		filterDocument: {},
		contexts: [],
		injections: value.injections,
		state: value.state,
	});
	const { cursor, ...state } = input.state;
	if (cursor !== undefined)
		throw new TypeError("Zone Search entry cannot contain a continuation cursor");
	const query = unitFilterSearchQuery(state.filter);
	if (state.sort && !isSearchSortAvailable(state.sort, query))
		throw new TypeError("Zone Search entry sort is unavailable for its query");
	return { injections: input.injections, state };
}

export function serializeZoneSearchEntry(request: SearchFeatureRequest): string {
	const serialized = JSON.stringify(parseEntryValue(request));
	if (serialized.length > MaximumZoneSearchEntryCharacters)
		throw new TypeError("Zone Search entry exceeds the navigation limit");
	return serialized;
}

export function parseZoneSearchEntry(
	value: string | null | undefined,
): ZoneSearchEntryRequest | null {
	if (!value || value.length > MaximumZoneSearchEntryCharacters) return null;
	try {
		return parseEntryValue(JSON.parse(value));
	} catch {
		return null;
	}
}

export function zoneSearchEntryHref(baseHref: string, request: SearchFeatureRequest): string {
	const search = new URLSearchParams({
		[ZoneSearchEntrySearchParam]: serializeZoneSearchEntry(request),
	});
	return baseHref + "/search?" + search.toString();
}
