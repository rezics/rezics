import { assertSearchConfiguration, type SearchConfiguration } from "@rezics/search";
import { type Static, type TSchema } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

import {
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
	readonly allowedChildTypes: Readonly<
		Partial<Record<"group" | "callout" | "tabs", readonly BlockType[]>>
	>;
	readonly maxDepth: number;
	readonly maxBlocks: number;
	readonly allowExternalNavigation: boolean;
}

export const DefaultBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: [
		"portable-text",
		"unit-ref",
		"unit-list",
		"search",
		"menu",
		"media",
		"divider",
		"group",
		"callout",
		"tabs",
	],
	allowedChildTypes: {
		group: [
			"portable-text",
			"unit-ref",
			"unit-list",
			"search",
			"menu",
			"media",
			"divider",
			"group",
			"callout",
			"tabs",
		],
		callout: ["portable-text", "unit-ref", "unit-list", "media", "divider", "group"],
		tabs: [
			"portable-text",
			"unit-ref",
			"unit-list",
			"search",
			"menu",
			"media",
			"divider",
			"group",
			"callout",
		],
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
		"menu",
		"media",
		"divider",
		"group",
		"callout",
	],
	allowedChildTypes: {
		group: ["unit-ref", "unit-list", "search", "menu", "media", "divider", "callout"],
		callout: ["unit-ref", "unit-list", "media", "divider"],
	},
	maxDepth: 2,
	maxBlocks: 40,
	allowExternalNavigation: false,
};

