import {
	readSearchLanguageBoundary,
	readUnitLanguageBoundary,
	type SearchFeatureState,
} from "@rezics/filter";

/** Whether Search Feed cards must retain the language selected by the list boundary. */
export function hasSearchLanguagePresentationBoundary(
	state: Pick<SearchFeatureState, "expression" | "filter">,
): boolean {
	return Boolean(
		(readSearchLanguageBoundary(state.expression)?.length ?? 0) > 0 ||
		(readUnitLanguageBoundary(state.filter?.where)?.length ?? 0) > 0,
	);
}
