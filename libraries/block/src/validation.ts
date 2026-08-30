import { type Static, type TSchema } from "typebox";
import { Check, Value } from "typebox/value";
import {
	assertFilterDocument,
	collectUnitPredicateReferenceIds,
	filterDocumentControlField,
	type FilterDocument,
} from "@rezics/filter";
import { normalizePortableText } from "@rezics/portable-text";

import {
	Block as BlockSchema,
	BlockDocument,
	type Block,
	type BlockDocument as BlockDocumentValue,
	type BlockType,
	type DerivedSearchFeatureSource,
	DockDocument,
	type DockDocument as DockDocumentValue,
	PortableTextDocument,
	type PortableTextDocument as PortableTextDocumentValue,
	UnitReferencedBlockDocument,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
} from "./blocks";
import {
	NavigationDocument,
	type NavigationDocument as NavigationDocumentValue,
	type NavigationItem,
} from "./domain-documents";

export interface BlockHostPolicy {
	readonly allowedRootTypes: readonly BlockType[];
	readonly allowedChildTypes: Readonly<Partial<Record<BlockParentType, readonly BlockType[]>>>;
	readonly maxDepth: number;
	readonly maxBlocks: number;
	readonly maxClassNames: number;
	readonly maxQueryBlocks: number;
	readonly allowExternalNavigation: boolean;
}

export type BlockParentType = "portable-text" | "columns" | "group" | "callout" | "tabs";

const AllBlockTypes = [
	"portable-text",
	"post-full-view",
	"unit-ref",
	"unit-list",
	"search",
	"feed",
	"menu",
	"image",
	"url-image",
	"divider",
	"columns",
	"group",
	"callout",
	"tabs",
] as const satisfies readonly BlockType[];

const WikiPostChildTypes = [
	"portable-text",
	"unit-ref",
	"unit-list",
	"image",
	"url-image",
	"divider",
	"columns",
	"group",
	"callout",
	"tabs",
] as const satisfies readonly BlockType[];

export const MaxZonePageQueryBlocks = 24;
export const MaxDockQueryBlocks = 6;
export const MaxWikiPostQueryBlocks = 6;
export const MaximumBlockClassNamesPerDocument = 256;

export const DefaultBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: AllBlockTypes,
	allowedChildTypes: {
		"portable-text": AllBlockTypes,
		columns: AllBlockTypes,
		group: AllBlockTypes,
		callout: [
			"portable-text",
			"unit-ref",
			"unit-list",
			"image",
			"url-image",
			"divider",
			"columns",
			"group",
		],
		tabs: AllBlockTypes,
	},
	maxDepth: 4,
	maxBlocks: 250,
	maxClassNames: MaximumBlockClassNamesPerDocument,
	maxQueryBlocks: MaxZonePageQueryBlocks,
	allowExternalNavigation: false,
};

export const DockBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: [
		"unit-ref",
		"unit-list",
		"search",
		"feed",
		"menu",
		"image",
		"url-image",
		"divider",
		"columns",
		"group",
		"callout",
	],
	allowedChildTypes: {
		columns: [
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"image",
			"url-image",
			"divider",
			"callout",
		],
		group: [
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"image",
			"url-image",
			"divider",
			"columns",
			"callout",
		],
		callout: ["unit-ref", "unit-list", "image", "url-image", "divider"],
	},
	maxDepth: 2,
	maxBlocks: 40,
	maxClassNames: MaximumBlockClassNamesPerDocument,
	maxQueryBlocks: MaxDockQueryBlocks,
	allowExternalNavigation: false,
};

