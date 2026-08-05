import { type SQL } from "drizzle-orm";
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
import { compilePostgresSearchExpression, searchDomain } from "./service";

const dialect = new PgDialect();
const first = "019f7eed-5d42-7102-8387-cc1d13b176d2";
const second = "019f7eed-5d42-7102-8387-cc1d13b176d3";

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
		expect(query).toContain('from "realm_tag_vote_stat"');
		expect(query).toContain('"realm_tag_vote_stat"."score" >=');
	});

	it("runs PGroonga sources, authorization, filters, and stable ordering in one bounded query", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: first,
						primaryValue: "8",
						secondaryValue: "1720000000",
					},
					{
						id: second,
						primaryValue: "7",
						secondaryValue: "1710000000",
					},
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
		expect(candidateSql).toContain("&@~");
		expect(candidateSql).toContain("pgroonga_query_escape");
		expect(candidateSql).toContain("current_search_text_v1");
		expect(candidateSql).toContain('from "unit_alias" as "search_alias"');
		expect(candidateSql).toContain('coalesce("search_alias_vote_stat"."score", 0) >=');
		expect(candidateSql).toContain('"search_alias"."pinned"');
		expect(candidateSql).not.toContain('"search_alias"."deleted_at"');
		expect(candidateSql).toContain('"search_alias"."language" is null or');
		expect(candidateSql).toContain("search_sources");
		expect(candidateSql).toContain("eligible_matches");
		expect(candidateSql).toContain('group by "unit"."id"');
		expect(candidateSql).not.toContain("candidate_localizations as materialized");
		expect(candidateSql).toContain('"unit"."status"');
		expect(candidateSql).toContain("limit");
		expect(result.total).toEqual({ kind: "lower-bound", value: 2 });
		expect(result.hits[0]?.id).toBe(first);

		const cursor = parseSearchCursor(result.nextCursor ?? "");
		expect(cursor.categories.units).toEqual({
			seen: 1,
			exhausted: false,
			position: { primary: "8", secondary: "1720000000", unitId: first },
		});
	});

	it("returns an exact count only when the bounded query is exhausted", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: first,
						primaryValue: "0",
						secondaryValue: "1720000000",
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] });
		const result = await searchDomain("units", { limit: 20 });
		expect(result.total).toEqual({ kind: "exact", value: 1 });
		expect(result.nextCursor).toBeUndefined();
	});

	it("treats query-language punctuation as escaped ordinary search text", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						id: first,
						primaryValue: "0",
						secondaryValue: "1720000000",
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] });
		const result = await searchDomain("units", { query: "(common OR hidden", limit: 20 });
		const candidateSql = sqlText(execute.mock.calls[1]![0] as SQL);
		expect(candidateSql.match(/pgroonga_query_escape/g)).toHaveLength(3);
		expect(result.total).toEqual({ kind: "exact", value: 1 });
		expect(result.nextCursor).toBeUndefined();
	});
});
