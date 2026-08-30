import {
	canonicalizeContentLanguageTag,
	ContentLanguageChannelValues,
	MaximumContentLanguageTagLength,
} from "@rezics/content-language";
import { type Static, type TSchema, Type } from "typebox";
import { Check } from "typebox/value";

function stringEnum<const Values extends readonly [string, ...string[]]>(values: Values) {
	return Type.Enum(
		Object.fromEntries(values.map((value) => [value, value])) as {
			[Value in Values[number]]: Value;
		},
	);
}

export const FilterUnitKindValues = [
	"slug_namespace",
	"profile",
	"book",
	"software",
	"media",
	"video",
	"audio",
	"release",
	"entity",
	"label",
	"tag",
	"series",
	"zone",
	"zone_page",
	"custom_theme",
	"collection",
	"post",
	"poll",
	"realm",
	"realm_rule",
] as const;
export type FilterUnitKind = (typeof FilterUnitKindValues)[number];
export const FilterUnitKind = stringEnum(FilterUnitKindValues);

export const FilterPostKindValues = [
	"post",
	"reply",
	"excerpt",
	"review",
	"chapter",
	"page",
	"wiki",
	"picture",
	"governance_note",
] as const;
export type FilterPostKind = (typeof FilterPostKindValues)[number];
export const FilterPostKind = stringEnum(FilterPostKindValues);

const SimpleFeedContentDefinitions = {
	"unit:profile": { group: "unit", kind: "profile" },
	"unit:book": { group: "unit", kind: "book" },
	"unit:software": { group: "unit", kind: "software" },
	"unit:media": { group: "unit", kind: "media" },
	"unit:release": { group: "unit", kind: "release" },
	"unit:entity": { group: "unit", kind: "entity" },
	"unit:tag": { group: "unit", kind: "tag" },
	"unit:series": { group: "unit", kind: "series" },
	"unit:zone": { group: "unit", kind: "zone" },
	"unit:collection": { group: "unit", kind: "collection" },
	"unit:poll": { group: "unit", kind: "poll" },
	"unit:realm": { group: "unit", kind: "realm" },
	"post:post": { group: "post", kind: "post" },
	"post:excerpt": { group: "post", kind: "excerpt" },
	"post:review": { group: "post", kind: "review" },
	"post:chapter": { group: "post", kind: "chapter" },
	"post:wiki": { group: "post", kind: "wiki" },
	"post:picture": { group: "post", kind: "picture" },
} as const satisfies Record<
	string,
	| { readonly group: "unit"; readonly kind: FilterUnitKind }
	| { readonly group: "post"; readonly kind: FilterPostKind }
>;

export const SimpleFeedContentKindValues = [
	"unit:profile",
	"unit:book",
	"unit:software",
	"unit:media",
	"unit:release",
	"unit:entity",
	"unit:tag",
	"unit:series",
	"unit:zone",
	"unit:collection",
	"unit:poll",
	"unit:realm",
	"post:post",
	"post:excerpt",
	"post:review",
	"post:chapter",
	"post:wiki",
	"post:picture",
] as const satisfies readonly (keyof typeof SimpleFeedContentDefinitions)[];
export type SimpleFeedContentKind = (typeof SimpleFeedContentKindValues)[number];
export type SimpleFeedContentGroup =
	(typeof SimpleFeedContentDefinitions)[SimpleFeedContentKind]["group"];

const SimpleFeedContentKinds: ReadonlySet<string> = new Set(SimpleFeedContentKindValues);

export function isSimpleFeedContentKind(value: string): value is SimpleFeedContentKind {
	return SimpleFeedContentKinds.has(value);
}

export function simpleFeedContentKindGroup(value: SimpleFeedContentKind): SimpleFeedContentGroup {
	return SimpleFeedContentDefinitions[value].group;
}

export function normalizeSimpleFeedContentKinds(
	values: readonly SimpleFeedContentKind[],
): SimpleFeedContentKind[] {
	const requested = new Set(values);
	return SimpleFeedContentKindValues.filter((value) => requested.has(value));
}

