import type { ContentLanguage } from "@rezics/i18n";

import { compareBytewisePositions } from "../ordering/position";
import { resolveUnitLocalizationFromOrdered } from "../units/localization";

type ChapterLocalization = {
	readonly language: ContentLanguage;
	readonly content: unknown | null;
	readonly contentStatus: string | null;
};

/**
 * Selects the localization presented by the Book reader.
 *
 * @internal
 */
export function selectReaderChapterLocalization<Localization extends ChapterLocalization>(
	localizations: readonly Localization[],
	input: {
		readonly canReadDraftContent: boolean;
		readonly exactLanguage?: ContentLanguage;
		readonly localizationLanguages: readonly ContentLanguage[];
	},
): Localization | undefined {
	if (input.exactLanguage) {
		const exactLocalization = localizations.find(
			(localization) => localization.language === input.exactLanguage,
		);
		if (exactLocalization) return exactLocalization;
	}
	const readableContent = localizations.filter(
		(localization) =>
			localization.content !== null &&
			(input.canReadDraftContent || localization.contentStatus === "published"),
	);
	return (
		resolveUnitLocalizationFromOrdered(readableContent, input.localizationLanguages) ??
		resolveUnitLocalizationFromOrdered(localizations, input.localizationLanguages)
	);
}

export type BookReadingNode = {
	readonly id: string;
	readonly contentUnitId: string;
	readonly parentId: string | null;
	readonly position: string;
	readonly contentKind: "book" | "chapter" | "label";
};

function compareNodes(left: BookReadingNode, right: BookReadingNode): number {
	return compareBytewisePositions(left.position, right.position) || left.id.localeCompare(right.id);
}

/**
 * Flattens Book chapters in depth-first display order while omitting structural labels.
 *
 * @remarks
 * This is deliberately tolerant of disconnected or cyclic stored input. It defines
 * reader navigation order without enforcing a backend hierarchy policy.
 *
 * @internal
 */
export function orderReaderChapterNodeIds(nodes: readonly BookReadingNode[]): string[] {
	const nodeIds = new Set(nodes.map((node) => node.id));
	const childrenByParent = new Map<string | null, BookReadingNode[]>();
	for (const node of nodes) {
		const parentId = node.parentId !== null && nodeIds.has(node.parentId) ? node.parentId : null;
		const siblings = childrenByParent.get(parentId) ?? [];
		siblings.push(node);
		childrenByParent.set(parentId, siblings);
	}
	for (const siblings of childrenByParent.values()) siblings.sort(compareNodes);

	const visited = new Set<string>();
	const chapterNodeIds: string[] = [];
	const visit = (start: BookReadingNode): void => {
		const stack = [start];
		while (stack.length) {
			const node = stack.pop();
			if (!node || visited.has(node.id)) continue;
			visited.add(node.id);
			if (node.contentKind === "chapter") chapterNodeIds.push(node.id);
			const children = childrenByParent.get(node.id) ?? [];
			for (let index = children.length - 1; index >= 0; index -= 1) {
				const child = children[index];
				if (child) stack.push(child);
			}
		}
	};
	for (const root of childrenByParent.get(null) ?? []) visit(root);
	for (const node of [...nodes].sort(compareNodes)) visit(node);
	return chapterNodeIds;
}