export const ZonePageBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: [
		"post-full-view",
		"unit-ref",
		"unit-list",
		"search",
		"feed",
		"menu",
		"image",
		"url-image",
		"divider",
		"columns",
		"group",
		"callout",
		"tabs",
	],
	allowedChildTypes: {
		columns: [
			"post-full-view",
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"image",
			"url-image",
			"divider",
			"columns",
			"group",
			"callout",
			"tabs",
		],
		group: [
			"post-full-view",
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"image",
			"url-image",
			"divider",
			"columns",
			"group",
			"callout",
			"tabs",
		],
		callout: ["unit-ref", "unit-list", "image", "url-image", "divider", "columns", "group"],
		tabs: [
			"post-full-view",
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"image",
			"url-image",
			"divider",
			"columns",
			"group",
			"callout",
		],
	},
	maxDepth: 4,
	maxBlocks: 250,
	maxClassNames: MaximumBlockClassNamesPerDocument,
	maxQueryBlocks: MaxZonePageQueryBlocks,
	allowExternalNavigation: false,
};

/**
 * Presentation regions are rendered in document flow but do not own a query
 * execution surface. Query-backed Blocks therefore remain unavailable until a
 * future contract defines their addressing, authorization, and work budget.
 */
export const UnitPresentationBlockHostPolicy: BlockHostPolicy = {
	...ZonePageBlockHostPolicy,
	maxQueryBlocks: 0,
};

/** Host policy for custom REZICS block objects embedded in Wiki Post Portable Text. */
export const WikiPostBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: ["portable-text"],
	allowedChildTypes: {
		"portable-text": WikiPostChildTypes,
		columns: WikiPostChildTypes,
		group: WikiPostChildTypes,
		callout: [
			"portable-text",
			"unit-ref",
			"unit-list",
			"image",
			"url-image",
			"divider",
			"columns",
			"group",
		],
		tabs: WikiPostChildTypes,
	},
	maxDepth: 6,
	maxBlocks: 500,
	maxClassNames: 0,
	maxQueryBlocks: MaxWikiPostQueryBlocks,
	allowExternalNavigation: false,
};

export function isDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): value is Static<TSchemaValue> {
	return Check(schema, value);
}

export interface BlockDocumentIssue {
	readonly path: string;
	readonly message: string;
}

const MaximumDocumentIssues = 20;

export function describeDocumentIssues(
	schema: TSchema,
	value: unknown,
): readonly BlockDocumentIssue[] {
	return Value.Errors(schema, value)
		.slice(0, MaximumDocumentIssues)
		.map((issue) => ({
			path: issue.instancePath || "/",
			message: issue.message,
		}));
}

export function assertDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): asserts value is Static<TSchemaValue> {
	if (!Check(schema, value)) throw new TypeError("Invalid Block document");
}

export function parseDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): Static<TSchemaValue> {
	assertDocument(schema, value);
	return value;
}

export function parseNullableDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): Static<TSchemaValue> | null {
	return value === null ? null : parseDocument(schema, value);
}

export function isPortableTextDocument(value: unknown): value is PortableTextDocumentValue {
	return Check(PortableTextDocument, value);
}

export type PortableTextDocumentNormalization =
	| { readonly state: "valid"; readonly document: PortableTextDocumentValue }
	| { readonly state: "repaired"; readonly document: PortableTextDocumentValue };

const RepairedPortableTextDocumentKey = "000000000000";
const BlockKeyPattern = /^[0-9a-f]{12}$/;

/**
 * Isolates malformed persisted Portable Text at a read boundary.
 *
 * Valid documents retain object identity. Invalid envelope fields and content
 * are narrowed to the render-safe vocabulary without mutating persistence, so
 * one corrupt row cannot fail a complete list or feed response.
 */
export function normalizePortableTextDocument(value: unknown): PortableTextDocumentNormalization {
	if (isPortableTextDocument(value)) return { state: "valid", document: value };
	const record =
		typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
	return {
		state: "repaired",
		document: {
			_type: "portable-text",
			_key:
				typeof record?._key === "string" && BlockKeyPattern.test(record._key)
					? record._key
					: RepairedPortableTextDocumentKey,
			content: normalizePortableText(record?.content),
		},
	};
}

export function getPortableTextContent(value: unknown): PortableTextDocumentValue["content"] {
	assertDocument(PortableTextDocument, value);
	return value.content;
}