export const FilterRealmUnitStatusValues = ["pending", "visible", "hidden", "removed"] as const;
export type FilterRealmUnitStatus = (typeof FilterRealmUnitStatusValues)[number];
export const FilterRealmUnitStatus = stringEnum(FilterRealmUnitStatusValues);

export const FilterRealmUnitPublicationStateValues = ["active", "withdrawn"] as const;
export type FilterRealmUnitPublicationState =
	(typeof FilterRealmUnitPublicationStateValues)[number];
export const FilterRealmUnitPublicationState = stringEnum(FilterRealmUnitPublicationStateValues);

export const FilterContentLanguageValues = ["zh", "en", "ja", "ko", "de", "fr", "es"] as const;
export type FilterContentLanguage = (typeof FilterContentLanguageValues)[number];
export const FilterContentLanguage = stringEnum(FilterContentLanguageValues);

export const FilterWorkReleaseStatusValues = [
	"ongoing",
	"hiatus",
	"completed",
	"cancelled",
] as const;
export type FilterWorkReleaseStatus = (typeof FilterWorkReleaseStatusValues)[number];
export const FilterWorkReleaseStatus = stringEnum(FilterWorkReleaseStatusValues);

export const FilterUuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});

function inFilter<Value extends TSchema>(value: Value, maxItems: number) {
	return Type.Object(
		{ in: Type.Array(value, { minItems: 1, maxItems, uniqueItems: true }) },
		{ additionalProperties: false },
	);
}

export const UuidFilter = inFilter(FilterUuid, 50);
export type UuidFilter = Static<typeof UuidFilter>;
export const UnitKindFilter = inFilter(FilterUnitKind, FilterUnitKindValues.length);
export type UnitKindFilter = Static<typeof UnitKindFilter>;
export const PostKindFilter = inFilter(FilterPostKind, FilterPostKindValues.length);
export type PostKindFilter = Static<typeof PostKindFilter>;
export const ContentLanguageFilter = inFilter(
	FilterContentLanguage,
	FilterContentLanguageValues.length,
);
export type ContentLanguageFilter = Static<typeof ContentLanguageFilter>;
export const ContentLanguageSupportTag = Type.String({
	minLength: 1,
	maxLength: MaximumContentLanguageTagLength,
});
export const ContentLanguageSupportChannel = stringEnum(ContentLanguageChannelValues);
export const RealmUnitStatusFilter = inFilter(
	FilterRealmUnitStatus,
	FilterRealmUnitStatusValues.length,
);
export type RealmUnitStatusFilter = Static<typeof RealmUnitStatusFilter>;
export const RealmUnitPublicationStateFilter = inFilter(
	FilterRealmUnitPublicationState,
	FilterRealmUnitPublicationStateValues.length,
);
export type RealmUnitPublicationStateFilter = Static<typeof RealmUnitPublicationStateFilter>;

export const IntegerFilter = Type.Union([
	Type.Object(
		{ in: Type.Array(Type.Integer(), { minItems: 1, maxItems: 50, uniqueItems: true }) },
		{ additionalProperties: false },
	),
	Type.Object(
		{
			range: Type.Union([
				Type.Object(
					{ minimum: Type.Integer(), maximum: Type.Optional(Type.Integer()) },
					{ additionalProperties: false },
				),
				Type.Object(
					{ minimum: Type.Optional(Type.Integer()), maximum: Type.Integer() },
					{ additionalProperties: false },
				),
			]),
		},
		{ additionalProperties: false },
	),
]);
export type IntegerFilter = Static<typeof IntegerFilter>;

export const ScoreValueFilter = Type.Union([
	Type.Object(
		{
			in: Type.Array(Type.Integer({ minimum: 1, maximum: 10 }), {
				minItems: 1,
				maxItems: 10,
				uniqueItems: true,
			}),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			range: Type.Union([
				Type.Object(
					{
						minimum: Type.Integer({ minimum: 1, maximum: 10 }),
						maximum: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
					},
					{ additionalProperties: false },
				),
				Type.Object(
					{
						minimum: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
						maximum: Type.Integer({ minimum: 1, maximum: 10 }),
					},
					{ additionalProperties: false },
				),
			]),
		},
		{ additionalProperties: false },
	),
]);
export type ScoreValueFilter = Static<typeof ScoreValueFilter>;

