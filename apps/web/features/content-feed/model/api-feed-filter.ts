import type { ContentLanguage } from "@rezics/i18n";
import {
	combineUnitPredicates,
	createSimpleFeedFilter,
	mergeUnitFilter,
	type SimpleFeedContentKind,
	type UnitFilter,
	type UnitPredicate,
	withUnitFilterSearch,
} from "@rezics/filter";

export function createApiFeedFilter(input: {
	readonly additionalFilter?: UnitPredicate;
	readonly contentKinds: readonly SimpleFeedContentKind[];
	readonly languages: readonly ContentLanguage[];
	readonly query: string;
	readonly realmIds: readonly string[];
	readonly tagIds: readonly string[];
}): UnitFilter | undefined {
	const where = combineUnitPredicates([
		createSimpleFeedFilter({
			contentKinds: input.contentKinds,
			languages: input.languages,
			realmIds: input.realmIds,
			tagIds: input.tagIds,
		}),
		input.additionalFilter,
	]);
	return mergeUnitFilter(withUnitFilterSearch(undefined, input.query), where);
}