export type BlockContainerDocument = {
	readonly _key?: string;
	readonly blocks: readonly Block[];
};

export interface BlockVisitContext {
	readonly depth: number;
	readonly parentType?: BlockParentType;
}

interface BlockChildGroup {
	readonly parentType: BlockParentType;
	readonly containerKey?: string;
	readonly blocks: readonly Block[];
}

function portableTextChildBlocks(block: PortableTextDocumentValue): readonly Block[] {
	return block.content.flatMap((candidate): Block[] => {
		if (candidate._type === "block" || candidate._type === "image") return [];
		if (!Check(BlockSchema, candidate))
			throw new TypeError(`Unknown Portable Text Block ${candidate._type}`);
		return [candidate];
	});
}

function childBlockGroups(block: Block): readonly BlockChildGroup[] {
	if (block._type === "portable-text")
		return [{ parentType: "portable-text", blocks: portableTextChildBlocks(block) }];
	if (block._type === "columns")
		return block.columns.map((column) => ({
			parentType: "columns",
			containerKey: column._key,
			blocks: column.blocks,
		}));
	if (block._type === "group" || block._type === "callout")
		return [{ parentType: block._type, blocks: block.blocks }];
	if (block._type === "tabs")
		return block.tabs.map((tab) => ({
			parentType: "tabs",
			containerKey: tab._key,
			blocks: tab.blocks,
		}));
	return [];
}

function inlineFilterDocument(block: Block): FilterDocument | undefined {
	if (block._type === "search" && block.feature.kind === "inline")
		return block.feature.filterDocument;
	if (block._type === "feed") {
		const feature = block.feature.kind === "derived" ? block.feature.query.feature : block.feature;
		if (feature.kind === "inline") return feature.filterDocument;
	}
	if (block._type === "unit-list") {
		const feature =
			block.source.kind === "search"
				? block.source.feature
				: block.source.kind === "derived"
					? block.source.query.feature
					: undefined;
		if (feature?.kind === "inline") return feature.filterDocument;
	}
	return undefined;
}

/** Visit every Block once, including custom Blocks embedded in Portable Text. */
export function walkBlockTree(
	document: BlockContainerDocument,
	visitor: (block: Block, context: BlockVisitContext) => void,
): void {
	const visit = (block: Block, context: BlockVisitContext): void => {
		visitor(block, context);
		for (const group of childBlockGroups(block))
			for (const child of group.blocks)
				visit(child, { depth: context.depth + 1, parentType: group.parentType });
	};
	for (const block of document.blocks) visit(block, { depth: 1 });
}

/** Count persisted Blocks that execute inline Search or Feed work. */
export function countQueryBlocks(document: BlockContainerDocument): number {
	let count = 0;
	walkBlockTree(document, (block) => {
		if (block._type === "feed" || (block._type === "unit-list" && block.source.kind !== "units"))
			count += 1;
	});
	return count;
}

/** Apply query-work limits only at write boundaries, preserving existing persisted documents. */
export function assertBlockQueryBudget(
	document: BlockContainerDocument,
	policy: Pick<BlockHostPolicy, "maxQueryBlocks">,
): void {
	const actual = countQueryBlocks(document);
	if (actual > policy.maxQueryBlocks)
		throw new TypeError(
			`Block document contains ${actual} query Blocks; the host maximum is ${policy.maxQueryBlocks}`,
		);
}

