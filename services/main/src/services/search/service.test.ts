import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { execute } }));

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
		expect(queries).toContain('LEFT JOIN "unit" AS "subject_unit"');
		expect(queries).toContain('LEFT JOIN "post_reply"');
	});

	it("maps current filters and sorts to their owning tables", async () => {
		await searchDomain("units", {
			query: "ocean",
			Languages: ["zh-hant"],
			types: ["book"],
			contentRatings: ["general"],
			aiDisclosures: ["none"],
			licenses: ["cc-by"],
			sort: "publishedAt:desc",
		});
		expect(lastQuery()).toContain('"unit"."published_at" DESC NULLS LAST');

		await searchDomain("users", { sort: "subscriberCount:desc" });
		expect(lastQuery()).toContain('"unit_follow_stat"."follower_count"');

		await searchDomain("entity", { types: ["person"] });
		expect(lastQuery()).toContain('("entity"."kind")::text');

		await searchDomain("posts", {
			publisherId: "11111111-1111-1111-1111-111111111111",
			realmId: "22222222-2222-2222-2222-222222222222",
			subjectId: "33333333-3333-3333-3333-333333333333",
			rootId: "44444444-4444-4444-4444-444444444444",
			parentId: "55555555-5555-5555-5555-555555555555",
			sort: "replyCount:asc",
		});
		const postsQuery = lastQuery();
		expect(postsQuery).toContain('"unit_status_event"');
		expect(postsQuery).toContain('FROM "realm_unit"');
		expect(postsQuery).toContain('"post_reply"."root_post_id"');
		expect(postsQuery).toContain('"post_reply"."parent_post_id"');
		expect(postsQuery).toContain('"post_reply_stat"."undeleted_descendant_count"');
		expect(postsQuery).toContain('"post_reply_stat"."undeleted_direct_count"');

		await searchDomain("realms", {
			joinPolicies: ["approval"],
			sort: "subscriberCount:asc",
		});
		expect(lastQuery()).toContain('"unit_follow_stat"."follower_count"');

		await searchDomain("collections", {
			ownerId: "11111111-1111-1111-1111-111111111111",
		});
		expect(lastQuery()).toContain('"collection"."owner_profile_id"');

		await searchDomain("reviews", {
			targetId: "11111111-1111-1111-1111-111111111111",
			types: ["book"],
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
		expect(pollsQuery).toContain('"poll"."closes_at" ASC NULLS LAST');
	});

	it("rejects category-specific combinations before executing SQL", async () => {
		await expect(
			searchDomain("units", { sort: "subscriberCount:desc" }),
		).rejects.toBeInstanceOf(InvalidSearch);
		await expect(searchDomain("tags", { multiple: true })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		await expect(searchDomain("posts", { joinPolicies: ["open"] })).rejects.toBeInstanceOf(
			InvalidSearch,
		);
		expect(execute).not.toHaveBeenCalled();
	});

	it("batches bounded facet counts and omits unsupported category facets", async () => {
		execute.mockResolvedValueOnce({
			rows: [
				{ field: "category", value: "units", count: "12" },
				{ field: "language", value: "zh-hant", count: "8" },
			],
		});

		const facets = await searchDomainFacets("units", {}, [
			"category",
			"language",
			"tag",
			"join-policy",
		]);
		const query = lastQuery();

		expect(facets).toEqual([
			{ field: "category", options: [{ value: "units", count: 12 }] },
			{ field: "language", options: [{ value: "zh-hant", count: 8 }] },
		]);
		expect(query).toContain("union all");
		expect(query).toContain('"facet_unit_localization"');
		expect(query).toContain('"facet_unit_tag"');
		expect(query).not.toContain('"realm"."join_policy"');
		expect(query.match(/limit 100/g)).toHaveLength(3);
	});
});
