import {
	SearchCategoryValues,
	SearchFieldValues,
	assertUnitPredicate,
	canonicalUnitPredicate,
	parseFilterDocument,
	parseSharedSearchQueryDocument,
	type FilterDocument,
	type FilterDocumentControl,
	type SearchCategory,
	type SearchDisclosure,
	type SearchField,
	type SearchOptionPolicy,
	type SharedSearchQueryDocument,
	type UnitPredicate,
} from "@rezics/filter";

type JsonRecord = Record<string, unknown>;

export interface MigrationResult<Value> {
	readonly changed: boolean;
	readonly value: Value;
}

const LegacyTemplateIdValues = [
	"global",
	"book",
	"media",
	"software",
	"progress",
	"realm",
	"zone",
] as const;
type LegacyTemplateId = (typeof LegacyTemplateIdValues)[number];

const WorkZoneCategories = ["units", "posts", "reviews", "collections"] as const;
const GlobalVisibleFields = new Set<SearchField>([
	"category",
	"kind",
	"language",
	"content-rating",
	"tag",
]);

/**
 * Cutover-only knowledge of the removed preview templates.
 *
 * These values are not product presets. They exist solely to distinguish old
 * generated configuration from an administrator's explicit changes while the
 * production rows are rewritten once.
 */
const LegacyTemplateDefinitions = {
	global: {
		categories: SearchCategoryValues,
		visible: ["category", "kind", "language", "content-rating", "tag"],
	},
	book: {
		categories: WorkZoneCategories,
		visible: ["language", "tag", "book-word-count", "book-format"],
	},
	media: {
		categories: WorkZoneCategories,
		visible: ["language", "tag", "media-kind", "media-release-date", "media-runtime-minutes"],
	},
	software: {
		categories: WorkZoneCategories,
		visible: ["language", "tag", "software-platform", "software-requirement-tier"],
	},
	progress: { categories: ["units"], visible: [] },
	realm: { categories: ["realms"], visible: ["language", "tag"] },
	zone: { categories: ["units"], visible: ["language", "tag"] },
} as const satisfies Record<
	LegacyTemplateId,
	{
		readonly categories: readonly SearchCategory[];
		readonly visible: readonly SearchField[];
	}
>;

function isRecord(value: unknown): value is JsonRecord {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown, path: string): JsonRecord {
	if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
	return value;
}

function isLegacyTemplateId(value: unknown): value is LegacyTemplateId {
	return typeof value === "string" && (LegacyTemplateIdValues as readonly string[]).includes(value);
}

function isSearchCategory(value: unknown): value is SearchCategory {
	return typeof value === "string" && (SearchCategoryValues as readonly string[]).includes(value);
}

function isSearchField(value: unknown): value is SearchField {
	return typeof value === "string" && (SearchFieldValues as readonly string[]).includes(value);
}

function parseCategories(value: unknown, path: string): SearchCategory[] {
	if (!Array.isArray(value) || !value.length || !value.every(isSearchCategory))
		throw new TypeError(`${path} must contain Search categories`);
	if (new Set(value).size !== value.length) throw new TypeError(`${path} contains duplicates`);
	return [...value];
}

function sameSet<Value>(left: readonly Value[], right: readonly Value[]): boolean {
	return left.length === right.length && left.every((value) => right.includes(value));
}

function compactCategories(
	categories: readonly SearchCategory[],
): Pick<FilterDocument, "categories"> {
	return sameSet(categories, SearchCategoryValues) ? {} : { categories: [...categories] };
}

function parseLegacyTemplateId(document: JsonRecord, path: string): LegacyTemplateId {
	const template = asRecord(document.template, `${path}.template`);
	if (!isLegacyTemplateId(template.id)) throw new TypeError(`${path}.template.id is unsupported`);
	if (template.version !== 1) throw new TypeError(`${path}.template.version is unsupported`);
	return template.id;
}

function newDefaultDisclosure(field: SearchField): SearchDisclosure {
	return GlobalVisibleFields.has(field) ? "visible" : "hidden";
}

