import { type SQL } from "drizzle-orm";
import { PgDialect, type SelectedFields } from "drizzle-orm/pg-core";
import { parseSearchCursor } from "./query";
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
		indexUid: "rezics_units_v6_20260725",
		projectionVersion: 6,
		settingsFingerprint: "a".repeat(64),
	}),
}));
vi.mock("./meilisearch", () => ({ searchCandidates }));

import { InvalidSearch } from "./errors";
import { SearchCategories } from "./schema";
import { searchDomain, searchDomainFacets } from "./service";

const dialect = new PgDialect();

function lastQuery() {
	const statement = execute.mock.calls.at(-1)?.[0] as SQL | undefined;
	if (!statement) throw new Error("Search did not execute a query");
	return dialect.sqlToQuery(statement).sql;
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
		for (const legacyIdentifier of [
			"unit_translation",
			"content_translation",
			'"profiles"',
			"unit_realm",
			"author_user_id",
			"realm_unit_id",
			"root_unit_id",
			"parent_comment_id",
			"default_language",
			"ai_disclosure_mode",
			"license_slug",
			"target_unit_id",
			"join_requires_approval",
			"vote_mode",
			"profile_follow",
			"realm_subscription",
			"zone_subscription",
		])
			expect(queries).not.toContain(legacyIdentifier);
		expect(queries).toContain('"unit_localization"');
		expect(queries).toContain('from "unit_structure_member"');
		expect(queries).not.toContain('from "search_structure_member"');
		expect(queries).toContain('LEFT JOIN "unit" AS "subject_unit"');
		expect(queries).toContain('LEFT JOIN "post_reply"');
		expect(queries).toMatch(/'provider', \$\d+::text/);
		expect(queries).not.toContain("jsonb_strip_nulls");
		expect(queries).toContain("'cover'");
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

		await searchDomain("entity", { kinds: ["person"] });
		expect(lastQuery()).toContain('("entity"."kind")::text');

		await searchDomain("posts", {
			creditedUnitId: "11111111-1111-1111-1111-111111111111",
			realmId: "22222222-2222-2222-2222-222222222222",
			kinds: ["reply"],
			subjectId: "33333333-3333-3333-3333-333333333333",
			rootId: "44444444-4444-4444-4444-444444444444",
			parentId: "55555555-5555-5555-5555-555555555555",
			sort: "replyCount:asc",
		});
		const postsQuery = lastQuery();
		expect(postsQuery).toContain('"credit_attribution"');
		expect(postsQuery).toContain('"post"."kind" <> \'review\'::post_kind');
		expect(postsQuery).toContain('AND ("post"."kind")::text = ANY');
		expect(postsQuery).not.toContain('AND ("unit"."kind")::text = ANY');
		expect(postsQuery).toContain('FROM "realm_unit"');
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
			ownerId: "11111111-1111-1111-1111-111111111111",
		});
		expect(lastQuery()).toContain('"unit_access_binding"."role" = \'owner\'');

		await searchDomain("reviews", {
			targetId: "11111111-1111-1111-1111-111111111111",
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
		expect(pollsQuery).toContain('"poll"."closed_at" IS NULL');
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
		await expect(searchDomain("posts", { contentLicensed: true })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		await expect(searchDomain("posts", { joinPolicies: ["open"] })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		expect(execute).not.toHaveBeenCalled();
	});

	it("keeps catalog applicability and correlated requirements authoritative in PostgreSQL", async () => {
		await searchDomain("units", { contentLicensed: true });
		expect(lastQuery()).toContain('from "catalog_unit_content_license"');

		await searchDomain("units", { contentLicensed: false });
		expect(lastQuery()).toContain("not (exists");

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
		expect(query).toContain('from "realm_tag_context"');
		expect(query).toContain('left join "realm_tag_vote_stat"');
		expect(query).toContain('coalesce("realm_tag_vote_stat"."score", 0) >=');
		expect(query).toContain('coalesce("realm_tag_vote_stat"."vote_count", 0) <=');
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

	it("keeps the page cursor at the last returned authorized hit while scanning totals", async () => {
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
		expect(result.hits).toEqual([{ id: first, slugAddress: null }]);
		expect(result.total).toEqual({ value: 2, relation: "exact" });
		expect(result.nextCursor).toBeDefined();
		expect(parseSearchCursor(result.nextCursor ?? "").categories.units?.offset).toBe(1);
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
		expect(query).toContain('join "unit_access_binding" as "facet_owner_binding"');
		expect(query.match(/limit 100/g)).toHaveLength(6);

		execute.mockClear();
		await expect(searchDomainFacets("users", {}, ["kind"])).resolves.toEqual([]);
		expect(execute).not.toHaveBeenCalled();
	});
});
