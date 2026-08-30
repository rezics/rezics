import { type Static, Type } from "typebox";

import type { UnitReferencedBlock } from "./blocks";
import { BlockKey, type BlockKey as BlockKeyValue } from "./identity";

export const BlockPathSlotValues = ["blocks", "columns", "tabs"] as const;
export type BlockPathSlot = (typeof BlockPathSlotValues)[number];

export const BlockPathSegment = Type.Object(
	{
		slot: Type.Union([Type.Literal("blocks"), Type.Literal("columns"), Type.Literal("tabs")]),
		key: BlockKey,
	},
	{ additionalProperties: false, $id: "BlockPathSegment" },
);
export type BlockPathSegment = Static<typeof BlockPathSegment>;

export const BlockPath = Type.Array(BlockPathSegment, {
	minItems: 1,
	maxItems: 16,
	$id: "BlockPath",
});
export type BlockPath = Readonly<Static<typeof BlockPath>>;

export function appendBlockPath(
	path: BlockPath | readonly BlockPathSegment[],
	slot: BlockPathSlot,
	key: BlockKeyValue,
): BlockPath {
	return [...path, { slot, key }];
}

/** Collision-free in-memory key for a runtime-validated BlockPath. */
export function encodeBlockPath(path: BlockPath | readonly BlockPathSegment[]): string {
	return path.map(({ key, slot }) => `${slot}:${key}`).join("/");
}

function findByKey(
	blocks: readonly UnitReferencedBlock[],
	key: BlockKeyValue,
): UnitReferencedBlock | undefined {
	return blocks.find((block) => block._key === key);
}

/**
 * Resolve a keyed structural path inside one already-loaded document.
 *
 * The owning Unit/Dock identity remains outside the document and path. An
 * unresolved or structurally impossible path returns undefined.
 */
export function resolveBlockPath(
	document: { readonly blocks: readonly UnitReferencedBlock[] },
	path: BlockPath | readonly BlockPathSegment[],
): UnitReferencedBlock | undefined {
	const resolveBlocks = (
		blocks: readonly UnitReferencedBlock[],
		index: number,
	): UnitReferencedBlock | undefined => {
		const segment = path[index];
		if (!segment || segment.slot !== "blocks") return;
		const block = findByKey(blocks, segment.key);
		if (!block) return;
		const nextIndex = index + 1;
		if (nextIndex === path.length) return block;

		if (block._type === "group" || block._type === "callout")
			return resolveBlocks(block.blocks, nextIndex);

		const container = path[nextIndex];
		if (block._type === "columns" && container?.slot === "columns") {
			const column = block.columns.find(({ _key }) => _key === container.key);
			return column ? resolveBlocks(column.blocks, nextIndex + 1) : undefined;
		}
		if (block._type === "tabs" && container?.slot === "tabs") {
			const tab = block.tabs.find(({ _key }) => _key === container.key);
			return tab ? resolveBlocks(tab.blocks, nextIndex + 1) : undefined;
		}
		return;
	};

	return resolveBlocks(document.blocks, 0);
}
