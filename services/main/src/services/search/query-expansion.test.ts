import { describe, expect, it } from "vitest";

import { expandSearchQuery, SearchQueryExpansionPolicyVersion } from "./query-expansion";

describe("Search query expansion", () => {
	it("keeps the original and expands simplified and Taiwan variants", () => {
		expect(expandSearchQuery("数据库").variants).toEqual(["数据库", "資料庫"]);
		expect(expandSearchQuery("資料庫").variants).toEqual(["資料庫", "数据库"]);
		expect(expandSearchQuery("數據庫").variants).toEqual(["數據庫", "資料庫", "数据库"]);
	});

	it("uses regional vocabulary conversion", () => {
		expect(expandSearchQuery("软件服务器鼠标").variants).toEqual([
			"软件服务器鼠标",
			"軟體伺服器滑鼠",
		]);
	});

	it("normalizes and deduplicates variants without changing non-Chinese text", () => {
		const result = expandSearchQuery("  PostgreSQL  ");
		expect(result.query).toBe("PostgreSQL");
		expect(result.variants).toEqual(["PostgreSQL"]);
		expect(result.policyVersion).toBe(SearchQueryExpansionPolicyVersion);
	});

	it("does not expand an explicitly Japanese query or a query containing kana", () => {
		expect(expandSearchQuery("国際化", ["ja"])).toEqual({
			query: "国際化",
			variants: ["国際化"],
			policyVersion: SearchQueryExpansionPolicyVersion,
		});
		expect(expandSearchQuery("資料庫", ["en"]).variants).toEqual(["資料庫", "数据库"]);
		expect(expandSearchQuery("データベース").variants).toEqual(["データベース"]);
	});

	it("preserves empty-query semantics", () => {
		expect(expandSearchQuery("   ").variants).toEqual([""]);
	});
});