function readOptionPolicy(value: unknown, path: string): SearchOptionPolicy | undefined {
	if (value === undefined) return undefined;
	const policy = asRecord(value, path);
	if (policy.kind === "all") return undefined;
	if (policy.kind !== "include" && policy.kind !== "exclude")
		throw new TypeError(`${path}.kind is unsupported`);
	if (!Array.isArray(policy.values)) throw new TypeError(`${path}.values must be an array`);
	return policy as SearchOptionPolicy;
}

function migrateLegacyControls(
	document: JsonRecord,
	templateId: LegacyTemplateId,
	path: string,
): FilterDocumentControl[] | undefined {
	if (!Array.isArray(document.controls)) throw new TypeError(`${path}.controls must be an array`);
	const legacyVisible = new Set<SearchField>(LegacyTemplateDefinitions[templateId].visible);
	const migrated = new Map<string, FilterDocumentControl>();
	for (const [index, value] of document.controls.entries()) {
		const controlPath = `${path}.controls[${index}]`;
		const control = asRecord(value, controlPath);
		if (typeof control.key !== "string" || !control.key)
			throw new TypeError(`${controlPath}.key is invalid`);
		if (!isSearchField(control.field)) throw new TypeError(`${controlPath}.field is invalid`);
		if (typeof control.enabled !== "boolean")
			throw new TypeError(`${controlPath}.enabled is invalid`);
		if (control.disclosure !== "visible" && control.disclosure !== "hidden")
			throw new TypeError(`${controlPath}.disclosure is invalid`);

		const isCustomTag = control.field === "tag" && control.key !== "tag";
		const key = isCustomTag ? control.key : control.field;
		const override: FilterDocumentControl = {
			key,
			...(isCustomTag ? { field: "tag" as const } : {}),
			...(control.enabled ? {} : { enabled: false }),
		};
		const legacyDefault = legacyVisible.has(control.field) ? "visible" : "hidden";
		const disclosureWasCustomized = isCustomTag || control.disclosure !== legacyDefault;
		if (disclosureWasCustomized && control.disclosure !== newDefaultDisclosure(control.field))
			Object.assign(override, { disclosure: control.disclosure });
		if (control.labelUnitId !== undefined) {
			if (typeof control.labelUnitId !== "string")
				throw new TypeError(`${controlPath}.labelUnitId is invalid`);
			Object.assign(override, { labelUnitId: control.labelUnitId });
		}
		const optionPolicy = readOptionPolicy(control.optionPolicy, `${controlPath}.optionPolicy`);
		if (optionPolicy) Object.assign(override, { optionPolicy });
		if (control.required === true && control.enabled) Object.assign(override, { required: true });
		else if (control.required !== undefined && typeof control.required !== "boolean")
			throw new TypeError(`${controlPath}.required is invalid`);

		const isNoOp = Object.keys(override).length === 1;
		if (isNoOp) continue;
		if (migrated.has(key)) throw new TypeError(`${path} maps multiple controls to ${key}`);
		migrated.set(key, override);
	}
	return migrated.size ? [...migrated.values()] : undefined;
}

function readLegacyFixedPredicate(document: JsonRecord): UnitPredicate | undefined {
	if (document.filter === undefined) return undefined;
	assertUnitPredicate(document.filter);
	return document.filter;
}

function combinePredicates(
	predicates: readonly (UnitPredicate | undefined)[],
): UnitPredicate | undefined {
	const unique = new Map<string, UnitPredicate>();
	for (const predicate of predicates) {
		if (!predicate) continue;
		assertUnitPredicate(predicate);
		unique.set(canonicalUnitPredicate(predicate), predicate);
	}
	const values = [...unique.values()];
	if (!values.length) return undefined;
	const combined: UnitPredicate = values.length === 1 ? values[0]! : { all: values };
	assertUnitPredicate(combined);
	return combined;
}

function parseLegacyBoundary(
	value: unknown,
	path: string,
): {
	readonly categories: SearchCategory[];
	readonly where?: UnitPredicate;
} {
	const boundary = asRecord(value, path);
	if (boundary._type !== "zone-boundary") throw new TypeError(`${path} is not a Zone boundary`);
	const categories = parseCategories(boundary.categories, `${path}.categories`);
	if (boundary.filter !== undefined) assertUnitPredicate(boundary.filter);
	return {
		categories,
		...(boundary.filter ? { where: boundary.filter } : {}),
	};
}

