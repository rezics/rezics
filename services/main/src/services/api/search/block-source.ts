import { walkBlockTree, type Block, type SearchFeatureSource } from "@rezics/block";

import { InvalidSearch } from "../../search/errors";

export function findSearchFeatureSource(
	document: { readonly blocks: readonly Block[] },
	blockKey: string,
): SearchFeatureSource {
	let found: SearchFeatureSource | undefined;
	walkBlockTree(document, (block) => {
		if (block._key !== blockKey) return;
		if (block._type === "search" || block._type === "feed") {
			found = block.feature;
			return;
		}
		if (block._type === "unit-list" && block.source.kind === "search") {
			found = block.source.feature;
			return;
		}
		throw new InvalidSearch("The selected Block does not use Search Feature");
	});
	if (!found) throw new InvalidSearch("Search-backed Block does not exist in this surface");
	return found;
}