export const UnitReferenceFilter = Type.Object(
	{
		id: Type.Optional(UuidFilter),
		kind: Type.Optional(UnitKindFilter),
	},
	{ minProperties: 1, additionalProperties: false },
);
export type UnitReferenceFilter = Static<typeof UnitReferenceFilter>;

export const ProfileReferenceFilter = Type.Union([
	Type.Object({ kind: Type.Literal("viewer") }, { additionalProperties: false }),
	Type.Object({ kind: Type.Literal("profile"), id: UuidFilter }, { additionalProperties: false }),
]);
export type ProfileReferenceFilter = Static<typeof ProfileReferenceFilter>;

const logicFields = <ThisSchema extends TSchema>(This: ThisSchema) => ({
	all: Type.Optional(Type.Array(This, { minItems: 1, maxItems: 20 })),
	any: Type.Optional(Type.Array(This, { minItems: 1, maxItems: 20 })),
	not: Type.Optional(This),
});

export const VoteSummaryFilter = Type.Object(
	{
		score: Type.Optional(IntegerFilter),
		voteCount: Type.Optional(IntegerFilter),
	},
	{ minProperties: 1, additionalProperties: false },
);
export type VoteSummaryFilter = Static<typeof VoteSummaryFilter>;

export const TagAuthorityFilter = Type.Union([
	Type.Object(
		{
			kind: Type.Literal("global"),
			view: Type.Union([
				Type.Object(
					{
						kind: Type.Literal("effective"),
						consensus: Type.Optional(VoteSummaryFilter),
					},
					{ additionalProperties: false },
				),
				Type.Object({ kind: Type.Literal("direct") }, { additionalProperties: false }),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("realm"),
			realm: UnitReferenceFilter,
			view: Type.Union([
				Type.Object({ kind: Type.Literal("policy") }, { additionalProperties: false }),
				Type.Object(
					{
						kind: Type.Literal("community"),
						consensus: Type.Optional(VoteSummaryFilter),
					},
					{ additionalProperties: false },
				),
			]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("profile"),
			profile: Type.Object({ kind: Type.Literal("viewer") }, { additionalProperties: false }),
		},
		{ additionalProperties: false },
	),
]);
export type TagAuthorityFilter = Static<typeof TagAuthorityFilter>;

export const LocalizationFilter = Type.Cyclic(
	{
		LocalizationFilter: Type.Object(
			{
				...logicFields(Type.Ref("LocalizationFilter")),
				language: Type.Optional(ContentLanguageFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"LocalizationFilter",
);
export type LocalizationFilter = Static<typeof LocalizationFilter>;

export const ContentLanguageSupportFilter = Type.Object(
	{
		languageTag: ContentLanguageSupportTag,
		channel: Type.Optional(ContentLanguageSupportChannel),
	},
	{ additionalProperties: false },
);
export type ContentLanguageSupportFilter = Static<typeof ContentLanguageSupportFilter>;

export const RealmPlacementFilter = Type.Cyclic(
	{
		RealmPlacementFilter: Type.Object(
			{
				...logicFields(Type.Ref("RealmPlacementFilter")),
				realm: Type.Optional(UnitReferenceFilter),
				status: Type.Optional(RealmUnitStatusFilter),
				publicationState: Type.Optional(RealmUnitPublicationStateFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"RealmPlacementFilter",
);
export type RealmPlacementFilter = Static<typeof RealmPlacementFilter>;

export const TagAssertionFilter = Type.Cyclic(
	{
		TagAssertionFilter: Type.Object(
			{
				...logicFields(Type.Ref("TagAssertionFilter")),
				tag: Type.Optional(UnitReferenceFilter),
				authority: Type.Optional(TagAuthorityFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"TagAssertionFilter",
);
export type TagAssertionFilter = Static<typeof TagAssertionFilter>;

export const RealmTagQueryStrategyValues = [
	"global_effective",
	"realm_community",
	"realm_policy",
] as const;
export type RealmTagQueryStrategy = (typeof RealmTagQueryStrategyValues)[number];

export const ScoreFilter = Type.Cyclic(
	{
		ScoreFilter: Type.Object(
			{
				...logicFields(Type.Ref("ScoreFilter")),
				value: Type.Optional(ScoreValueFilter),
				realm: Type.Optional(UnitReferenceFilter),
				target: Type.Optional(UnitReferenceFilter),
				author: Type.Optional(ProfileReferenceFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"ScoreFilter",
);
export type ScoreFilter = Static<typeof ScoreFilter>;

export const RealmTagContextFilter = Type.Object(
	{
		realm: UnitReferenceFilter,
		tag: Type.Optional(UnitReferenceFilter),
	},
	{ additionalProperties: false },
);
export type RealmTagContextFilter = Static<typeof RealmTagContextFilter>;

export const BookFilter = Type.Cyclic(
	{
		BookFilter: Type.Object(
			{
				...logicFields(Type.Ref("BookFilter")),
				releaseStatus: Type.Optional(inFilter(FilterWorkReleaseStatus, 4)),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"BookFilter",
);
export type BookFilter = Static<typeof BookFilter>;

function toMany<Schema extends TSchema>(schema: Schema) {
	return Type.Union([
		Type.Object({ some: schema }, { additionalProperties: false }),
		Type.Object({ none: schema }, { additionalProperties: false }),
	]);
}

export const PostFilter = Type.Cyclic(
	{
		PostFilter: Type.Object(
			{
				...logicFields(Type.Ref("PostFilter")),
				kind: Type.Optional(PostKindFilter),
				subject: Type.Optional(
					Type.Union([
						Type.Object({ is: UnitReferenceFilter }, { additionalProperties: false }),
						Type.Object({ absent: Type.Literal(true) }, { additionalProperties: false }),
					]),
				),
				scores: Type.Optional(
					Type.Object(
						{ displayed: Type.Optional(toMany(ScoreFilter)) },
						{ minProperties: 1, additionalProperties: false },
					),
				),
				explainsRealmTag: Type.Optional(RealmTagContextFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"PostFilter",
);
export type PostFilter = Static<typeof PostFilter>;

export const CollectionFilter = Type.Cyclic(
	{
		CollectionFilter: Type.Object(
			{
				...logicFields(Type.Ref("CollectionFilter")),
				items: Type.Optional(toMany(UnitReferenceFilter)),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"CollectionFilter",
);
export type CollectionFilter = Static<typeof CollectionFilter>;

export const UnitPredicate = Type.Cyclic(
	{
		UnitPredicate: Type.Object(
			{
				...logicFields(Type.Ref("UnitPredicate")),
				id: Type.Optional(UuidFilter),
				kind: Type.Optional(UnitKindFilter),
				localizations: Type.Optional(toMany(LocalizationFilter)),
				contentLanguageSupport: Type.Optional(toMany(ContentLanguageSupportFilter)),
				realms: Type.Optional(toMany(RealmPlacementFilter)),
				tags: Type.Optional(toMany(TagAssertionFilter)),
				creditAttributions: Type.Optional(toMany(UnitReferenceFilter)),
				subjectAssociations: Type.Optional(toMany(UnitReferenceFilter)),
				publishers: Type.Optional(toMany(ProfileReferenceFilter)),
				scores: Type.Optional(
					Type.Object(
						{ received: Type.Optional(toMany(ScoreFilter)) },
						{ minProperties: 1, additionalProperties: false },
					),
				),
				post: Type.Optional(
					Type.Union([
						Type.Object({ is: PostFilter }, { additionalProperties: false }),
						Type.Object({ absent: Type.Literal(true) }, { additionalProperties: false }),
					]),
				),
				collection: Type.Optional(
					Type.Union([
						Type.Object({ is: CollectionFilter }, { additionalProperties: false }),
						Type.Object({ absent: Type.Literal(true) }, { additionalProperties: false }),
					]),
				),
				book: Type.Optional(
					Type.Union([
						Type.Object({ is: BookFilter }, { additionalProperties: false }),
						Type.Object({ absent: Type.Literal(true) }, { additionalProperties: false }),
					]),
				),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	},
	"UnitPredicate",
);
export type UnitPredicate = Static<typeof UnitPredicate>;

/**
 * Resolve a Realm taxonomy Tag node's stored query strategy to the canonical
 * Unit predicate. Callers do not need to duplicate authority semantics.
 */
export function realmTagQueryPredicate(input: {
	readonly realmId: string;
	readonly tagId: string;
	readonly strategy: RealmTagQueryStrategy;
}): UnitPredicate {
	const tag = { id: { in: [input.tagId] } };
	switch (input.strategy) {
		case "global_effective":
			return {
				tags: {
					some: {
						tag,
						authority: { kind: "global", view: { kind: "effective" } },
					},
				},
			};
		case "realm_community":
			return {
				tags: {
					some: {
						tag,
						authority: {
							kind: "realm",
							realm: { id: { in: [input.realmId] } },
							view: {
								kind: "community",
								consensus: { score: { range: { minimum: 1 } } },
							},
						},
					},
				},
			};
		case "realm_policy":
			return {
				tags: {
					some: {
						tag,
						authority: {
							kind: "realm",
							realm: { id: { in: [input.realmId] } },
							view: { kind: "policy" },
						},
					},
				},
			};
	}
}

/**
 * Named schemas used by API adapters when exposing the Filter AST through a
 * component-based contract. Domain validation continues to use the exact
 * schemas above.
 */
export const UnitPredicateSchemaModels = {
	LocalizationFilter: LocalizationFilter.$defs.LocalizationFilter,
	ContentLanguageSupportFilter,
	RealmPlacementFilter: RealmPlacementFilter.$defs.RealmPlacementFilter,
	TagAssertionFilter: TagAssertionFilter.$defs.TagAssertionFilter,
	ScoreFilter: ScoreFilter.$defs.ScoreFilter,
	PostFilter: PostFilter.$defs.PostFilter,
	RealmTagContextFilter,
	CollectionFilter: CollectionFilter.$defs.CollectionFilter,
	BookFilter: BookFilter.$defs.BookFilter,
	UnitPredicate: UnitPredicate.$defs.UnitPredicate,
} as const;

export interface FilterValidationLimits {
	readonly maxDepth: number;
	readonly maxNodes: number;
}

export const DefaultFilterValidationLimits: FilterValidationLimits = {
	maxDepth: 12,
	maxNodes: 100,
};

function assertRange(value: IntegerFilter | ScoreValueFilter, path: string): void {
	if (
		"range" in value &&
		value.range.minimum !== undefined &&
		value.range.maximum !== undefined &&
		value.range.minimum > value.range.maximum
	)
		throw new TypeError(`${path} minimum exceeds maximum`);
}

function visitUnknownFilter(
	value: unknown,
	path: string,
	depth: number,
	budget: { nodes: number },
	limits: FilterValidationLimits,
): void {
	if (!value || typeof value !== "object") return;
	budget.nodes += 1;
	if (budget.nodes > limits.maxNodes) throw new TypeError("Filter exceeds maximum node count");
	if (depth > limits.maxDepth) throw new TypeError("Filter exceeds maximum depth");
	if (Array.isArray(value)) {
		value.forEach((child, index) =>
			visitUnknownFilter(child, `${path}[${index}]`, depth + 1, budget, limits),
		);
		return;
	}
	const record = value as Record<string, unknown>;
	if ("range" in record) assertRange(record as IntegerFilter | ScoreValueFilter, path);
	if ("languageTag" in record) {
		const canonical = canonicalizeContentLanguageTag(record.languageTag);
		if (record.languageTag !== canonical)
			throw new TypeError(`${path}.languageTag must use canonical BCP 47 casing`);
	}
	for (const [key, child] of Object.entries(record))
		visitUnknownFilter(child, `${path}.${key}`, depth + 1, budget, limits);
}

export function assertUnitPredicate(
	value: unknown,
	limits: FilterValidationLimits = DefaultFilterValidationLimits,
): asserts value is UnitPredicate {
	if (!Check(UnitPredicate, value)) throw new TypeError("Invalid Unit filter");
	visitUnknownFilter(value, "filter", 0, { nodes: 0 }, limits);
}

export function parseUnitPredicate(
	value: unknown,
	limits: FilterValidationLimits = DefaultFilterValidationLimits,
): UnitPredicate {
	assertUnitPredicate(value, limits);
	return value;
}

function uniqueSortedStrings(values: readonly string[]): string[] {
	return [...new Set(values)].sort();
}

function createSimpleFeedContentFilter(
	values: readonly SimpleFeedContentKind[],
): UnitPredicate | undefined {
	const unitKinds: FilterUnitKind[] = [];
	const postKinds: FilterPostKind[] = [];
	for (const contentKind of normalizeSimpleFeedContentKinds(values)) {
		const definition = SimpleFeedContentDefinitions[contentKind];
		if (definition.group === "unit") unitKinds.push(definition.kind);
		else postKinds.push(definition.kind);
	}
	const branches: UnitPredicate[] = [];
	if (unitKinds.length) branches.push({ kind: { in: unitKinds } });
	if (postKinds.length) branches.push({ post: { is: { kind: { in: postKinds } } } });
	if (!branches.length) return undefined;
	return branches.length === 1 ? branches[0] : { any: branches };
}

export function createSimpleFeedFilter(input: {
	readonly contentKinds?: readonly SimpleFeedContentKind[];
	readonly languages?: readonly FilterContentLanguage[];
	readonly realmIds?: readonly string[];
	readonly tagIds?: readonly string[];
}): UnitPredicate | undefined {
	const all: UnitPredicate[] = [];
	const content = createSimpleFeedContentFilter(input.contentKinds ?? []);
	if (content) all.push(content);
	if (input.languages?.length)
		all.push({
			localizations: {
				some: {
					language: {
						in: FilterContentLanguageValues.filter((language) =>
							input.languages?.includes(language),
						),
					},
				},
			},
		});
	if (input.realmIds?.length)
		all.push({
			realms: {
				some: {
					realm: { id: { in: uniqueSortedStrings(input.realmIds) } },
					status: { in: ["visible"] },
					publicationState: { in: ["active"] },
				},
			},
		});
	if (input.tagIds?.length)
		all.push({
			tags: {
				some: {
					tag: { id: { in: uniqueSortedStrings(input.tagIds) } },
					authority: { kind: "global", view: { kind: "effective" } },
				},
			},
		});
	if (!all.length) return undefined;
	return all.length === 1 ? all[0] : { all };
}

export interface SimpleFeedFilterSelection {
	readonly contentKinds: readonly SimpleFeedContentKind[];
	readonly languages: readonly FilterContentLanguage[];
	readonly realmIds: readonly string[];
	readonly tagIds: readonly string[];
}

function intersectLanguageBoundaries(
	boundaries: readonly (readonly FilterContentLanguage[])[],
): FilterContentLanguage[] | undefined {
	const [first, ...rest] = boundaries;
	if (!first) return undefined;
	let intersection: FilterContentLanguage[] = [...first];
	for (const boundary of rest)
		intersection = intersection.filter((language) => boundary.includes(language));
	return intersection;
}

function unionLanguageBoundaries(
	boundaries: readonly (readonly FilterContentLanguage[])[],
): FilterContentLanguage[] | undefined {
	if (!boundaries.length) return undefined;
	return [...new Set(boundaries.flat())];
}

function readLocalizationLanguageBoundary(
	predicate: LocalizationFilter | undefined,
): readonly FilterContentLanguage[] | undefined {
	if (!predicate) return undefined;
	const boundaries: (readonly FilterContentLanguage[])[] = [];
	if (predicate.language?.in.length) boundaries.push(predicate.language.in);
	if (predicate.all) {
		const allBoundary = intersectLanguageBoundaries(
			predicate.all
				.map(readLocalizationLanguageBoundary)
				.filter((boundary): boundary is readonly FilterContentLanguage[] => boundary !== undefined),
		);
		if (allBoundary) boundaries.push(allBoundary);
	}
	if (predicate.any) {
		const anyBoundaries = predicate.any.map(readLocalizationLanguageBoundary);
		if (anyBoundaries.every((boundary) => boundary !== undefined))
			boundaries.push([...new Set(anyBoundaries.flatMap((boundary) => boundary ?? []))]);
	}
	return intersectLanguageBoundaries(boundaries);
}

/**
 * Conservatively derives the positive languages referenced by localization
 * existence requirements in every matching branch of a Unit predicate. Unit
 * conjunctions union independent `some` requirements because different
 * localization rows may satisfy them. An unconstrained `any` branch prevents a
 * safe boundary; negative localization predicates are never treated as one.
 */
export function readUnitLanguageBoundary(
	predicate: UnitPredicate | undefined,
): readonly FilterContentLanguage[] | undefined {
	if (!predicate) return undefined;
	const boundaries: (readonly FilterContentLanguage[])[] = [];
	if (predicate.localizations && "some" in predicate.localizations) {
		const localizationBoundary = readLocalizationLanguageBoundary(predicate.localizations.some);
		if (localizationBoundary) boundaries.push(localizationBoundary);
	}
	if (predicate.all) {
		const allBoundaries = predicate.all
			.map(readUnitLanguageBoundary)
			.filter((boundary): boundary is readonly FilterContentLanguage[] => boundary !== undefined);
		const allBoundary = unionLanguageBoundaries(allBoundaries);
		if (allBoundary) boundaries.push(allBoundary);
	}
	if (predicate.any) {
		const anyBoundaries = predicate.any.map(readUnitLanguageBoundary);
		if (anyBoundaries.every((boundary) => boundary !== undefined))
			boundaries.push([...new Set(anyBoundaries.flatMap((boundary) => boundary ?? []))]);
	}
	return unionLanguageBoundaries(boundaries);
}

type SimpleFeedContentBranch =
	| Readonly<{
			group: "unit";
			contentKinds: readonly SimpleFeedContentKind[];
	  }>
	| Readonly<{
			group: "post";
			contentKinds: readonly SimpleFeedContentKind[];
	  }>;

const SimpleFeedUnitContentKinds = new Map<FilterUnitKind, SimpleFeedContentKind>(
	SimpleFeedContentKindValues.flatMap((contentKind) => {
		const definition = SimpleFeedContentDefinitions[contentKind];
		return definition.group === "unit" ? [[definition.kind, contentKind]] : [];
	}),
);
const SimpleFeedPostContentKinds = new Map<FilterPostKind, SimpleFeedContentKind>(
	SimpleFeedContentKindValues.flatMap((contentKind) => {
		const definition = SimpleFeedContentDefinitions[contentKind];
		return definition.group === "post" ? [[definition.kind, contentKind]] : [];
	}),
);

function readSimpleFeedContentBranch(value: UnitPredicate): SimpleFeedContentBranch | undefined {
	if (value.kind && Object.keys(value).length === 1) {
		const contentKinds = value.kind.in.flatMap((kind) => {
			const contentKind = SimpleFeedUnitContentKinds.get(kind);
			return contentKind ? [contentKind] : [];
		});
		return contentKinds.length === value.kind.in.length
			? { group: "unit", contentKinds }
			: undefined;
	}
	if (
		value.post &&
		Object.keys(value).length === 1 &&
		"is" in value.post &&
		value.post.is.kind &&
		Object.keys(value.post.is).length === 1
	) {
		const contentKinds = value.post.is.kind.in.flatMap((kind) => {
			const contentKind = SimpleFeedPostContentKinds.get(kind);
			return contentKind ? [contentKind] : [];
		});
		return contentKinds.length === value.post.is.kind.in.length
			? { group: "post", contentKinds }
			: undefined;
	}
	return undefined;
}

function readSimpleFeedContentFilter(value: UnitPredicate): SimpleFeedContentKind[] | undefined {
	const direct = readSimpleFeedContentBranch(value);
	if (direct) return [...direct.contentKinds];
	if (!value.any || Object.keys(value).length !== 1 || value.any.length !== 2) return undefined;
	const branches = value.any.map(readSimpleFeedContentBranch);
	const unit = branches.find((branch) => branch?.group === "unit");
	const post = branches.find((branch) => branch?.group === "post");
	if (!unit || !post) return undefined;
	const requested = new Set([...unit.contentKinds, ...post.contentKinds]);
	return SimpleFeedContentKindValues.filter((contentKind) => requested.has(contentKind));
}

/**
 * Reads only a top-level standard Feed content-kind clause while leaving every
 * other predicate authoritative. This is an execution hint for selecting
 * Search indexes, not a lossy projection of the complete Filter.
 */
export function readSimpleFeedContentKinds(
	value: unknown,
): readonly SimpleFeedContentKind[] | undefined {
	assertUnitPredicate(value);
	const collect = (clause: UnitPredicate): SimpleFeedContentKind[][] => {
		const content = readSimpleFeedContentFilter(clause);
		if (content) return [content];
		if (clause.all && Object.keys(clause).length === 1)
			return clause.all.flatMap((child) => collect(child));
		return [];
	};
	const selections = collect(value);
	return selections.length === 1 ? selections[0] : undefined;
}

/**
 * Recognizes only the deliberately small filter shape emitted by the standard
 * Feed UI. Complex Filters remain executable but do not become presentation
 * hints accidentally.
 */
export function readSimpleFeedFilter(value: unknown): SimpleFeedFilterSelection | undefined {
	assertUnitPredicate(value);
	const filter = value;
	const clauses = filter.all ?? [filter];
	if (filter.all && (Object.keys(filter).length !== 1 || !filter.all.length)) return undefined;
	const languages: FilterContentLanguage[] = [];
	const realmIds: string[] = [];
	const tagIds: string[] = [];
	let contentKinds: SimpleFeedContentKind[] = [];
	for (const clause of clauses) {
		const content = readSimpleFeedContentFilter(clause);
		if (content) {
			if (contentKinds.length) return undefined;
			contentKinds = content;
			continue;
		}
		if (
			clause.localizations &&
			Object.keys(clause).length === 1 &&
			"some" in clause.localizations &&
			clause.localizations.some.language &&
			Object.keys(clause.localizations.some).length === 1
		) {
			languages.push(...clause.localizations.some.language.in);
			continue;
		}
		if (
			clause.realms &&
			Object.keys(clause).length === 1 &&
			"some" in clause.realms &&
			clause.realms.some.realm?.id &&
			!clause.realms.some.realm.kind &&
			clause.realms.some.status?.in.length === 1 &&
			clause.realms.some.status.in[0] === "visible" &&
			clause.realms.some.publicationState?.in.length === 1 &&
			clause.realms.some.publicationState.in[0] === "active" &&
			Object.keys(clause.realms.some).length === 3
		) {
			realmIds.push(...clause.realms.some.realm.id.in);
			continue;
		}
		if (
			clause.tags &&
			Object.keys(clause).length === 1 &&
			"some" in clause.tags &&
			clause.tags.some.tag?.id &&
			!clause.tags.some.tag.kind &&
			clause.tags.some.authority?.kind === "global" &&
			clause.tags.some.authority.view.kind === "effective" &&
			!clause.tags.some.authority.view.consensus &&
			Object.keys(clause.tags.some).length === 2
		) {
			tagIds.push(...clause.tags.some.tag.id.in);
			continue;
		}
		return undefined;
	}
	return { contentKinds, languages, realmIds, tagIds };
}

/** Stable JSON for hashing a validated Filter into an opaque cursor identity. */
export function canonicalUnitPredicate(value: unknown): string {
	assertUnitPredicate(value);
	const normalize = (input: unknown): unknown => {
		if (Array.isArray(input))
			return input
				.map(normalize)
				.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
		if (!input || typeof input !== "object") return input;
		return Object.fromEntries(
			Object.entries(input)
				.filter(([, child]) => child !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, normalize(child)]),
		);
	};
	return JSON.stringify(normalize(value));
}

/** Returns every Unit/Profile UUID reference embedded in a validated Filter. */
export function collectUnitPredicateReferenceIds(value: unknown): string[] {
	assertUnitPredicate(value);
	const ids = new Set<string>();
	const visit = (input: unknown): void => {
		if (Array.isArray(input)) {
			input.forEach(visit);
			return;
		}
		if (!input || typeof input !== "object") return;
		const record = input as Record<string, unknown>;
		const id = record.id;
		if (id && typeof id === "object" && "in" in id) {
			const values = (id as { in?: unknown }).in;
			if (Array.isArray(values))
				for (const candidate of values) if (typeof candidate === "string") ids.add(candidate);
		}
		Object.values(record).forEach(visit);
	};
	visit(value);
	return [...ids];
}
