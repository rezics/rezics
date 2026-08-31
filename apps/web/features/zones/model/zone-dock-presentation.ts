import type { MenuBlock, UnitReferencedBlock } from "@rezics/block";

export interface ZoneDockPresentation {
	readonly contentBlocks: readonly UnitReferencedBlock[];
	readonly menuBlocks: readonly MenuBlock[];
}

/** Partition the Dock once so its Menu Blocks become platform navigation rather than duplicate content. */
export function zoneDockPresentation(
	blocks: readonly UnitReferencedBlock[],
	navigations: readonly { readonly id: string }[],
): ZoneDockPresentation {
	const navigationIds = new Set(navigations.map(({ id }) => id));
	const contentBlocks: UnitReferencedBlock[] = [];
	const menuBlocks: MenuBlock[] = [];

	for (const block of blocks) {
		if (block._type !== "menu") {
			contentBlocks.push(block);
			continue;
		}
		if (navigationIds.has(block.navigationId)) menuBlocks.push(block);
	}

	return { contentBlocks, menuBlocks };
}
