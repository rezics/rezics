import { type Static, type TSchema, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";

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
	"release",
	"entity",
	"label",
	"tag",
	"structure",
	"series",
	"zone",
	"zone_page",
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
	"chapter_group",
	"wiki",
	"picture",
	"governance_note",
] as const;
export type FilterPostKind = (typeof FilterPostKindValues)[number];
export const FilterPostKind = stringEnum(FilterPostKindValues);

export const FilterRealmUnitStatusValues = ["pending", "visible", "hidden", "removed"] as const;
export type FilterRealmUnitStatus = (typeof FilterRealmUnitStatusValues)[number];
export const FilterRealmUnitStatus = stringEnum(FilterRealmUnitStatusValues);

export const FilterContentLanguageValues = ["zh", "en"] as const;
export type FilterContentLanguage = (typeof FilterContentLanguageValues)[number];
export const FilterContentLanguage = stringEnum(FilterContentLanguageValues);

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
export const RealmUnitStatusFilter = inFilter(
	FilterRealmUnitStatus,
	FilterRealmUnitStatusValues.length,
);
export type RealmUnitStatusFilter = Static<typeof RealmUnitStatusFilter>;

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

export const LocalizationFilter = Type.Recursive(
	(This) =>
		Type.Object(
			{
				...logicFields(This),
				language: Type.Optional(ContentLanguageFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	{ $id: "LocalizationFilter" },
);
export type LocalizationFilter = Static<typeof LocalizationFilter>;

export const RealmPlacementFilter = Type.Recursive(
	(This) =>
		Type.Object(
			{
				...logicFields(This),
				realm: Type.Optional(UnitReferenceFilter),
				status: Type.Optional(RealmUnitStatusFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	{ $id: "RealmPlacementFilter" },
);
export type RealmPlacementFilter = Static<typeof RealmPlacementFilter>;

export const TagAssertionFilter = Type.Recursive(
	(This) =>
		Type.Object(
			{
				...logicFields(This),
				tag: Type.Optional(UnitReferenceFilter),
				authority: Type.Optional(TagAuthorityFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	{ $id: "TagAssertionFilter" },
);
export type TagAssertionFilter = Static<typeof TagAssertionFilter>;

export const ScoreFilter = Type.Recursive(
	(This) =>
		Type.Object(
			{
				...logicFields(This),
				value: Type.Optional(ScoreValueFilter),
				context: Type.Optional(UnitReferenceFilter),
				target: Type.Optional(UnitReferenceFilter),
				author: Type.Optional(ProfileReferenceFilter),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	{ $id: "ScoreFilter" },
);
export type ScoreFilter = Static<typeof ScoreFilter>;

function toMany<Schema extends TSchema>(schema: Schema) {
	return Type.Union([
		Type.Object({ some: schema }, { additionalProperties: false }),
		Type.Object({ none: schema }, { additionalProperties: false }),
	]);
}

export const PostFilter = Type.Recursive(
	(This) =>
		Type.Object(
			{
				...logicFields(This),
				kind: Type.Optional(PostKindFilter),
				subject: Type.Optional(
					Type.Union([
						Type.Object({ is: UnitReferenceFilter }, { additionalProperties: false }),
						Type.Object(
							{ absent: Type.Literal(true) },
							{ additionalProperties: false },
						),
					]),
				),
				scores: Type.Optional(
					Type.Object(
						{ displayed: Type.Optional(toMany(ScoreFilter)) },
						{ minProperties: 1, additionalProperties: false },
					),
				),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	{ $id: "PostFilter" },
);
export type PostFilter = Static<typeof PostFilter>;

export const UnitFilter = Type.Recursive(
	(This) =>
		Type.Object(
			{
				...logicFields(This),
				id: Type.Optional(UuidFilter),
				kind: Type.Optional(UnitKindFilter),
				localizations: Type.Optional(toMany(LocalizationFilter)),
				realms: Type.Optional(toMany(RealmPlacementFilter)),
				tags: Type.Optional(toMany(TagAssertionFilter)),
				scores: Type.Optional(
					Type.Object(
						{ received: Type.Optional(toMany(ScoreFilter)) },
						{ minProperties: 1, additionalProperties: false },
					),
				),
				post: Type.Optional(
					Type.Union([
						Type.Object({ is: PostFilter }, { additionalProperties: false }),
						Type.Object(
							{ absent: Type.Literal(true) },
							{ additionalProperties: false },
						),
					]),
				),
			},
			{ minProperties: 1, additionalProperties: false },
		),
	{ $id: "UnitFilter" },
);
export type UnitFilter = Static<typeof UnitFilter>;

/**
 * Named schemas used by API adapters when exposing the Filter AST through a
 * component-based contract. Domain validation continues to use the exact
 * schemas above.
 */
export const FilterSchemaModels = {
	LocalizationFilter,
	RealmPlacementFilter,
	TagAssertionFilter,
	ScoreFilter,
	PostFilter,
	UnitFilter,
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
	for (const [key, child] of Object.entries(record))
		visitUnknownFilter(child, `${path}.${key}`, depth + 1, budget, limits);
}

export function assertUnitFilter(
	value: unknown,
	limits: FilterValidationLimits = DefaultFilterValidationLimits,
): asserts value is UnitFilter {
	if (!Check(UnitFilter, value)) throw new TypeError("Invalid Unit filter");
	visitUnknownFilter(value, "filter", 0, { nodes: 0 }, limits);
}

export function parseUnitFilter(
	value: unknown,
	limits: FilterValidationLimits = DefaultFilterValidationLimits,
): UnitFilter {
	assertUnitFilter(value, limits);
	return value;
}

export function createSimpleFeedFilter(input: {
	readonly languages?: readonly FilterContentLanguage[];
	readonly realmIds?: readonly string[];
	readonly tagIds?: readonly string[];
}): UnitFilter | undefined {
	const all: UnitFilter[] = [];
	if (input.languages?.length)
		all.push({
			localizations: { some: { language: { in: [...input.languages] } } },
		});
	if (input.realmIds?.length)
		all.push({
			realms: {
				some: {
					realm: { id: { in: [...input.realmIds] } },
					status: { in: ["visible"] },
				},
			},
		});
	if (input.tagIds?.length)
		all.push({
			tags: {
				some: {
					tag: { id: { in: [...input.tagIds] } },
					authority: { kind: "global", view: { kind: "effective" } },
				},
			},
		});
	if (!all.length) return undefined;
	return all.length === 1 ? all[0] : { all };
}

export interface SimpleFeedFilterSelection {
	readonly languages: readonly FilterContentLanguage[];
	readonly realmIds: readonly string[];
	readonly tagIds: readonly string[];
}

/**
 * Recognizes only the deliberately small filter shape emitted by the standard
 * Feed UI. Complex Filters remain executable but do not become presentation
 * hints accidentally.
 */
export function readSimpleFeedFilter(value: unknown): SimpleFeedFilterSelection | undefined {
	assertUnitFilter(value);
	const filter = value;
	const clauses = filter.all ?? [filter];
	if (filter.all && (Object.keys(filter).length !== 1 || !filter.all.length)) return undefined;
	const languages: FilterContentLanguage[] = [];
	const realmIds: string[] = [];
	const tagIds: string[] = [];
	for (const clause of clauses) {
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
			Object.keys(clause.realms.some).length === 2
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
	return { languages, realmIds, tagIds };
}

/** Stable JSON for hashing a validated Filter into an opaque cursor identity. */
export function canonicalUnitFilter(value: unknown): string {
	assertUnitFilter(value);
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
export function collectUnitFilterReferenceIds(value: unknown): string[] {
	assertUnitFilter(value);
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
				for (const candidate of values)
					if (typeof candidate === "string") ids.add(candidate);
		}
		Object.values(record).forEach(visit);
	};
	visit(value);
	return [...ids];
}
