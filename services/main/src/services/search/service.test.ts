import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() =>
	vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
		operation({ execute }),
	),
);

vi.mock("../database", () => ({
	database: {
		execute,
		transaction,
		select: vi.fn(() => {
			const rows = Promise.resolve([]);
			const query = {
				from: () => query,
				innerJoin: () => query,
				where: () => query,
				then: rows.then.bind(rows),
			};
			return query;
		}),
	},
}));

import { parseSearchCursor } from "./query";
import {
	compilePostgresSearchExpression,
	searchDomain,
	searchGlobalIdentifiers,
	searchGlobalIdentifiersWithFacets,
} from "./service";

const dialect = new PgDialect();
const first = "019f7eed-5d42-7102-8387-cc1d13b176d2";
const second = "019f7eed-5d42-7102-8387-cc1d13b176d3";

function candidateRow(input: {
	readonly id: string;
	readonly primaryValue: string;
	readonly secondaryValue: string;
	readonly hasMore: boolean;
	readonly source?: "ordered" | "best-positive" | "best-zero";
	readonly snapshotId?: string | null;
}) {
	return {
		...input,
		source: input.source ?? "ordered",
		snapshotId: input.snapshotId ?? null,
		continuationPrimary: input.hasMore ? input.primaryValue : null,
		continuationSecondary: input.hasMore ? input.secondaryValue : null,
		continuationUnitId: input.hasMore ? input.id : null,
		continuationSource: input.hasMore ? (input.source ?? "ordered") : null,
		continuationSnapshotId: input.hasMore ? (input.snapshotId ?? null) : null,
		scannedCount: 1,
		snapshotAvailable: true,
		boundedTextFallback: false,
	};
}

function sqlText(statement: SQL): string {
	return dialect.sqlToQuery(statement).sql;
}