function assertBlockTree(value: BlockContainerDocument, policy: BlockHostPolicy): void {
	const assertUniqueKeys = (
		items: readonly { readonly _key: string }[],
		kind: "Block" | "column" | "tab",
	): void => {
		const keys = new Set<string>();
		for (const item of items) {
			if (keys.has(item._key)) throw new TypeError(`Duplicate ${kind} key ${item._key}`);
			keys.add(item._key);
		}
	};
	const assertLocalKeyScopes = (blocks: readonly Block[]): void => {
		assertUniqueKeys(blocks, "Block");
		for (const block of blocks) {
			if (block._type === "portable-text") {
				const children = portableTextChildBlocks(block);
				assertLocalKeyScopes(children);
				continue;
			}
			if (block._type === "columns") {
				assertUniqueKeys(block.columns, "column");
				for (const column of block.columns) assertLocalKeyScopes(column.blocks);
				continue;
			}
			if (block._type === "group" || block._type === "callout") {
				assertLocalKeyScopes(block.blocks);
				continue;
			}
			if (block._type === "tabs") {
				assertUniqueKeys(block.tabs, "tab");
				for (const tab of block.tabs) assertLocalKeyScopes(tab.blocks);
			}
		}
	};
	assertLocalKeyScopes(value.blocks);
	let count = 0;
	let classNameCount = 0;

	walkBlockTree(value, (block, { depth, parentType }) => {
		count += 1;
		if (count > policy.maxBlocks) throw new TypeError("Block document exceeds host block limit");
		classNameCount += block.classNames?.length ?? 0;
		if (classNameCount > policy.maxClassNames)
			throw new TypeError("Block document exceeds host custom class-name limit");
		if (depth > policy.maxDepth) throw new TypeError("Block document exceeds host depth limit");
		const allowed = parentType
			? (policy.allowedChildTypes[parentType] ?? [])
			: policy.allowedRootTypes;
		if (!allowed.includes(block._type))
			throw new TypeError(`Block ${block._type} is not allowed in this host`);
		if (
			block._type === "unit-list" &&
			block.source.kind === "units" &&
			new Set(block.source.unitIds).size !== block.source.unitIds.length
		)
			throw new TypeError("Unit List Block contains duplicate Unit references");
		if (
			(block._type === "feed" && block.initialSort === "relevance") ||
			(block._type === "feed" &&
				block.feature.kind === "derived" &&
				block.feature.query.sort === "relevance") ||
			(block._type === "unit-list" &&
				block.source.kind === "search" &&
				block.source.sort === "relevance") ||
			(block._type === "unit-list" &&
				block.source.kind === "derived" &&
				block.source.query.sort === "relevance")
		)
			throw new TypeError(
				`Block ${block._key} cannot persist the relevance sort without query text`,
			);
		if (
			block._type === "unit-list" &&
			block.presentation?.headingUnitId === "selected" &&
			block.source.kind !== "derived"
		)
			throw new TypeError(
				`Block ${block._key} can use the selected heading only with a derived source`,
			);
		if (
			block._type === "unit-list" &&
			block.presentation?.headingPrefixUnitId &&
			block.presentation.headingUnitId !== "selected"
		)
			throw new TypeError(
				`Block ${block._key} can use a heading prefix only with the selected heading`,
			);
		if (
			!policy.allowExternalNavigation &&
			block._type === "unit-list" &&
			block.presentation?.viewAllTarget?.kind === "external"
		)
			throw new TypeError("External navigation is not allowed");
		const filterDocument = inlineFilterDocument(block);
		if (filterDocument) assertFilterDocument(filterDocument);
	});
}

/** Structural TypeBox validation plus host, identity, complexity, and Search semantics. */
export function assertBlockDocument(
	value: unknown,
	policy: BlockHostPolicy = DefaultBlockHostPolicy,
): asserts value is BlockDocumentValue {
	assertDocument(BlockDocument, value);
	assertBlockTree(value, policy);
}

export function assertUnitReferencedBlockDocument(
	value: unknown,
	policy: BlockHostPolicy,
): asserts value is UnitReferencedBlockDocumentValue {
	assertDocument(UnitReferencedBlockDocument, value);
	assertBlockTree(value, policy);
}

export function assertDockDocument(
	value: unknown,
	policy: BlockHostPolicy = DockBlockHostPolicy,
): asserts value is DockDocumentValue {
	assertDocument(DockDocument, value);
	assertBlockTree(value, policy);
}

/** Validate a Wiki Post body and every custom REZICS Block embedded in it. */
export function assertWikiPostPortableTextDocument(
	value: unknown,
): asserts value is PortableTextDocumentValue {
	assertDocument(PortableTextDocument, value);
	assertBlockTree({ _key: `${value._key}:wiki-host`, blocks: [value] }, WikiPostBlockHostPolicy);
}

