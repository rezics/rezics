import { walkBlockTree, type BlockContainerDocument } from "@rezics/block";

import { resolveFilterDocument } from "./filter-document";

/** Proves every persisted inline Block Filter against the server capability ceiling. */
export function assertExecutableBlockFilterDocuments(
	document: BlockContainerDocument,
	hasDevelopmentPreviewAccess: boolean,
): void {
	walkBlockTree(document, (block) => {
		const filterDocument =
			block._type === "feed" && block.feature.kind === "inline"
				? block.feature.filterDocument
				: block._type === "unit-list" &&
						block.source.kind === "search" &&
						block.source.feature.kind === "inline"
					? block.source.feature.filterDocument
					: undefined;
		if (filterDocument) resolveFilterDocument(filterDocument, hasDevelopmentPreviewAccess);
	});
}
