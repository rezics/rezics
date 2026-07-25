import type {
	IntegerFilter,
	LocalizationFilter,
	PostFilter,
	RealmPlacementFilter,
	TagAssertionFilter,
	UnitFilter,
	UnitReferenceFilter,
	VoteSummaryFilter,
} from "@rezics/filter";
import type { SearchExpression, SearchFilter } from "@rezics/search";

function all(expressions: readonly (SearchExpression | undefined)[]): SearchExpression | undefined {
	const clauses = expressions.filter(
		(expression): expression is SearchExpression => expression !== undefined,
	);
	if (!clauses.length) return undefined;
	return clauses.length === 1 ? clauses[0] : { operator: "all", clauses };
}

function any(expressions: readonly (SearchExpression | undefined)[]): SearchExpression | undefined {
	const clauses = expressions.filter(
		(expression): expression is SearchExpression => expression !== undefined,
	);
	if (!clauses.length) return undefined;
	return clauses.length === 1 ? clauses[0] : { operator: "any", clauses };
}

function negate(expression: SearchExpression | undefined): SearchExpression | undefined {
	return expression ? { operator: "not", clause: expression } : undefined;
}

function logic<T extends { all?: T[]; any?: T[]; not?: T }>(
	filter: T,
	compile: (child: T) => SearchExpression | undefined,
): (SearchExpression | undefined)[] {
	return [
		filter.all ? all(filter.all.map(compile)) : undefined,
		filter.any ? any(filter.any.map(compile)) : undefined,
		filter.not ? negate(compile(filter.not)) : undefined,
	];
}

function scalarAnyOf(field: SearchFilter["field"], values: readonly string[]): SearchFilter {
	if (field === "realm-tag-vote") throw new TypeError("Invalid scalar Search field");
	return { field, operator: "any-of", values: [...values] };
}

function requireIds(reference: UnitReferenceFilter, path: string): readonly string[] {
	if (reference.kind)
		throw new TypeError(`${path}.kind is not supported by the Search index adapter`);
	if (!reference.id) throw new TypeError(`${path}.id is required by the Search index adapter`);
	return reference.id.in;
}

function compileLocalization(filter: LocalizationFilter): SearchExpression | undefined {
	return all([
		...logic(filter, compileLocalization),
		filter.language ? scalarAnyOf("language", filter.language.in) : undefined,
	]);
}

function compileRealmPlacement(filter: RealmPlacementFilter): SearchExpression | undefined {
	if (filter.status && filter.status.in.some((status) => status !== "visible"))
		throw new TypeError("Search can index only visible Realm placements");
	return all([
		...logic(filter, compileRealmPlacement),
		filter.realm
			? scalarAnyOf("realm", requireIds(filter.realm, "filter.realms.realm"))
			: undefined,
	]);
}

function numericRange(
	filter: IntegerFilter,
): { lower: number; upper?: number } | { lower?: number; upper: number } {
	if ("in" in filter)
		throw new TypeError("Search vote summaries accept ranges, not discrete values");
	if (filter.range.minimum === undefined && filter.range.maximum === undefined)
		throw new TypeError("Search range requires a bound");
	return filter.range.minimum === undefined
		? { upper: filter.range.maximum! }
		: {
				lower: filter.range.minimum,
				...(filter.range.maximum === undefined ? {} : { upper: filter.range.maximum }),
			};
}

function voteSummary(filter: VoteSummaryFilter) {
	return {
		...(filter.score ? { score: numericRange(filter.score) } : {}),
		...(filter.voteCount ? { voteCount: numericRange(filter.voteCount) } : {}),
	};
}

function compileTag(filter: TagAssertionFilter): SearchExpression | undefined {
	const tagIds = filter.tag ? requireIds(filter.tag, "filter.tags.tag") : undefined;
	let assertion: SearchExpression | undefined;
	if (filter.authority?.kind === "realm") {
		const authority = filter.authority;
		if (authority.view.kind !== "community")
			throw new TypeError("Realm policy Tags are not indexed by Search");
		if (!tagIds || tagIds.length !== 1)
			throw new TypeError("Realm community Tag Search requires exactly one Tag id");
		const realmIds = requireIds(authority.realm, "filter.tags.authority.realm");
		const consensus = authority.view.consensus;
		assertion = any(
			realmIds.map((realmId) => ({
				field: "realm-tag-vote",
				operator: "matches",
				realmId,
				tagId: tagIds[0]!,
				...(consensus ? voteSummary(consensus) : {}),
			})),
		);
	} else {
		if (
			filter.authority &&
			(filter.authority.kind !== "global" || filter.authority.view.kind !== "effective")
		)
			throw new TypeError("This Tag authority is not indexed by Search");
		if (
			filter.authority?.kind === "global" &&
			filter.authority.view.kind === "effective" &&
			filter.authority.view.consensus
		)
			throw new TypeError("Global Tag consensus is not indexed by Search");
		if (!tagIds) throw new TypeError("Search Tag filters require Tag ids");
		assertion = scalarAnyOf("tag", tagIds);
	}
	return all([...logic(filter, compileTag), assertion]);
}

function compilePost(filter: PostFilter): SearchExpression | undefined {
	if (filter.scores) throw new TypeError("Displayed Score predicates are not indexed by Search");
	const subject =
		filter.subject && "is" in filter.subject
			? scalarAnyOf("subject", requireIds(filter.subject.is, "filter.post.subject"))
			: filter.subject
				? ({ field: "subject", operator: "exists", value: false } satisfies SearchFilter)
				: undefined;
	return all([
		...logic(filter, compilePost),
		filter.kind ? scalarAnyOf("kind", filter.kind.in) : undefined,
		subject,
	]);
}

/**
 * Adapts the domain Filter subset represented by the current Search index.
 * Unsupported predicates fail closed instead of silently broadening results.
 */
export function compileUnitFilterSearch(filter: UnitFilter): SearchExpression {
	if (filter.id) throw new TypeError("Unit id predicates are not indexed by Search");
	if (filter.scores) throw new TypeError("Score predicates are not indexed by Search");
	const expression = all([
		...logic(filter, compileUnitFilterSearch),
		filter.kind ? scalarAnyOf("kind", filter.kind.in) : undefined,
		filter.localizations
			? "some" in filter.localizations
				? compileLocalization(filter.localizations.some)
				: negate(compileLocalization(filter.localizations.none))
			: undefined,
		filter.realms
			? "some" in filter.realms
				? compileRealmPlacement(filter.realms.some)
				: negate(compileRealmPlacement(filter.realms.none))
			: undefined,
		filter.tags
			? "some" in filter.tags
				? compileTag(filter.tags.some)
				: negate(compileTag(filter.tags.none))
			: undefined,
		filter.post
			? "is" in filter.post
				? compilePost(filter.post.is)
				: ({
						field: "category",
						operator: "none-of",
						values: ["posts"],
					} satisfies SearchFilter)
			: undefined,
	]);
	if (!expression) throw new TypeError("Filter has no searchable predicate");
	return expression;
}