/** Repairs malformed persisted Wiki Portable Text to a render-safe empty body. */
export function normalizeWikiPostPortableTextDocument(
	value: unknown,
): PortableTextDocumentNormalization {
	const normalized = normalizePortableTextDocument(value);
	try {
		assertWikiPostPortableTextDocument(normalized.document);
		return normalized;
	} catch {
		return {
			state: "repaired",
			document: { ...normalized.document, content: [] },
		};
	}
}

export interface BlockReferences {
	readonly unitIds: ReadonlySet<string>;
	readonly labelUnitIds: ReadonlySet<string>;
	readonly wikiPostIds: ReadonlySet<string>;
	readonly assetIds: ReadonlySet<string>;
	readonly navigationIds: ReadonlySet<string>;
	readonly externalUrls: ReadonlySet<string>;
}

/** Collect references for semantic resolution, authorization, cache tags, and link previews. */
export function collectBlockReferences(document: BlockContainerDocument): BlockReferences {
	const unitIds = new Set<string>();
	const labelUnitIds = new Set<string>();
	const wikiPostIds = new Set<string>();
	const assetIds = new Set<string>();
	const navigationIds = new Set<string>();
	const externalUrls = new Set<string>();
	const addLabelUnitId = (identifier: string): void => {
		unitIds.add(identifier);
		labelUnitIds.add(identifier);
	};
	const addDerivedSourceReferences = (source: DerivedSearchFeatureSource): void => {
		if (source.select.from.kind === "collection") unitIds.add(source.select.from.collectionId);
		if (source.fallback.kind === "collection") unitIds.add(source.fallback.collectionId);
	};
	walkBlockTree(document, (block) => {
		if (block._type === "portable-text")
			for (const item of block.content)
				if (item._type === "image" && "assetId" in item && typeof item.assetId === "string")
					assetIds.add(item.assetId);
		if (block._type === "post-full-view") wikiPostIds.add(block.postId);
		if (block._type === "unit-ref") unitIds.add(block.unitId);
		if (block._type === "unit-list") {
			if (block.source.kind === "units") block.source.unitIds.forEach((id) => unitIds.add(id));
			if (block.source.kind === "collection") unitIds.add(block.source.collectionId);
			if (block.source.kind === "derived") addDerivedSourceReferences(block.source);
			if (block.presentation?.headingUnitId && block.presentation.headingUnitId !== "selected")
				addLabelUnitId(block.presentation.headingUnitId);
			if (block.presentation?.headingPrefixUnitId)
				addLabelUnitId(block.presentation.headingPrefixUnitId);
			if (block.presentation?.viewAllTarget?.kind === "unit")
				unitIds.add(block.presentation.viewAllTarget.unitId);
			if (block.presentation?.viewAllTarget?.kind === "external")
				externalUrls.add(block.presentation.viewAllTarget.url);
		}
		if (block._type === "feed" && block.feature.kind === "derived")
			addDerivedSourceReferences(block.feature);
		if (block._type === "menu") navigationIds.add(block.navigationId);
		if (block._type === "image") {
			assetIds.add(block.assetId);
		}
		if (block._type === "callout" && block.labelUnitId) addLabelUnitId(block.labelUnitId);
		if (block._type === "tabs") for (const tab of block.tabs) addLabelUnitId(tab.labelUnitId);
		const filterDocument = inlineFilterDocument(block);
		if (filterDocument) {
			assertFilterDocument(filterDocument);
			if (filterDocument.where)
				for (const id of collectUnitPredicateReferenceIds(filterDocument.where)) unitIds.add(id);
			for (const control of filterDocument.controls ?? []) {
				if (control.labelUnitId) addLabelUnitId(control.labelUnitId);
				if (
					filterDocumentControlField(control) === "tag" &&
					control.optionPolicy &&
					control.optionPolicy.kind !== "all"
				)
					for (const value of control.optionPolicy.values)
						if (typeof value === "string") unitIds.add(value);
			}
		}
	});
	return { unitIds, labelUnitIds, wikiPostIds, assetIds, navigationIds, externalUrls };
}

