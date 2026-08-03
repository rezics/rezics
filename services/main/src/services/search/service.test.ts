import { type SQL } from "drizzle-orm";
import { PgDialect, type SelectedFields } from "drizzle-orm/pg-core";
import { SearchFieldValues } from "@rezics/filter";
import type {
	SearchCategory,
	SearchControlPredicate,
	SearchField,
	SearchOperator,
	SearchScalar,
} from "@rezics/filter";
import {
	parseSearchCursor,
	parseSearchExpression,
	specializeSearchExpressionForCategory,
} from "./query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const select = vi.hoisted(() => vi.fn());
const searchCandidates = vi.hoisted(() => vi.fn());

vi.mock("../database", async () => {
	const { QueryBuilder } = await import("drizzle-orm/pg-core");
	select.mockImplementation((fields: SelectedFields | undefined) => {
		if (fields && Object.keys(fields).length === 1 && "unitId" in fields)
			return new QueryBuilder().select(fields);
		const rows = Promise.resolve([]);
		const query = {
			from: () => query,
			innerJoin: () => query,
			where: () => query,
			then: rows.then.bind(rows),
		};
		return query;
	});
	return { database: { execute, select } };
});
vi.mock("./generation", () => ({
	getActiveSearchGeneration: vi.fn().mockResolvedValue({
		id: "019f7eed-5d42-7102-8387-cc1d13b176d2",
		kind: "current",
		indexUid: "rezics_units_v1_20260801",
		projectionVersion: 1,
		settingsFingerprint: "a".repeat(64),
	}),
}));
vi.mock("./meilisearch", () => ({ searchCandidates }));

import { InvalidSearch } from "./errors";
import { CurrentSearchFieldRegistry, type SearchFieldDefinition } from "./field-registry";
import { SearchCategories } from "./schema";
import {
	compilePostgresSearchExpression,
	searchDomain,
	searchDomainFacets,
	searchDomainIdentifiers,
} from "./service";
import { compileSearchFeatureInput, createDefaultSearchDocument } from "./templates";

const dialect = new PgDialect();

function lastQuery() {
	const statement = execute.mock.calls.at(-1)?.[0] as SQL | undefined;
	if (!statement) throw new Error("Search did not execute a query");
	return dialect.sqlToQuery(statement).sql;
}

function representativeValue(
	category: SearchCategory,
	definition: SearchFieldDefinition,
): SearchScalar {
	switch (definition.scalar) {
		case "boolean":
			return true;
		case "date":
			return "2026-01-01T00:00:00.000Z";
		case "integer":
			return 1;
		case "uuid":
			return "019b0000-0000-7000-8000-000000000001";
		case "string":
			return category;
		case "realm-tag-vote":
			throw new TypeError("Realm Tag vote has no scalar value");
	}
}

function representativeFilter(
	category: SearchCategory,
	field: SearchField,
	definition: SearchFieldDefinition,
	operator: SearchOperator,
): SearchControlPredicate {
	if (field === "realm-tag-vote")
		return {
			field,
			operator: "matches",
			realmId: "019b0000-0000-7000-8000-000000000001",
			tagId: "019b0000-0000-7000-8000-000000000002",
		};
	const value = representativeValue(category, definition);
	let candidate: unknown;
	switch (operator) {
		case "equals":
		case "not-equals":
			candidate = { field, operator, value };
			break;
		case "any-of":
		case "all-of":
		case "none-of":
			candidate = { field, operator, values: [value] };
			break;
		case "range":
			candidate = { field, operator, lower: value };
			break;
		case "exists":
			candidate = { field, operator, value: true };
			break;
		case "matches":
			throw new TypeError(`${field} cannot use the matches operator`);
	}
	const parsed = parseSearchExpression(candidate);
	if (!("field" in parsed)) throw new TypeError("Representative predicate did not parse");
	return parsed;
}