describe("direct PostgreSQL Search", () => {
	beforeEach(() => {
		execute.mockReset();
		transaction.mockClear();
	});

	it("compiles relational filters without an external candidate backend", () => {
		const expression = compilePostgresSearchExpression("tags", {
			operator: "all",
			clauses: [
				{ field: "realm", operator: "equals", value: first },
				{
					field: "realm-tag-vote",
					operator: "matches",
					realmId: first,
					tagId: second,
					score: { lower: 1 },
				},
			],
		});
		const query = sqlText(expression);
		expect(query).toContain('from "realm_unit"');
		expect(query).toContain('from "realm_tag_judgment_stat"');
		expect(query).toContain('"realm_tag_judgment_stat"."score" >=');
	});

	it("excludes spoiler-only Realm Tag aggregates from legacy vote filters", () => {
		const query = dialect.sqlToQuery(
			compilePostgresSearchExpression("units", {
				field: "realm-tag-vote",
				operator: "matches",
				realmId: first,
				tagId: second,
			}),
		);

		expect(query.sql).toContain('"realm_tag_judgment_stat"."vote_count" > 0');
	});

	it("runs adaptive PGroonga candidates, authorization, filters, and stable ordering in one bounded query", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: first,
						primaryValue: "8",
						secondaryValue: "1720000000",
						hasMore: true,
					}),
				],
			})
			.mockResolvedValueOnce({
				rows: [
					{
						hit: {
							id: first,
							category: "units",
							kind: "book",
							language: "en",
							title: "Book",
							summary: null,
							titles: ["Book"],
							summaries: [],
						},
					},
				],
			});

		const result = await searchDomain("units", {
			query: "資料庫",
			limit: 1,
			Languages: ["en"],
		});
		const candidateSql = sqlText(execute.mock.calls[1]![0] as SQL);
		const candidateQuery = dialect.sqlToQuery(execute.mock.calls[1]![0] as SQL);
		expect(candidateSql).toContain("public.search_text_candidates");
		expect(candidateQuery.params).toEqual(expect.arrayContaining(["資料庫", "数据库"]));
		expect(candidateSql).toContain("text_candidate.unit_updated_at_micros");
		expect(candidateSql).toContain("text_candidate.search_matched");
		expect(candidateSql).not.toContain("pgroonga_score");
		expect(candidateSql).not.toContain('from "unit_alias"');
		expect(candidateSql).toContain("search_sources");
		expect(candidateSql).toContain("eligible_matches");
		expect(candidateSql).toContain("ordered_source as materialized");
		expect(candidateSql).toContain("scanned_candidates as materialized");
		expect(candidateSql).toContain("select distinct unit_id");
		expect(candidateSql).not.toContain('left join "profile"');
		expect(candidateSql).not.toContain('left join "entity"');
		expect(candidateSql).not.toContain("candidate_localizations as materialized");
		expect(candidateSql).toContain('"unit"."status"');
		expect(candidateSql).toContain("limit");
		expect(result.total).toEqual({ kind: "lower-bound", value: 1 });
		expect(result.hits[0]?.id).toBe(first);

		const cursor = parseSearchCursor(result.nextCursor ?? "");
		expect(cursor.categories.units).toEqual({
			seen: 1,
			exhausted: false,
			position: {
				primary: "8",
				secondary: "1720000000",
				unitId: first,
				source: "ordered",
			},
		});
	});

	it("returns an exact count only when the bounded query is exhausted", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: first,
						primaryValue: "0",
						secondaryValue: "1720000000",
						hasMore: false,
					}),
				],
			})
			.mockResolvedValueOnce({ rows: [] });
		const result = await searchDomain("units", { limit: 20 });
		expect(result.total).toEqual({ kind: "exact", value: 1 });
		expect(result.nextCursor).toBeUndefined();
	});

	it("applies server-owned eligibility while filling a global Top-K page", async () => {
		execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [
				candidateRow({
					id: first,
					primaryValue: "1720000000",
					secondaryValue: "0",
					hasMore: false,
				}),
			],
		});

		const result = await searchGlobalIdentifiers({
			branches: [{ category: "reviews", sourceUnitKinds: ["post"] }],
			additionalConditions: [
				sql.raw(
					"exists (select 1 from post bounded_review_gate where bounded_review_gate.id = unit.id)",
				),
			],
			limit: 20,
			sort: "createdAt:desc",
		});

		const candidateSql = sqlText(execute.mock.calls[1]![0] as SQL);
		expect(candidateSql).toContain("bounded_review_gate");
		expect(candidateSql).toContain("scanned_candidates as materialized");
		expect(result.hits).toEqual([{ id: first }]);
	});

	it("compiles descending cursors as row-value index seeks", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: second,
						primaryValue: "1719999999",
						secondaryValue: "0",
						hasMore: false,
					}),
				],
			})
			.mockResolvedValueOnce({ rows: [] });

		await searchDomain("units", {
			sort: "updatedAt:desc",
			limit: 20,
			searchSeen: 20,
			searchPosition: {
				primary: "1720000000",
				secondary: "0",
				unitId: first,
				source: "ordered",
			},
		});

		const candidateSql = sqlText(execute.mock.calls[1]![0] as SQL);
		expect(candidateSql).toContain('("unit"."updated_at", "unit"."id") < (to_timestamp(');
		expect(candidateSql).toContain('order by "unit"."updated_at" desc, "unit"."id" desc');
	});

	it("treats query-language punctuation as escaped ordinary search text", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: first,
						primaryValue: "0",
						secondaryValue: "1720000000",
						hasMore: false,
					}),
				],
			})
			.mockResolvedValueOnce({ rows: [] });
		const result = await searchDomain("units", { query: "(common OR hidden", limit: 20 });
		const candidateQuery = dialect.sqlToQuery(execute.mock.calls[1]![0] as SQL);
		expect(candidateQuery.sql).toContain("public.search_text_candidates");
		expect(candidateQuery.params.filter((value) => value === "(common OR hidden")).toHaveLength(9);
		expect(candidateQuery.params).toEqual(expect.arrayContaining(["book", "software", "media"]));
		expect(result.total).toEqual({ kind: "exact", value: 1 });
		expect(result.nextCursor).toBeUndefined();
	});

	it("seeks best through a pinned sparse snapshot and preserves a cursor after filtered rows", async () => {
		const snapshotId = "019fda5f-0f34-76c6-a57f-d3d03ea687fc";
		execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [
				{
					id: null,
					primaryValue: null,
					secondaryValue: null,
					source: null,
					snapshotId: null,
					hasMore: true,
					continuationPrimary: "0",
					continuationSecondary: "1720000000",
					continuationUnitId: first,
					continuationSource: "best-zero",
					continuationSnapshotId: snapshotId,
					scannedCount: 4096,
					snapshotAvailable: true,
					boundedTextFallback: false,
				},
			],
		});

		const result = await searchDomain("units", { limit: 20, sort: "best" });
		const candidateSql = sqlText(execute.mock.calls[1]![0] as SQL);
		expect(candidateSql).toContain('from "unit_best_score"');
		expect(candidateSql).toContain('order by "unit_best_score"."score" desc');
		expect(candidateSql).toContain('"unit_best_score"."unit_kind" =');
		expect(candidateSql).toContain('"unit"."kind" =');
		expect(candidateSql).toContain('order by "unit"."updated_at" desc, "unit"."id" desc');
		expect(candidateSql).not.toContain("row_number()");
		expect(candidateSql).toContain("scanned_candidates as materialized");
		expect(candidateSql).not.toContain("recommendation_unit_stat");
		expect(result.hits).toEqual([]);
		expect(result.total).toEqual({ kind: "lower-bound", value: 0 });
		expect(parseSearchCursor(result.nextCursor ?? "").categories.units?.position).toEqual({
			primary: "0",
			secondary: "1720000000",
			unitId: first,
			source: "best-zero",
			snapshotId,
		});
	});

	it("continues selective filtering in adaptive keyset batches", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: null,
						primaryValue: null,
						secondaryValue: null,
						source: null,
						snapshotId: null,
						hasMore: true,
						continuationPrimary: "1720000000",
						continuationSecondary: "0",
						continuationUnitId: first,
						continuationSource: "ordered",
						continuationSnapshotId: null,
						scannedCount: 64,
						snapshotAvailable: true,
						boundedTextFallback: false,
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: second,
						primaryValue: "1719999999",
						secondaryValue: "0",
						hasMore: false,
					}),
				],
			})
			.mockResolvedValueOnce({
				rows: [
					{
						hit: {
							id: second,
							category: "units",
							kind: "book",
							language: "en",
							title: "Adaptive result",
							summary: null,
							titles: ["Adaptive result"],
							summaries: [],
						},
					},
				],
			});

		const result = await searchDomain("units", { sort: "updatedAt:desc", limit: 20 });
		expect(transaction).toHaveBeenCalledTimes(2);
		expect(sqlText(execute.mock.calls[3]![0] as SQL)).toContain(
			'("unit"."updated_at", "unit"."id") < (to_timestamp(',
		);
		expect(result.hits.map(({ id }) => id)).toEqual([second]);
		expect(result.total).toEqual({ kind: "exact", value: 1 });
	});

	it("returns a continuation instead of expanding a dense text fallback", async () => {
		execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [
				{
					id: null,
					primaryValue: null,
					secondaryValue: null,
					source: null,
					snapshotId: null,
					hasMore: true,
					continuationPrimary: "1720000000",
					continuationSecondary: "0",
					continuationUnitId: first,
					continuationSource: "ordered",
					continuationSnapshotId: null,
					scannedCount: 64,
					snapshotAvailable: true,
					boundedTextFallback: true,
				},
			],
		});

		const result = await searchDomain("units", { query: "Library", limit: 20 });
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(execute).toHaveBeenCalledTimes(2);
		expect(result.hits).toEqual([]);
		expect(result.nextCursor).toBeDefined();
	});

	it("cuts a page cursor from the shared page and facet candidate window", async () => {
		const rows = Array.from({ length: 21 }, (_, index) => {
			const id = `019f7eed-5d42-7102-8387-${(index + 1).toString(16).padStart(12, "0")}`;
			return candidateRow({
				id,
				primaryValue: String(100 - index),
				secondaryValue: "1720000000",
				hasMore: false,
			});
		});
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows })
			.mockResolvedValueOnce({
				rows: [{ category: "units", field: "category", value: "units", count: "21" }],
			});

		const result = await searchGlobalIdentifiersWithFacets(
			{
				branches: [{ category: "units" }],
				limit: 20,
				sort: "updatedAt:desc",
			},
			[{ category: "units", fields: ["category"] }],
		);
		expect(transaction).toHaveBeenCalledOnce();
		expect(result.page.hits).toHaveLength(20);
		expect(result.page.nextPosition?.unitId).toBe(rows[19]?.id);
		expect(result.facetGroups[0]?.facets[0]?.options[0]).toEqual({
			value: "units",
			count: { kind: "exact", value: 21 },
		});
		const facetSql = sqlText(execute.mock.calls[2]![0] as SQL);
		expect(facetSql).toContain("eligible_category");
		expect(facetSql).not.toContain('left join "profile"');
	});

	it("drives relational filters from one indexed global candidate seed", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ id: first }] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: first,
						primaryValue: "1720000000",
						secondaryValue: "0",
						hasMore: false,
					}),
				],
			});

		const result = await searchGlobalIdentifiersWithFacets(
			{
				branches: [{ category: "units" }, { category: "entities" }],
				domainFilter: {
					any: [
						{ creditAttributions: { some: { id: { in: [first] } } } },
						{ subjectAssociations: { some: { id: { in: [first] } } } },
					],
				},
				limit: 20,
				sort: "updatedAt:desc",
			},
			[],
		);
		const seedSql = sqlText(execute.mock.calls[1]![0] as SQL);
		const candidateSql = sqlText(execute.mock.calls[3]![0] as SQL);

		expect(candidateSql).toContain("filter_seed(unit_id) as materialized");
		expect(candidateSql).toContain('inner join "unit" on "unit"."id" = filter_seed.unit_id');
		expect(seedSql).toContain(" union all ");
		expect(candidateSql.match(/candidate\.id in/g)).toBeNull();
		expect(result.page.hits).toEqual([{ id: first }]);
	});

	it("keeps sparse relational seeds on the indexed best ordering", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ id: first }] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: first,
						primaryValue: "42",
						secondaryValue: "1720000000",
						hasMore: false,
						source: "best-positive",
						snapshotId: second,
					}),
				],
			});

		await searchGlobalIdentifiersWithFacets(
			{
				branches: [{ category: "units" }],
				domainFilter: {
					tags: { some: { tag: { id: { in: [first] } } } },
				},
				limit: 20,
				sort: "best",
			},
			[],
		);
		const seedSql = sqlText(execute.mock.calls[1]![0] as SQL);
		const candidateSql = sqlText(execute.mock.calls[3]![0] as SQL);

		expect(candidateSql).toContain("filter_seed(unit_id) as materialized");
		expect(seedSql).toContain('from "current_unit_effective_tag" filter_effective_tag');
		expect(candidateSql).toContain(
			'inner join filter_seed on filter_seed.unit_id = "unit_best_score"."unit_id"',
		);
		expect(candidateSql).toContain('inner join filter_seed on filter_seed.unit_id = "unit"."id"');
	});

	it("switches a dense relational seed back to bounded ordered keyset scanning", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: Array.from({ length: 4_097 }, () => ({ id: first })),
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					candidateRow({
						id: first,
						primaryValue: "1720000000",
						secondaryValue: "0",
						hasMore: false,
					}),
				],
			});

		await searchGlobalIdentifiersWithFacets(
			{
				branches: [{ category: "units" }],
				domainFilter: {
					tags: { some: { tag: { id: { in: [first] } } } },
				},
				limit: 20,
				sort: "updatedAt:desc",
			},
			[],
		);
		const seedSql = sqlText(execute.mock.calls[1]![0] as SQL);
		const candidateSql = sqlText(execute.mock.calls[3]![0] as SQL);

		expect(seedSql).toContain("limit");
		expect(seedSql).toContain('from "current_unit_effective_tag" filter_effective_tag');
		expect(candidateSql).not.toContain("filter_seed(unit_id) as materialized");
		expect(candidateSql).toContain('order by "unit"."updated_at" desc, "unit"."id" desc');
	});
});