function readMeaningfulLegacySearchConfiguration(
	value: unknown,
	path: string,
): {
	readonly categories?: SearchCategory[];
	readonly where?: UnitPredicate;
	readonly controls?: FilterDocumentControl[];
} {
	const document = asRecord(value, path);
	if (document.version !== 1) throw new TypeError(`${path}.version is unsupported`);
	const templateId = parseLegacyTemplateId(document, path);
	if (templateId === "progress")
		throw new TypeError("Progress Search was never a valid Zone configuration");
	const categories = parseCategories(document.categories, `${path}.categories`);
	const controls = migrateLegacyControls(document, templateId, path);
	const where = combinePredicates([
		legacyTemplateFilterDocument(templateId).where,
		readLegacyFixedPredicate(document),
	]);
	return {
		// Categories and fixed predicates change the selected rows, even when
		// they originated in a generated template. Preserve those semantics;
		// only capability/default/limit configuration is discarded.
		categories,
		...(where ? { where } : {}),
		...(controls ? { controls } : {}),
	};
}

/** Converts one old Zone boundary plus its active SearchDocument to a sparse FilterDocument. */
export function migrateLegacyZoneFilterDocument(input: {
	readonly boundaryDocument: unknown;
	readonly searchDocument?: unknown;
	readonly searchEnabled?: boolean;
}): FilterDocument {
	const boundary = parseLegacyBoundary(input.boundaryDocument, "boundaryDocument");
	const configured =
		input.searchEnabled && input.searchDocument !== undefined
			? readMeaningfulLegacySearchConfiguration(input.searchDocument, "searchDocument")
			: undefined;
	const categories = configured?.categories
		? boundary.categories.filter((category) => configured.categories?.includes(category))
		: boundary.categories;
	if (!categories.length) throw new TypeError("Zone Filter migration produced no categories");
	const where = combinePredicates([boundary.where, configured?.where]);
	return parseFilterDocument({
		...compactCategories(categories),
		...(where ? { where } : {}),
		...(configured?.controls ? { controls: configured.controls } : {}),
	});
}

/** Freezes the old query's effective selection without retaining a preset identity. */
function legacyTemplateFilterDocument(templateId: LegacyTemplateId): FilterDocument {
	const definition = LegacyTemplateDefinitions[templateId];
	const where =
		templateId === "zone"
			? ({ kind: { in: ["zone"] } } satisfies UnitPredicate)
			: templateId === "progress"
				? ({ kind: { in: ["book", "media", "software"] } } satisfies UnitPredicate)
				: undefined;
	return parseFilterDocument({
		...compactCategories(definition.categories),
		...(where ? { where } : {}),
	});
}

export function migrateSharedSearchQueryDocument(value: unknown): SharedSearchQueryDocument {
	if (isRecord(value) && "filterDocument" in value) return parseSharedSearchQueryDocument(value);
	const document = asRecord(value, "sharedSearchQuery.document");
	if (document.version !== 1)
		throw new TypeError("sharedSearchQuery.document.version is unsupported");
	if (!isLegacyTemplateId(document.template) || document.template === "progress")
		throw new TypeError("sharedSearchQuery.document.template is unsupported");
	return parseSharedSearchQueryDocument({
		filterDocument: legacyTemplateFilterDocument(document.template),
		state: document.state,
		selections: document.selections,
	});
}

function migrateLegacySearchSource(value: unknown): MigrationResult<unknown> {
	if (!isRecord(value) || value.kind !== "template") return { changed: false, value };
	if (!isLegacyTemplateId(value.template) || value.template === "progress")
		throw new TypeError("Block Search source uses an unsupported legacy template");
	const filterDocument = legacyTemplateFilterDocument(value.template);
	// Remove template identity and capability/default data, but retain any
	// category or predicate that changed the old Block's selected rows.
	return {
		changed: true,
		value:
			Object.keys(filterDocument).length === 0
				? { kind: "global" }
				: { kind: "inline", filterDocument },
	};
}

