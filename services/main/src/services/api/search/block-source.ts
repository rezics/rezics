import {
	resolveBlockPath,
	type Block,
	type BlockPath,
	type SearchFeatureSource,
	type UnitReferencedBlock,
} from "@rezics/block";

import { InvalidSearch } from "../../search/errors";

export function findSearchUnitListBlock(
	document: { readonly blocks: readonly UnitReferencedBlock[] },
	path: BlockPath,
): Extract<Block, { readonly _type: "unit-list" }> & {
	readonly source: Extract<
		Extract<Block, { readonly _type: "unit-list" }>["source"],
		{ kind: "search" | "derived" }
	>;
} {
	const block = resolveBlockPath(document, path);
	if (!block) throw new InvalidSearch("Search-backed Block path does not exist in this surface");
	if (
		block._type !== "unit-list" ||
		(block.source.kind !== "search" && block.source.kind !== "derived")
	)
		throw new InvalidSearch("The selected Block does not use Search Feature");
	return { ...block, source: block.source };
}

export function findSearchFeatureSource(
	document: { readonly blocks: readonly UnitReferencedBlock[] },
	path: BlockPath,
): SearchFeatureSource {
	const source = findSearchUnitListBlock(document, path).source;
	return source.kind === "search" ? source.feature : source;
}

export function findFeedBlock(
	document: { readonly blocks: readonly UnitReferencedBlock[] },
	path: BlockPath,
): Extract<Block, { readonly _type: "feed" }> {
	const block = resolveBlockPath(document, path);
	if (!block) throw new InvalidSearch("Feed Block path does not exist in this surface");
	if (block._type !== "feed") throw new InvalidSearch("The selected Block is not a Feed Block");
	return block;
}
