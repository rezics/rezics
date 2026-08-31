import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const select = vi.hoisted(() => vi.fn());
const where = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { execute, select } }));

import { suggestTagExpressions } from "./service";

const dialect = new PgDialect();
const TagIdA = "019fb1ef-a9b2-7a98-8d45-770b04760100";
const TagIdB = "019fb1ef-a9b2-7a98-8d45-770b04760101";

function expressionSelect(rows: readonly object[]) {
	const builder = {
		from: vi.fn(),
		leftJoin: vi.fn(),
		where,
		orderBy: vi.fn(),
		limit: vi.fn(async () => rows),
	};
	builder.from.mockReturnValue(builder);
	builder.leftJoin.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);
	builder.orderBy.mockReturnValue(builder);
	return builder;
}

describe("Tag Expression suggestions", () => {
	beforeEach(() => {
		execute.mockReset();
		execute.mockResolvedValue({ rows: [] });
		select.mockReset();
		where.mockReset();
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
	])("builds a PostgreSQL text array for $localizationLanguages", async (testCase) => {
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
		expect(query.sql).toContain(testCase.expectedSql);
		expect(query.params).toEqual(testCase.expectedParams);
	});

	it("builds a PostgreSQL UUID array for matched Tag arguments", async () => {
		execute.mockResolvedValue({ rows: [{ tagId: TagIdA }, { tagId: TagIdB }] });
		select.mockImplementation(() => expressionSelect([]));

		await expect(suggestTagExpressions({ query: "fa", limit: 20 })).resolves.toEqual([]);

		expect(select).toHaveBeenCalledTimes(1);
		expect(where).toHaveBeenCalledTimes(1);
		const condition = where.mock.calls[0]?.[0] as SQL;
		const query = dialect.sqlToQuery(condition);
		expect(query.sql).toMatch(
			/argument\.tag_id = any\(array\[\$\d+::uuid, \$\d+::uuid\]::uuid\[\]\)/,
		);
		expect(query.params).toEqual(["active", TagIdA, TagIdB, TagIdA, TagIdB]);
	});
});
