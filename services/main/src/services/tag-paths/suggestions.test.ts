import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { execute } }));

import { suggestTagExpressions } from "./service";

const dialect = new PgDialect();
const TagIdA = "019fb1ef-a9b2-7a98-8d45-770b04760100";
const TagIdB = "019fb1ef-a9b2-7a98-8d45-770b04760101";

describe("Tag Expression suggestions", () => {
	beforeEach(() => {
		execute.mockReset();
		execute.mockResolvedValue({ rows: [] });
	});

	it.each([
		{
			localizationLanguages: undefined,
			expectedSql: "array[]::text[]",
			expectedParams: ["fa", 80],
		},
		{
			localizationLanguages: ["en"] as const,
			expectedSql: "array[$2]::text[]",
			expectedParams: ["fa", "en", 80],
		},
		{
			localizationLanguages: ["zh", "en"] as const,
			expectedSql: "array[$2, $3]::text[]",
			expectedParams: ["fa", "zh", "en", 80],
		},
	])("uses the ranked bounded candidate function for $localizationLanguages", async (testCase) => {
		await expect(
			suggestTagExpressions({
				query: "fa",
				localizationLanguages: testCase.localizationLanguages,
				limit: 20,
			}),
		).resolves.toEqual([]);

		expect(execute).toHaveBeenCalledTimes(1);
		const statement = execute.mock.calls[0]?.[0] as SQL;
		const query = dialect.sqlToQuery(statement);
		expect(query.sql).toContain("public.search_tag_suggestion_candidates");
		expect(query.sql).toContain("5000");
		expect(query.sql).toContain(testCase.expectedSql);
		expect(query.params).toEqual(testCase.expectedParams);
	});

	it("queries direct Tags and path members in separate bounded pools", async () => {
		execute
			.mockResolvedValueOnce({
				rows: [
					{ tagId: TagIdA, searchScore: 12, candidateRank: 1 },
					{ tagId: TagIdB, searchScore: 8, candidateRank: 2 },
				],
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });

		await expect(suggestTagExpressions({ query: "hair", limit: 20 })).resolves.toEqual([]);

		expect(execute).toHaveBeenCalledTimes(4);
		const terms = dialect.sqlToQuery(execute.mock.calls[1]?.[0] as SQL);
		const direct = dialect.sqlToQuery(execute.mock.calls[2]?.[0] as SQL);
		const paths = dialect.sqlToQuery(execute.mock.calls[3]?.[0] as SQL);
		expect(terms.sql).toContain('join "unit_localization" localization');
		expect(terms.sql).toContain('join "unit_alias" unit_alias');
		expect(terms.sql).toContain("unit_alias.normalized_term = $4");
		expect(terms.params).toEqual([TagIdA, TagIdB, 560, "hair", 640]);
		expect(direct.sql).toContain("expression.expression_kind = 'simple'");
		expect(direct.sql).toContain("cross join lateral");
		expect(direct.sql).toContain("limit $3");
		expect(direct.params).toEqual([TagIdA, TagIdB, 80, 80]);
		expect(paths.sql).toContain('from "tag_path_member" member');
		expect(paths.sql).toContain("where member.node_id = candidate.tag_id");
		expect(paths.sql).toContain("expression_hit");
		expect(paths.sql).toContain("path_hit");
		expect(paths.sql).toContain("sense_hit");
		expect(paths.params).toEqual([TagIdA, TagIdB, 80, 80, 80, 80, 160, 160, 80, 160, 80, 160, 80]);
	});

	it("requires Realm adoption while preserving path-member recall", async () => {
		const realmId = "019fb1ef-a9b2-7a98-8d45-770b04760200";
		execute
			.mockResolvedValueOnce({
				rows: [{ tagId: TagIdA, searchScore: 12, candidateRank: 1 }],
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });

		await suggestTagExpressions({ query: "hair", realmId, limit: 20 });

		const paths = dialect.sqlToQuery(execute.mock.calls[3]?.[0] as SQL);
		expect(paths.sql).toContain('join "realm_tag_path_sense" adoption');
		expect(paths.sql).toContain("sense.scope = 'realm' and sense.realm_id");
		expect(paths.params.filter((value) => value === realmId)).toHaveLength(3);
		expect(paths.params.at(-1)).toBe(80);
	});
});
