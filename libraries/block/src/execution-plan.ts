import type {
	DockDocument,
	FeedBlock,
	UnitListBlock,
	UnitReferencedBlock,
	UnitReferencedBlockDocument,
} from "./blocks";
import {
	appendBlockPath,
	type BlockPath,
	type BlockPathSegment,
	encodeBlockPath,
} from "./block-path";

export const MaxZoneEagerBlockExecutions = 8;
export const ZonePageEagerExecutionReservation = 6;
export const ZoneDockEagerExecutionReservation = 2;

export type ZoneBlockExecutionSurface = "page" | "dock";

type QueryBackedUnitListSource = Exclude<UnitListBlock["source"], { readonly kind: "units" }>;

export type ZoneExecutableUnitListBlock = Omit<UnitListBlock, "source"> & {
	readonly source: QueryBackedUnitListSource;
};

export type ZoneExecutableBlock = ZoneExecutableUnitListBlock | FeedBlock;

interface ZoneBlockExecutionDescriptorBase {
	/** Runtime composition policy role, not persisted identity. */
	readonly surface: ZoneBlockExecutionSurface;
	/** Keyed address inside the independently stored Page or Dock document. */
	readonly path: BlockPath;
	readonly block: ZoneExecutableBlock;
}

export interface ZoneEagerBlockExecutionDescriptor extends ZoneBlockExecutionDescriptorBase {
	readonly execution: "eager";
}

export interface ZoneSkippedBlockExecutionDescriptor extends ZoneBlockExecutionDescriptorBase {
	readonly execution: "skipped";
	/** Why automatic execution was deferred; neither reason affects document validity. */
	readonly reason: "budget" | "inactive-tab";
}

export type ZoneBlockExecutionDescriptor =
	| ZoneEagerBlockExecutionDescriptor
	| ZoneSkippedBlockExecutionDescriptor;

export interface ZoneBlockExecutionPlan {
	/** Every executable Block in deterministic Page-then-Dock, depth-first order. */
	readonly descriptors: readonly ZoneBlockExecutionDescriptor[];
	/** Runtime-selected automatic work, capped independently of document validity. */
	readonly eager: readonly ZoneEagerBlockExecutionDescriptor[];
	readonly skipped: readonly ZoneSkippedBlockExecutionDescriptor[];
}

export type ZoneBlockExecutionPlanInput =
	| {
			readonly page: UnitReferencedBlockDocument;
			readonly dock?: DockDocument;
	  }
	| {
			readonly page?: undefined;
			readonly dock: DockDocument;
	  };

interface CandidateDescriptor extends ZoneBlockExecutionDescriptorBase {
	readonly automaticCandidate: boolean;
}

function queryBackedUnitList(block: UnitListBlock): ZoneExecutableUnitListBlock | undefined {
	if (block.source.kind === "units") return undefined;
	return { ...block, source: block.source };
}

function appendExecutableBlock(
	descriptors: CandidateDescriptor[],
	block: UnitReferencedBlock,
	surface: ZoneBlockExecutionSurface,
	path: BlockPath,
	automaticCandidate: boolean,
): void {
	const executableBlock =
		block._type === "feed"
			? block
			: block._type === "unit-list"
				? queryBackedUnitList(block)
				: undefined;
	if (!executableBlock) return;
	descriptors.push({ surface, path, block: executableBlock, automaticCandidate });
}

function visitBlocks(
	blocks: readonly UnitReferencedBlock[],
	surface: ZoneBlockExecutionSurface,
	parentPath: readonly BlockPathSegment[],
	automaticCandidate: boolean,
	descriptors: CandidateDescriptor[],
): void {
	for (const block of blocks) {
		const path = appendBlockPath(parentPath, "blocks", block._key);
		appendExecutableBlock(descriptors, block, surface, path, automaticCandidate);

		if (block._type === "columns") {
			for (const column of block.columns)
				visitBlocks(
					column.blocks,
					surface,
					appendBlockPath(path, "columns", column._key),
					automaticCandidate,
					descriptors,
				);
			continue;
		}

		if (block._type === "group" || block._type === "callout") {
			visitBlocks(block.blocks, surface, path, automaticCandidate, descriptors);
			continue;
		}

		if (block._type !== "tabs") continue;
		for (const [tabIndex, tab] of block.tabs.entries())
			visitBlocks(
				tab.blocks,
				surface,
				appendBlockPath(path, "tabs", tab._key),
				automaticCandidate && tabIndex === 0,
				descriptors,
			);
	}
}

function descriptorKey(descriptor: Pick<CandidateDescriptor, "path" | "surface">): string {
	return `${descriptor.surface}:${encodeBlockPath(descriptor.path)}`;
}

function take(
	source: readonly CandidateDescriptor[],
	count: number,
	selected: Set<string>,
): number {
	let taken = 0;
	for (const descriptor of source) {
		if (taken >= count) break;
		const key = descriptorKey(descriptor);
		if (selected.has(key)) continue;
		selected.add(key);
		taken += 1;
	}
	return taken;
}

/**
 * Allocate automatic work without coupling independently written documents.
 *
 * Page and Dock receive deterministic reservations. Any unused capacity is
 * borrowed in Page-then-Dock order. Selection is runtime-only: non-selected
 * candidates remain valid and execute explicitly by BlockPath.
 */
function selectAutomaticDescriptors(descriptors: readonly CandidateDescriptor[]): Set<string> {
	const automatic = descriptors.filter(({ automaticCandidate }) => automaticCandidate);
	const page = automatic.filter(({ surface }) => surface === "page");
	const dock = automatic.filter(({ surface }) => surface === "dock");
	const selected = new Set<string>();

	take(page, ZonePageEagerExecutionReservation, selected);
	take(dock, ZoneDockEagerExecutionReservation, selected);
	let remaining = MaxZoneEagerBlockExecutions - selected.size;
	remaining -= take(page, remaining, selected);
	take(dock, remaining, selected);
	return selected;
}

/** Build one runtime plan over independently valid Page and Dock documents. */
export function createZoneBlockExecutionPlan(
	input: ZoneBlockExecutionPlanInput,
): ZoneBlockExecutionPlan {
	const candidates: CandidateDescriptor[] = [];
	if (input.page) visitBlocks(input.page.blocks, "page", [], true, candidates);
	if (input.dock) visitBlocks(input.dock.blocks, "dock", [], true, candidates);
	const selected = selectAutomaticDescriptors(candidates);
	const descriptors = candidates.map(
		({ automaticCandidate, ...descriptor }): ZoneBlockExecutionDescriptor =>
			selected.has(descriptorKey(descriptor))
				? { ...descriptor, execution: "eager" }
				: {
						...descriptor,
						execution: "skipped",
						reason: automaticCandidate ? "budget" : "inactive-tab",
					},
	);
	return {
		descriptors,
		eager: descriptors.filter(
			(descriptor): descriptor is ZoneEagerBlockExecutionDescriptor =>
				descriptor.execution === "eager",
		),
		skipped: descriptors.filter(
			(descriptor): descriptor is ZoneSkippedBlockExecutionDescriptor =>
				descriptor.execution === "skipped",
		),
	};
}