export const ZonePageBlockHostPolicy: BlockHostPolicy = {
	allowedRootTypes: [
		"unit-ref",
		"unit-list",
		"search",
		"menu",
		"media",
		"divider",
		"group",
		"callout",
		"tabs",
	],
	allowedChildTypes: {
		group: [
			"unit-ref",
			"unit-list",
			"search",
			"menu",
			"media",
			"divider",
			"group",
			"callout",
			"tabs",
		],
		callout: ["unit-ref", "unit-list", "media", "divider", "group"],
		tabs: ["unit-ref", "unit-list", "search", "menu", "media", "divider", "group", "callout"],
	},
	maxDepth: 4,
	maxBlocks: 250,
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

export function getPortableTextContent(value: unknown): PortableTextDocumentValue["content"] {
	assertDocument(PortableTextDocument, value);
	return value.content;
}

function childBlocks(block: Block): readonly Block[] {
	if (block._type === "group" || block._type === "callout") return block.blocks;
	if (block._type === "tabs") return block.tabs.flatMap((tab) => tab.blocks);
	return [];
}

type BlockContainerDocument = {
	readonly _key: string;
	readonly blocks: readonly Block[];
};

function assertBlockTree(value: BlockContainerDocument, policy: BlockHostPolicy): void {
	const keys = new Set<string>([value._key]);
	let count = 0;

	const visit = (block: Block, depth: number, parent?: "group" | "callout" | "tabs"): void => {
		count += 1;
		if (count > policy.maxBlocks)
			throw new TypeError("Block document exceeds host block limit");
		if (depth > policy.maxDepth) throw new TypeError("Block document exceeds host depth limit");
		if (keys.has(block._key)) throw new TypeError(`Duplicate Block key ${block._key}`);
		keys.add(block._key);
		const allowed = parent ? (policy.allowedChildTypes[parent] ?? []) : policy.allowedRootTypes;
		if (!allowed.includes(block._type))
			throw new TypeError(`Block ${block._type} is not allowed in this host`);
		if (block._type === "search") assertSearchBlock(block.configuration);
		if (block._type === "unit-list" && block.source.kind === "search")
			assertSearchBlock(block.source.configuration);
		if (
			block._type === "unit-list" &&
			block.source.kind === "units" &&
			new Set(block.source.unitIds).size !== block.source.unitIds.length
		)
			throw new TypeError("Unit List Block contains duplicate Unit references");
		if (block._type === "tabs") {
			for (const tab of block.tabs) {
				if (keys.has(tab._key)) throw new TypeError(`Duplicate Block key ${tab._key}`);
				keys.add(tab._key);
			}
		}
		for (const child of childBlocks(block))
			visit(
				child,
				depth + 1,
				block._type === "tabs" ? "tabs" : block._type === "callout" ? "callout" : "group",
			);
	};

	for (const block of value.blocks) visit(block, 1);
}

function assertSearchBlock(configuration: SearchConfiguration): void {
	assertSearchConfiguration(configuration);
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

export interface BlockReferences {
	readonly unitIds: ReadonlySet<string>;
	readonly assetIds: ReadonlySet<string>;
	readonly navigationIds: ReadonlySet<string>;
	readonly zonePageSlugs: ReadonlySet<string>;
	readonly externalUrls: ReadonlySet<string>;
}

/** Collect references for semantic resolution, authorization, cache tags, and link previews. */
export function collectBlockReferences(document: BlockContainerDocument): BlockReferences {
	const unitIds = new Set<string>();
	const assetIds = new Set<string>();
	const navigationIds = new Set<string>();
	const zonePageSlugs = new Set<string>();
	const externalUrls = new Set<string>();
	const unitReferenceFields = new Set([
		"tag",
		"author",
		"realm",
		"zone",
		"subject",
		"target",
		"root",
		"parent",
		"owner",
	]);
	const addUnitScalar = (field: string, value: unknown) => {
		if (
			unitReferenceFields.has(field) &&
			typeof value === "string" &&
			/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
				value,
			)
		)
			unitIds.add(value);
	};
	const addSearchScope = (configuration: SearchConfiguration) => {
		if (configuration.scope.kind === "unit") unitIds.add(configuration.scope.unitId);
		if (configuration.scope.kind === "realm") unitIds.add(configuration.scope.realmId);
		if (configuration.scope.kind === "zone") unitIds.add(configuration.scope.zoneId);
		for (const control of configuration.controls)
			if (control.labelUnitId) unitIds.add(control.labelUnitId);
		for (const control of configuration.controls)
			if (control.optionSource?.kind === "static")
				for (const option of control.optionSource.options)
					if (option.labelUnitId) unitIds.add(option.labelUnitId);
		for (const control of configuration.controls) {
			if (control.optionSource?.kind === "static")
				for (const option of control.optionSource.options)
					addUnitScalar(control.field, option.value);
			if (control.optionPolicy?.kind !== undefined && control.optionPolicy.kind !== "all")
				for (const value of control.optionPolicy.values)
					addUnitScalar(control.field, value);
		}
		for (const filter of [...configuration.constraints, ...configuration.defaults]) {
			if ("values" in filter)
				filter.values.forEach((value) => addUnitScalar(filter.field, value));
			else if ("value" in filter) addUnitScalar(filter.field, filter.value);
			else {
				addUnitScalar(filter.field, filter.lower);
				addUnitScalar(filter.field, filter.upper);
			}
		}
	};
	const visit = (block: Block): void => {
		if (block._type === "unit-ref") unitIds.add(block.unitId);
		if (block._type === "unit-list") {
			if (block.source.kind === "units")
				block.source.unitIds.forEach((id) => unitIds.add(id));
			if (block.source.kind === "collection") unitIds.add(block.source.collectionId);
			if (block.source.kind === "search") addSearchScope(block.source.configuration);
		}
		if (block._type === "search") addSearchScope(block.configuration);
		if (block._type === "menu") navigationIds.add(block.navigationId);
		if (block._type === "media") {
			assetIds.add(block.assetId);
			unitIds.add(block.altUnitId);
			if (block.captionUnitId) unitIds.add(block.captionUnitId);
			if (block.target?.kind === "unit") unitIds.add(block.target.unitId);
			if (block.target?.kind === "zone-page") zonePageSlugs.add(block.target.slug);
			if (block.target?.kind === "external") externalUrls.add(block.target.url);
		}
		if (block._type === "callout" && block.labelUnitId) unitIds.add(block.labelUnitId);
		if (block._type === "tabs")
			for (const tab of block.tabs) {
				unitIds.add(tab.labelUnitId);
				tab.blocks.forEach(visit);
			}
		if (block._type === "group" || block._type === "callout") block.blocks.forEach(visit);
	};
	document.blocks.forEach(visit);
	return { unitIds, assetIds, navigationIds, zonePageSlugs, externalUrls };
}

export interface NavigationReferences {
	readonly unitIds: ReadonlySet<string>;
	readonly zonePageSlugs: ReadonlySet<string>;
	readonly externalUrls: ReadonlySet<string>;
}

export type BlockReferenceKind = "unit" | "asset" | "navigation" | "zone-page";

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
		assertReferenceSet("asset", references.assetIds, resolver),
		assertReferenceSet("navigation", references.navigationIds, resolver),
		assertReferenceSet("zone-page", references.zonePageSlugs, resolver),
	]);
}

export function assertNavigationDocument(
	value: unknown,
	options: { readonly allowExternalNavigation?: boolean } = {},
): asserts value is NavigationDocumentValue {
	assertDocument(NavigationDocument, value);
	const keys = new Set<string>([value._key]);
	let count = 0;
	const visit = (item: NavigationItem, depth: number): void => {
		count += 1;
		if (count > 200) throw new TypeError("Navigation document exceeds item limit");
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
	const zonePageSlugs = new Set<string>();
	const externalUrls = new Set<string>();
	const visit = (item: NavigationItem): void => {
		unitIds.add(item.labelUnitId);
		if ("target" in item) {
			if (item.target.kind === "unit") unitIds.add(item.target.unitId);
			if (item.target.kind === "zone-page") zonePageSlugs.add(item.target.slug);
			if (item.target.kind === "external") externalUrls.add(item.target.url);
		}
		if ("children" in item) item.children.forEach(visit);
	};
	document.items.forEach(visit);
	return { unitIds, zonePageSlugs, externalUrls };
}

export async function assertResolvedNavigationReferences(
	document: NavigationDocumentValue,
	resolver: BlockReferenceResolver,
): Promise<void> {
	const references = collectNavigationReferences(document);
	await Promise.all([
		assertReferenceSet("unit", references.unitIds, resolver),
		assertReferenceSet("zone-page", references.zonePageSlugs, resolver),
	]);
}