describe("domain search SQL", () => {
	beforeEach(() => {
		execute.mockReset();
		execute.mockResolvedValue({ rows: [] });
		select.mockClear();
		searchCandidates.mockReset();
		searchCandidates.mockResolvedValue([
			{
				hits: [
					{
						id: "019f7eed-5d42-7102-8387-cc1d13b176d2",
						revision: 1,
						category: "units",
						unitType: "book",
					},
				],
				estimatedTotalHits: 1,
				processingTimeMs: 1,
			},
		]);
	});

	it("builds every public category from the current Drizzle schema", async () => {
		for (const category of SearchCategories) await searchDomain(category, {});

		expect(execute).toHaveBeenCalledTimes(SearchCategories.length);
		const queries = execute.mock.calls
			.map(([statement]) => dialect.sqlToQuery(statement as SQL).sql)
			.join("\n");
		expect(queries).toContain('"unit_localization"');
		expect(queries).toContain('from "unit_structure_member"');
		expect(queries).not.toContain('from "search_structure_member"');
		expect(queries).toContain('LEFT JOIN "unit" AS "subject_unit"');
		expect(queries).toContain('LEFT JOIN "post_reply"');
		expect(queries).toMatch(/'provider', \$\d+::text/);
		expect(queries).not.toContain("jsonb_strip_nulls");
		expect(queries).toContain("'cover'");
	});

	it("threads localization priority into Search result presentation", async () => {
		await searchDomain("units", { localizationLanguages: ["zh", "en"] });

		const statement = execute.mock.calls.at(-1)?.[0] as SQL | undefined;
		if (!statement) throw new Error("Search did not execute a query");
		const query = dialect.sqlToQuery(statement);
		const firstChinese = query.params.indexOf("zh");
		const firstEnglish = query.params.indexOf("en");
		expect(firstChinese).toBeGreaterThanOrEqual(0);
		expect(firstEnglish).toBeGreaterThan(firstChinese);
		expect(query.sql).toContain("'language'");
		expect(query.sql).toContain("'title'");
		expect(query.sql).toContain("'summary'");
	});

	it("returns authoritative identifiers without building Search presentation JSON", async () => {
		const id = "019f7eed-5d42-7102-8387-cc1d13b176d2";
		execute.mockResolvedValueOnce({ rows: [{ id, ordinality: "1" }] });

		const result = await searchDomainIdentifiers("units", { limit: 5 });

		expect(result.hits).toEqual([{ id }]);
		const query = lastQuery();
		expect(query).toContain('SELECT "unit"."id"::text AS id');
		expect(query).not.toContain("jsonb_build_object");
		expect(select).not.toHaveBeenCalled();
	});

	it("keeps timed media in the Units category authorization query", async () => {
		await searchDomain("units", {});

		const statement = execute.mock.calls.at(-1)?.[0] as SQL | undefined;
		if (!statement) throw new Error("Search did not execute a query");
		expect(dialect.sqlToQuery(statement).params).toEqual(
			expect.arrayContaining(["video", "audio"]),
		);
	});

	it("compiles every registry-declared field capability into PostgreSQL", () => {
		for (const field of SearchFieldValues) {
			const definition = CurrentSearchFieldRegistry[field];
			for (const category of definition.categories)
				for (const operator of definition.operators) {
					const filter = representativeFilter(category, field, definition, operator);
					expect(() =>
						dialect.sqlToQuery(compilePostgresSearchExpression(category, filter)),
					).not.toThrow();
				}
		}
	});

	it("resolves Profile credits directly and through exactly one credited Entity", () => {
		const query = dialect.sqlToQuery(
			compilePostgresSearchExpression("units", {
				field: "credited-profile",
				operator: "equals",
				value: "019b0000-0000-7000-8000-000000000001",
			}),
		).sql;

		expect(query).toContain("direct_credit.credited_unit_id as profile_id");
		expect(query).not.toContain("direct_credit.role");
		expect(query).toContain("credited_entity.id = source_credit.credited_unit_id");
		expect(query).toContain("entity_profile.source_unit_id = credited_entity.id");
		expect(query).toContain("entity_profile.role = 'publisher'");
		expect(query).not.toContain("source_credit.role");
	});

	it("binds Realm Tag context aliases to their physical tables", () => {
		const query = dialect.sqlToQuery(
			compilePostgresSearchExpression(
				"tags",
				{
					field: "realm-tag-context",
					operator: "equals",
					value: "019b0000-0000-7000-8000-000000000001",
				},
				"019b0000-0000-7000-8000-000000000002",
			),
		).sql;

		expect(query).toContain('inner join "realm" as "scoped_realm_tag_context_realm"');
		expect(query).toContain('inner join "realm_unit" as "scoped_realm_tag_context_realm_unit"');
		expect(query).toContain('inner join "unit" as "scoped_realm_tag_context_post_unit"');
		expect(query).not.toContain('inner join "scoped_realm_tag_context_realm"');
		expect(query).not.toContain('inner join "scoped_realm_tag_context_realm_unit"');
		expect(query).not.toContain('inner join "scoped_realm_tag_context_post_unit"');
	});

	it("executes every category branch reachable from a Profile Search context", async () => {
		const compiled = compileSearchFeatureInput(
			{
				document: createDefaultSearchDocument("global"),
				contexts: [
					{
						kind: "profile",
						profileId: "019b0000-0000-7000-8000-000000000004",
					},
				],
				injections: [],
				state: {},
			},
			{ sortProfile: "feed", pageBudget: "shared" },
		);
		const expression = compiled.request.searchExpression;
		if (!expression) throw new TypeError("Profile Search context omitted its expression");
		const executed: SearchCategory[] = [];
		for (const category of compiled.request.categories) {
			const specialized = specializeSearchExpressionForCategory(category, expression);
			if (specialized.state !== "expression") continue;
			await expect(
				searchDomain(category, { searchExpression: specialized.expression }),
			).resolves.toBeDefined();
			executed.push(category);
		}
		expect(executed).toEqual([
			"units",
			"users",
			"entities",
			"tags",
			"posts",
			"realms",
			"collections",
			"reviews",
			"polls",
		]);
	});

	it("maps current filters and sorts to their owning tables", async () => {
		await searchDomain("units", {
			query: "ocean",
			Languages: ["zh"],
			kinds: ["book"],
			contentRatings: ["general"],
			aiDisclosures: ["none"],
			licenses: ["cc-by-4.0"],
			sort: "publishedAt:desc",
		});
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ sort: "publishedAt:desc" }),
		]);

		await searchDomain("users", { sort: "followerCount:desc" });
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ sort: "followerCount:desc" }),
		]);

		await searchDomain("entities", { kinds: ["person"] });
		expect(lastQuery()).toContain('("entity"."kind")::text');

		await searchDomain("entities", {
			ownerId: "11111111-1111-1111-8111-111111111111",
		});
		expect(lastQuery()).toContain('"unit_ownership"."revoked_at" is null');
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({
				category: "entities",
				expression: {
					field: "owner",
					operator: "equals",
					value: "11111111-1111-1111-8111-111111111111",
				},
			}),
		]);

		await searchDomain("posts", {
			creditedUnitId: "11111111-1111-1111-8111-111111111111",
			realmId: "22222222-2222-2222-8222-222222222222",
			kinds: ["reply"],
			subjectId: "33333333-3333-3333-8333-333333333333",
			rootId: "44444444-4444-4444-8444-444444444444",
			parentId: "55555555-5555-5555-8555-555555555555",
			sort: "replyCount:asc",
		});
		const postsQuery = lastQuery();
		expect(postsQuery).toContain('"credit_attribution"');
		expect(postsQuery).toContain('"post"."kind" <> \'review\'::post_kind');
		expect(postsQuery).toContain('("post"."kind")::text = any');
		expect(postsQuery).not.toContain('("unit"."kind")::text = any');
		expect(postsQuery).toContain('from "realm_unit"');
		expect(postsQuery).toContain('"post_reply"."root_post_id"');
		expect(postsQuery).toContain('"post_reply"."parent_post_id"');
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ sort: "replyCount:asc" }),
		]);

		await searchDomain("realms", {
			joinPolicies: ["approval"],
			sort: "followerCount:asc",
		});
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ sort: "followerCount:asc" }),
		]);

		await searchDomain("collections", {
			ownerId: "11111111-1111-1111-8111-111111111111",
		});
		expect(lastQuery()).toContain('"unit_ownership"."revoked_at" is null');

		await searchDomain("reviews", {
			targetId: "11111111-1111-1111-8111-111111111111",
			kinds: ["book"],
		});
		expect(lastQuery()).toContain('("subject_unit"."kind")::text');

		await searchDomain("polls", {
			multiple: true,
			resultsVisibilities: ["after_close"],
			closed: false,
			sort: "closesAt:asc",
		});
		const pollsQuery = lastQuery();
		expect(pollsQuery).toContain('"poll"."mode" =');
		expect(pollsQuery).toContain('"poll"."closed_at" is null');
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ sort: "closesAt:asc" }),
		]);
	});

	it("rejects category-specific combinations before executing SQL", async () => {
		await expect(searchDomain("units", { sort: "followerCount:desc" })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		await expect(searchDomain("units", { sort: "relevance" })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		await expect(searchDomain("tags", { multiple: true })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		await expect(searchDomain("posts", { contentLicenseActive: true })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		await expect(searchDomain("posts", { joinPolicies: ["open"] })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		expect(execute).not.toHaveBeenCalled();
	});

	it("keeps type applicability and correlated requirements authoritative in PostgreSQL", async () => {
		await searchDomain("units", { contentLicenseActive: true });
		expect(lastQuery()).toContain('from "unit_content_license"');
		expect(lastQuery()).not.toContain('"unit_content_license"."revoked_at"');

		await searchDomain("units", { contentLicenseActive: false });
		expect(lastQuery()).toMatch(/exists \(select .* from "unit_content_license".*\) = \$/s);

		await searchDomain("units", {
			searchExpression: {
				operator: "all",
				clauses: [
					{ field: "book-page-count", operator: "range", lower: 200 },
					{
						field: "book-publication-date",
						operator: "range",
						lower: "2020-01-01T00:00:00.000Z",
					},
				],
			},
		});
		const bookQuery = lastQuery();
		expect(bookQuery).toContain('"unit"."kind"::text =');
		expect(bookQuery).toContain('"book"."page_count"');
		expect(bookQuery).toContain('"book"."publication_date"');

		await searchDomain("units", {
			searchExpression: {
				operator: "all",
				clauses: [
					{
						field: "software-platform",
						operator: "equals",
						value: "11111111-1111-1111-8111-111111111111",
					},
					{
						field: "software-requirement-tier",
						operator: "equals",
						value: "recommended",
					},
				],
			},
		});
		const softwareQuery = lastQuery();
		expect(softwareQuery).toContain('from "software_requirement"');
		expect(softwareQuery).toContain('"software_requirement"."software_id" = "unit"."id"');
	});

	it("keeps relational domain filters authoritative in PostgreSQL", async () => {
		await searchDomain("collections", {
			domainFilter: {
				collection: {
					is: { items: { some: { kind: { in: ["book"] } } } },
				},
			},
		});

		const query = lastQuery();
		expect(query).toContain("from collection_item filter_collection_item");
		expect(query).toContain("filter_collection_item_unit.kind");
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ expression: undefined }),
		]);
	});

	it("keeps Realm membership and Realm Tag voting predicates independent", async () => {
		await searchDomain("units", {
			searchExpression: {
				operator: "all",
				clauses: [
					{
						field: "realm",
						operator: "all-of",
						values: [
							"019b0000-0000-7000-8000-000000000001",
							"019b0000-0000-7000-8000-000000000002",
						],
					},
					{
						field: "realm-tag-vote",
						operator: "matches",
						realmId: "019b0000-0000-7000-8000-000000000003",
						tagId: "019b0000-0000-7000-8000-000000000004",
						score: { lower: 1 },
						voteCount: { upper: 20 },
					},
				],
			},
		});

		const query = lastQuery();
		expect(query).toContain('from "realm_unit"');
		expect(query).toContain("@> ARRAY[");
		expect(query).toContain('from "realm_tag_vote_stat"');
		expect(query).toContain('"realm_tag_vote_stat"."score" >=');
		expect(query).toContain('"realm_tag_vote_stat"."vote_count" <=');
	});

	it("hides Variants from browse discovery but annotates exact Unit results", async () => {
		await searchDomain("units", {});
		expect(lastQuery()).toContain('select 1 from "unit_variant"');

		await searchDomain("units", { query: "special edition" });
		const exactQuery = lastQuery();
		expect(exactQuery).toContain("'variantRole'");
		expect(exactQuery).toContain("'variantMain'");
		expect(exactQuery).toContain('"unit_variant"."variant_unit_id" = "unit"."id"');
	});

	it("stops after proving a next page and marks the bounded total as a lower bound", async () => {
		const first = "019f7eed-5d42-7102-8387-cc1d13b176d2";
		const second = "019f7eed-5d42-7102-8387-cc1d13b176d3";
		const third = "019f7eed-5d42-7102-8387-cc1d13b176d4";
		searchCandidates.mockResolvedValueOnce([
			{
				hits: [
					{ id: first, revision: 1, category: "units", unitType: "book" },
					{ id: second, revision: 1, category: "units", unitType: "book" },
					{ id: third, revision: 1, category: "units", unitType: "book" },
				],
				estimatedTotalHits: 3,
				processingTimeMs: 1,
			},
		]);
		execute.mockResolvedValueOnce({
			rows: [
				{ hit: { id: first }, ordinality: "1" },
				{ hit: { id: second }, ordinality: "2" },
			],
		});
		const result = await searchDomain("units", { query: "book", limit: 1 });
		expect(result.hits).toEqual([{ id: first, slugAddress: null }]);
		expect(result.total).toEqual({ value: 2, relation: "lower-bound" });
		expect(result.nextCursor).toBeDefined();
		expect(parseSearchCursor(result.nextCursor ?? "").categories.units?.offset).toBe(1);
		const statement = execute.mock.calls.at(-1)?.[0] as SQL | undefined;
		if (!statement) throw new Error("Search did not execute a query");
		const query = dialect.sqlToQuery(statement);
		expect(query.sql).toMatch(/ORDER BY search_candidate\.ordinality\s+LIMIT \$\d+/);
		expect(query.params.at(-1)).toBe(2);
	});

	it("retains an exact total when the bounded authorization query covers every candidate", async () => {
		const first = "019f7eed-5d42-7102-8387-cc1d13b176d2";
		const second = "019f7eed-5d42-7102-8387-cc1d13b176d3";
		searchCandidates.mockResolvedValueOnce([
			{
				hits: [
					{ id: first, revision: 1, category: "units", unitType: "book" },
					{ id: second, revision: 1, category: "units", unitType: "book" },
				],
				estimatedTotalHits: 2,
				processingTimeMs: 1,
			},
		]);
		execute.mockResolvedValueOnce({
			rows: [
				{ hit: { id: first }, ordinality: "1" },
				{ hit: { id: second }, ordinality: "2" },
			],
		});

		const result = await searchDomain("units", { query: "book", limit: 1 });

		expect(result.total).toEqual({ value: 2, relation: "exact" });
	});

	it("batches bounded facet counts and omits unsupported category facets", async () => {
		execute.mockResolvedValueOnce({
			rows: [
				{ field: "category", value: "units", count: "12" },
				{ field: "language", value: "zh", count: "8" },
			],
		});

		const facets = await searchDomainFacets("units", {}, [
			"category",
			"language",
			"tag",
			"realm",
			"credit",
			"owner",
		]);
		const query = lastQuery();

		expect(facets).toEqual([
			{
				field: "category",
				options: [{ value: "units", count: { value: 12, relation: "exact" } }],
			},
			{
				field: "language",
				options: [{ value: "zh", count: { value: 8, relation: "exact" } }],
			},
		]);
		expect(query).toContain("union all");
		expect(query).toContain("with search_candidate(unit_id, revision)");
		expect(query).toContain('"search_unit_projection_source"."revision"');
		expect(query).toContain('join "unit_localization" as "facet_unit_localization"');
		expect(query).toContain('join "unit_effective_tag" as "facet_unit_tag"');
		expect(query).toContain('join "realm_unit" as "facet_realm_unit"');
		expect(query).toContain('join "credit_attribution" as "facet_credit_attribution"');
		expect(query).toContain('join "unit_ownership" as "facet_ownership"');
		expect(query.match(/limit 100/g)).toHaveLength(6);
		expect(searchCandidates).toHaveBeenLastCalledWith([
			expect.objectContaining({ offset: 0, limit: 1_000 }),
		]);

		execute.mockClear();
		await expect(searchDomainFacets("users", {}, ["kind"])).resolves.toEqual([]);
		expect(execute).not.toHaveBeenCalled();
	});
});