function migrateBlock(value: unknown): MigrationResult<unknown> {
	if (!isRecord(value) || typeof value._type !== "string") return { changed: false, value };
	if (value._type === "feed") {
		const feature = migrateLegacySearchSource(value.feature);
		return feature.changed
			? { changed: true, value: { ...value, feature: feature.value } }
			: { changed: false, value };
	}
	if (value._type === "unit-list") {
		const source = isRecord(value.source) ? value.source : undefined;
		if (source?.kind !== "search") return { changed: false, value };
		const feature = migrateLegacySearchSource(source.feature);
		return feature.changed
			? {
					changed: true,
					value: { ...value, source: { ...source, feature: feature.value } },
				}
			: { changed: false, value };
	}
	if (value._type === "columns" && Array.isArray(value.columns)) {
		let changed = false;
		const columns = value.columns.map((candidate) => {
			if (!isRecord(candidate) || !Array.isArray(candidate.blocks)) return candidate;
			const blocks = migrateBlocks(candidate.blocks);
			changed ||= blocks.changed;
			return blocks.changed ? { ...candidate, blocks: blocks.value } : candidate;
		});
		return changed ? { changed: true, value: { ...value, columns } } : { changed: false, value };
	}
	if ((value._type === "group" || value._type === "callout") && Array.isArray(value.blocks)) {
		const blocks = migrateBlocks(value.blocks);
		return blocks.changed
			? { changed: true, value: { ...value, blocks: blocks.value } }
			: { changed: false, value };
	}
	if (value._type === "tabs" && Array.isArray(value.tabs)) {
		let changed = false;
		const tabs = value.tabs.map((candidate) => {
			if (!isRecord(candidate) || !Array.isArray(candidate.blocks)) return candidate;
			const blocks = migrateBlocks(candidate.blocks);
			changed ||= blocks.changed;
			return blocks.changed ? { ...candidate, blocks: blocks.value } : candidate;
		});
		return changed ? { changed: true, value: { ...value, tabs } } : { changed: false, value };
	}
	return { changed: false, value };
}

function migrateBlocks(values: readonly unknown[]): MigrationResult<unknown[]> {
	let changed = false;
	const blocks = values.map((value) => {
		const migrated = migrateBlock(value);
		changed ||= migrated.changed;
		return migrated.value;
	});
	return { changed, value: blocks };
}

/** Rewrites only known Block-document positions; authored Portable Text is never traversed. */
export function migrateBlockDocument(value: unknown): MigrationResult<unknown> {
	if (!isRecord(value)) return { changed: false, value };
	if (
		(value._type !== "block-document" && value._type !== "dock-document") ||
		!Array.isArray(value.blocks)
	)
		return { changed: false, value };
	const blocks = migrateBlocks(value.blocks);
	return blocks.changed
		? { changed: true, value: { ...value, blocks: blocks.value } }
		: { changed: false, value };
}

/** Migrates `rezics.unit.main.v1` payloads for historical Zone snapshots. */
export function migrateUnitMainRevisionPayload(value: unknown): MigrationResult<unknown> {
	if (!isRecord(value) || value.kind !== "zone") return { changed: false, value };
	const extension = asRecord(value.extension, "revision.main.extension");
	if (!("boundaryDocument" in extension)) return { changed: false, value };
	const { boundaryDocument, ...rest } = extension;
	return {
		changed: true,
		value: {
			...value,
			extension: {
				...rest,
				filterDocument: migrateLegacyZoneFilterDocument({ boundaryDocument }),
			},
		},
	};
}

/** Migrates `rezics.unit.localization.v1` payloads containing Zone Page Blocks. */
export function migrateUnitLocalizationRevisionPayload(value: unknown): MigrationResult<unknown> {
	if (!isRecord(value) || !isRecord(value.localization)) return { changed: false, value };
	const content = migrateBlockDocument(value.localization.content);
	return content.changed
		? {
				changed: true,
				value: { ...value, localization: { ...value.localization, content: content.value } },
			}
		: { changed: false, value };
}

/** Migrates `rezics.dock.v1` payloads; deleted checkpoints have no document. */
export function migrateDockRevisionPayload(value: unknown): MigrationResult<unknown> {
	if (!isRecord(value) || !isRecord(value.dock)) return { changed: false, value };
	const document = migrateBlockDocument(value.dock.document);
	return document.changed
		? { changed: true, value: { ...value, dock: { ...value.dock, document: document.value } } }
		: { changed: false, value };
}