export interface NavigationReferences {
	readonly unitIds: ReadonlySet<string>;
	readonly labelUnitIds: ReadonlySet<string>;
	readonly externalUrls: ReadonlySet<string>;
}

export type BlockReferenceKind = "unit" | "label" | "wiki-post" | "asset" | "navigation";

export interface BlockReferenceResolver {
	/** Return only identifiers that are valid and readable in the current host context. */
	resolve(kind: BlockReferenceKind, identifiers: readonly string[]): Promise<ReadonlySet<string>>;
}

export class UnresolvedBlockReferenceError extends TypeError {
	constructor(
		readonly kind: BlockReferenceKind,
		readonly identifier: string,
	) {
		super(`Unresolved ${kind} Block reference ${identifier}`);
	}
}

async function assertReferenceSet(
	kind: BlockReferenceKind,
	identifiers: ReadonlySet<string>,
	resolver: BlockReferenceResolver,
): Promise<void> {
	if (!identifiers.size) return;
	const requested = [...identifiers];
	const resolved = await resolver.resolve(kind, requested);
	const missing = requested.find((identifier) => !resolved.has(identifier));
	if (missing) throw new UnresolvedBlockReferenceError(kind, missing);
}

/** Resolve all non-URL references in batches after structural validation. */
export async function assertResolvedBlockReferences(
	document: BlockContainerDocument,
	resolver: BlockReferenceResolver,
): Promise<void> {
	const references = collectBlockReferences(document);
	await Promise.all([
		assertReferenceSet("unit", references.unitIds, resolver),
		assertReferenceSet("label", references.labelUnitIds, resolver),
		assertReferenceSet("wiki-post", references.wikiPostIds, resolver),
		assertReferenceSet("asset", references.assetIds, resolver),
		assertReferenceSet("navigation", references.navigationIds, resolver),
	]);
}

export function assertNavigationDocument(
	value: unknown,
	options: { readonly allowExternalNavigation?: boolean } = {},
): asserts value is NavigationDocumentValue {
	assertDocument(NavigationDocument, value);
	const visit = (items: readonly NavigationItem[], depth: number): void => {
		if (depth > 3) throw new TypeError("Navigation document exceeds depth limit");
		const siblingKeys = new Set<string>();
		for (const item of items) {
			if (siblingKeys.has(item._key))
				throw new TypeError(`Duplicate navigation item key ${item._key}`);
			siblingKeys.add(item._key);
			if ("target" in item && item.target.kind === "external" && !options.allowExternalNavigation)
				throw new TypeError("External navigation is not allowed");
			if ("children" in item) visit(item.children, depth + 1);
		}
	};
	visit(value.items, 1);
}

export function collectNavigationReferences(
	document: NavigationDocumentValue,
): NavigationReferences {
	const unitIds = new Set<string>();
	const labelUnitIds = new Set<string>();
	const externalUrls = new Set<string>();
	const visit = (item: NavigationItem): void => {
		unitIds.add(item.labelUnitId);
		labelUnitIds.add(item.labelUnitId);
		if ("target" in item) {
			if (item.target.kind === "unit") unitIds.add(item.target.unitId);
			if (item.target.kind === "external") externalUrls.add(item.target.url);
		}
		if ("children" in item) item.children.forEach(visit);
	};
	document.items.forEach(visit);
	return { unitIds, labelUnitIds, externalUrls };
}

export async function assertResolvedNavigationReferences(
	document: NavigationDocumentValue,
	resolver: BlockReferenceResolver,
): Promise<void> {
	const references = collectNavigationReferences(document);
	await Promise.all([
		assertReferenceSet("unit", references.unitIds, resolver),
		assertReferenceSet("label", references.labelUnitIds, resolver),
	]);
}
