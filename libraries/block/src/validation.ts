import { type Static, type TSchema } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import { normalizePortableText } from "@rezics/portable-text";

import {
	Block as BlockSchema,
	BlockDocument,
	type Block,
	type BlockDocument as BlockDocumentValue,
	type BlockType,
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
	"media",
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
	"media",
	"divider",
	"columns",
	"group",
	"callout",
	"tabs",
] as const satisfies readonly BlockType[];

export const DefaultBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: AllBlockTypes,
	allowedChildTypes: {
		"portable-text": AllBlockTypes,
		columns: AllBlockTypes,
		group: AllBlockTypes,
		callout: ["portable-text", "unit-ref", "unit-list", "media", "divider", "columns", "group"],
		tabs: AllBlockTypes,
	},
	maxDepth: 4,
	maxBlocks: 250,
	allowExternalNavigation: false,
};

export const DockBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: [
		"unit-ref",
		"unit-list",
		"search",
		"feed",
		"menu",
		"media",
		"divider",
		"columns",
		"group",
		"callout",
	],
	allowedChildTypes: {
		columns: ["unit-ref", "unit-list", "search", "feed", "menu", "media", "divider", "callout"],
		group: [
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"media",
			"divider",
			"columns",
			"callout",
		],
		callout: ["unit-ref", "unit-list", "media", "divider"],
	},
	maxDepth: 2,
	maxBlocks: 40,
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
		"media",
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
			"media",
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
			"media",
			"divider",
			"columns",
			"group",
			"callout",
			"tabs",
		],
		callout: ["unit-ref", "unit-list", "media", "divider", "columns", "group"],
		tabs: [
			"post-full-view",
			"unit-ref",
			"unit-list",
			"search",
			"feed",
			"menu",
			"media",
			"divider",
			"columns",
			"group",
			"callout",
		],
	},
	maxDepth: 4,
	maxBlocks: 250,
	allowExternalNavigation: false,
};

/** Host policy for custom REZICS block objects embedded in Wiki Post Portable Text. */
export const WikiPostBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: ["portable-text"],
	allowedChildTypes: {
		"portable-text": WikiPostChildTypes,
		columns: WikiPostChildTypes,
		group: WikiPostChildTypes,
		callout: ["portable-text", "unit-ref", "unit-list", "media", "divider", "columns", "group"],
		tabs: WikiPostChildTypes,
	},
	maxDepth: 6,
	maxBlocks: 500,
	allowExternalNavigation: false,
};

export function isDocument<TSchemaValue extends TSchema>(
	schema: TSchemaValue,
	value: unknown,
): value is Static<TSchemaValue> {
	return Check(schema, value);
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

function assertBlockTree(value: BlockContainerDocument, policy: BlockHostPolicy): void {
	const keys = new Set<string>(value._key ? [value._key] : []);
	let count = 0;

	walkBlockTree(value, (block, { depth, parentType }) => {
		count += 1;
		if (count > policy.maxBlocks) throw new TypeError("Block document exceeds host block limit");
		if (depth > policy.maxDepth) throw new TypeError("Block document exceeds host depth limit");
		if (keys.has(block._key)) throw new TypeError(`Duplicate Block key ${block._key}`);
		keys.add(block._key);
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
		for (const group of childBlockGroups(block)) {
			if (!group.containerKey) continue;
			if (keys.has(group.containerKey))
				throw new TypeError(`Duplicate Block key ${group.containerKey}`);
			keys.add(group.containerKey);
		}
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
	readonly wikiPostIds: ReadonlySet<string>;
	readonly assetIds: ReadonlySet<string>;
	readonly navigationIds: ReadonlySet<string>;
	readonly externalUrls: ReadonlySet<string>;
}

/** Collect references for semantic resolution, authorization, cache tags, and link previews. */
export function collectBlockReferences(document: BlockContainerDocument): BlockReferences {
	const unitIds = new Set<string>();
	const wikiPostIds = new Set<string>();
	const assetIds = new Set<string>();
	const navigationIds = new Set<string>();
	const externalUrls = new Set<string>();
	walkBlockTree(document, (block) => {
		if (block._type === "post-full-view") wikiPostIds.add(block.postId);
		if (block._type === "unit-ref") unitIds.add(block.unitId);
		if (block._type === "unit-list") {
			if (block.source.kind === "units") block.source.unitIds.forEach((id) => unitIds.add(id));
			if (block.source.kind === "collection") unitIds.add(block.source.collectionId);
		}
		if (block._type === "menu") navigationIds.add(block.navigationId);
		if (block._type === "media") {
			assetIds.add(block.assetId);
			unitIds.add(block.altUnitId);
			if (block.captionUnitId) unitIds.add(block.captionUnitId);
			if (block.target?.kind === "unit") unitIds.add(block.target.unitId);
			if (block.target?.kind === "external") externalUrls.add(block.target.url);
		}
		if (block._type === "callout" && block.labelUnitId) unitIds.add(block.labelUnitId);
		if (block._type === "tabs") for (const tab of block.tabs) unitIds.add(tab.labelUnitId);
	});
	return { unitIds, wikiPostIds, assetIds, navigationIds, externalUrls };
}

export interface NavigationReferences {
	readonly unitIds: ReadonlySet<string>;
	readonly externalUrls: ReadonlySet<string>;
}

export type BlockReferenceKind = "unit" | "wiki-post" | "asset" | "navigation";

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
	const keys = new Set<string>([value._key]);
	const visit = (item: NavigationItem, depth: number): void => {
		if (depth > 3) throw new TypeError("Navigation document exceeds depth limit");
		if (keys.has(item._key)) throw new TypeError(`Duplicate Block key ${item._key}`);
		keys.add(item._key);
		if ("target" in item && item.target.kind === "external" && !options.allowExternalNavigation)
			throw new TypeError("External navigation is not allowed");
		if ("children" in item) item.children.forEach((child) => visit(child, depth + 1));
	};
	value.items.forEach((item) => visit(item, 1));
}

export function collectNavigationReferences(
	document: NavigationDocumentValue,
): NavigationReferences {
	const unitIds = new Set<string>();
	const externalUrls = new Set<string>();
	const visit = (item: NavigationItem): void => {
		unitIds.add(item.labelUnitId);
		if ("target" in item) {
			if (item.target.kind === "unit") unitIds.add(item.target.unitId);
			if (item.target.kind === "external") externalUrls.add(item.target.url);
		}
		if ("children" in item) item.children.forEach(visit);
	};
	document.items.forEach(visit);
	return { unitIds, externalUrls };
}

export async function assertResolvedNavigationReferences(
	document: NavigationDocumentValue,
	resolver: BlockReferenceResolver,
): Promise<void> {
	const references = collectNavigationReferences(document);
	await Promise.all([assertReferenceSet("unit", references.unitIds, resolver)]);
}
