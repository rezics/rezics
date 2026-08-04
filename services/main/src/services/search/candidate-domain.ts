import type {
	CollectionFilter,
	PostFilter,
	UnitPredicate,
	UnitReferenceFilter,
} from "@rezics/filter";

import { CandidateFilterClause } from "./candidate-filter";

type CandidatePredicate =
	| Readonly<{ kind: "all"; exact: boolean }>
	| Readonly<{ kind: "none"; exact: boolean }>
	| Readonly<{ kind: "clause"; value: string; exact: boolean }>;

const MatchAll: CandidatePredicate = { kind: "all", exact: true };
const MatchNone: CandidatePredicate = { kind: "none", exact: true };

function clause(value: string, exact = true): CandidatePredicate {
	return { kind: "clause", value, exact };
}

function valuesClause(path: string, values: readonly string[]): CandidatePredicate {
	return clause(`${path} IN [${values.map((value) => JSON.stringify(value)).join(", ")}]`);
}

function all(predicates: readonly CandidatePredicate[]): CandidatePredicate {
	if (predicates.some((predicate) => predicate.kind === "none")) return MatchNone;
	const clauses = predicates.filter(
		(predicate): predicate is Extract<CandidatePredicate, { kind: "clause" }> =>
			predicate.kind === "clause",
	);
	const exact = predicates.every((predicate) => predicate.exact);
	if (!clauses.length) return { kind: "all", exact };
	if (clauses.length === 1) return { ...clauses[0]!, exact };
	return { kind: "clause", value: `(${clauses.map(({ value }) => value).join(" AND ")})`, exact };
}

function any(predicates: readonly CandidatePredicate[]): CandidatePredicate {
	if (predicates.some((predicate) => predicate.kind === "all"))
		return {
			kind: "all",
			exact: predicates.every((predicate) => predicate.kind === "all" && predicate.exact),
		};
	const clauses = predicates.filter(
		(predicate): predicate is Extract<CandidatePredicate, { kind: "clause" }> =>
			predicate.kind === "clause",
	);
	if (!clauses.length) return MatchNone;
	const exact = predicates.every((predicate) => predicate.exact);
	if (clauses.length === 1) return { ...clauses[0]!, exact };
	return { kind: "clause", value: `(${clauses.map(({ value }) => value).join(" OR ")})`, exact };
}

function not(predicate: CandidatePredicate): CandidatePredicate {
	if (!predicate.exact) return { kind: "all", exact: false };
	if (predicate.kind === "all") return MatchNone;
	if (predicate.kind === "none") return MatchAll;
	return clause(`NOT (${predicate.value})`);
}

function logicPredicates<Filter extends { all?: Filter[]; any?: Filter[]; not?: Filter }>(
	filter: Filter,
	compile: (child: Filter) => CandidatePredicate,
): CandidatePredicate[] {
	return [
		...(filter.all ? [all(filter.all.map(compile))] : []),
		...(filter.any ? [any(filter.any.map(compile))] : []),
		...(filter.not ? [not(compile(filter.not))] : []),
	];
}

function unitReference(
	filter: UnitReferenceFilter,
	paths: Readonly<{ id: string; kind: string }>,
): CandidatePredicate {
	return all([
		...(filter.id ? [valuesClause(paths.id, filter.id.in)] : []),
		...(filter.kind ? [valuesClause(paths.kind, filter.kind.in)] : []),
	]);
}

function postPredicate(filter: PostFilter): CandidatePredicate {
	const predicates = logicPredicates(filter, postPredicate);
	if (filter.kind) predicates.push(valuesClause("filters.postKind", filter.kind.in));
	if (filter.subject) {
		if ("absent" in filter.subject) predicates.push(clause("filters.subjectId NOT EXISTS"));
		else
			predicates.push(
				unitReference(filter.subject.is, {
					id: "filters.subjectId",
					kind: "filters.subjectUnitKind",
				}),
			);
	}
	if (filter.scores || filter.explainsRealmTag) predicates.push({ kind: "all", exact: false });
	return all(predicates);
}

function collectionItemPredicate(
	relation: NonNullable<CollectionFilter["items"]>,
): CandidatePredicate {
	const some = "some" in relation;
	const reference = some ? relation.some : relation.none;
	if (!reference.kind) return { kind: "all", exact: false };
	const kind = valuesClause("filters.collectionItemUnitKinds", reference.kind.in);
	if (some) return reference.id ? { ...kind, exact: false } : kind;
	if (reference.id) return { kind: "all", exact: false };
	return not(kind);
}

function collectionPredicate(filter: CollectionFilter): CandidatePredicate {
	const predicates = logicPredicates(filter, collectionPredicate);
	if (filter.items) predicates.push(collectionItemPredicate(filter.items));
	return all(predicates);
}

function unitPredicate(filter: UnitPredicate): CandidatePredicate {
	const predicates = logicPredicates(filter, unitPredicate);
	if (filter.id) predicates.push(valuesClause("id", filter.id.in));
	if (filter.kind) predicates.push(valuesClause("unitType", filter.kind.in));
	if (filter.post)
		predicates.push(
			"absent" in filter.post
				? clause("filters.postExists = false")
				: all([clause("filters.postExists = true"), postPredicate(filter.post.is)]),
		);
	if (filter.collection)
		predicates.push(
			"absent" in filter.collection
				? clause("filters.collectionExists = false")
				: all([
						clause("filters.collectionExists = true"),
						collectionPredicate(filter.collection.is),
					]),
		);
	if (filter.localizations || filter.realms || filter.tags || filter.publishers || filter.scores)
		predicates.push({ kind: "all", exact: false });
	return all(predicates);
}

/**
 * Compiles only necessary Unit-predicate conditions. The emitted clause may be
 * broader than PostgreSQL's authoritative predicate, but can never be narrower.
 */
export function compileCandidateDomainFilter(
	filter: UnitPredicate | undefined,
): CandidateFilterClause | undefined {
	if (!filter) return undefined;
	const predicate = unitPredicate(filter);
	if (predicate.kind === "all") return undefined;
	return CandidateFilterClause.fromDomainSuperset(
		predicate.kind === "none" ? "NOT (id EXISTS)" : predicate.value,
	);
}
