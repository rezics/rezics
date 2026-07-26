import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	createFeedScoreCandidates,
	getFeedCandidateRealmIdExpression,
	getFeedEligibilityCondition,
	prioritizeFeedRealmContexts,
	resolveFeedContentSelection,
} from "./index";

const dialect = new PgDialect();

describe("feed score candidates", () => {
	const targetId = "00000000-0000-4000-8000-000000000001";
	const preferredContextUnitId = "00000000-0000-4000-8000-000000000002";
	const globalContextUnitId = "00000000-0000-4000-8000-000000000003";
	const contextTitles = new Map([
		[preferredContextUnitId, "Preferred"],
		[globalContextUnitId, "Global"],
	]);

	it("returns both aggregates so presentation can prefer the viewer context", () => {
		const aggregates = new Map([
			[
				`${targetId}:${preferredContextUnitId}`,
				{
					contextUnitId: preferredContextUnitId,
					totalScore: 18,
					totalCount: 2,
				},
			],
			[
				`${targetId}:${globalContextUnitId}`,
				{
					contextUnitId: globalContextUnitId,
					totalScore: 80,
					totalCount: 10,
				},
			],
		]);

		expect(
			createFeedScoreCandidates({
				aggregates,
				contextTitles,
				defaultContextUnitId: preferredContextUnitId,
				globalContextUnitId,
				targetId,
			}),
		).toEqual({
			preferred: {
				contextUnitId: preferredContextUnitId,
				contextTitle: "Preferred",
				totalScore: 18,
				totalCount: 2,
			},
			global: {
				contextUnitId: globalContextUnitId,
				contextTitle: "Global",
				totalScore: 80,
				totalCount: 10,
			},
		});
	});

	it("leaves a missing preferred aggregate empty while retaining the global candidate", () => {
		const aggregates = new Map([
			[
				`${targetId}:${globalContextUnitId}`,
				{
					contextUnitId: globalContextUnitId,
					totalScore: 80,
					totalCount: 10,
				},
			],
		]);

		expect(
			createFeedScoreCandidates({
				aggregates,
				contextTitles,
				defaultContextUnitId: preferredContextUnitId,
				globalContextUnitId,
				targetId,
			}),
		).toEqual({
			preferred: null,
			global: {
				contextUnitId: globalContextUnitId,
				contextTitle: "Global",
				totalScore: 80,
				totalCount: 10,
			},
		});
	});
});

describe("feed eligibility SQL", () => {
	it("defaults to feedable Units and Post kinds without replies", () => {
		const selection = resolveFeedContentSelection();

		expect(selection.unitKinds).toContain("book");
		expect(selection.postKinds).toContain("post");
		expect(selection.postKinds).toContain("excerpt");
		expect(selection.postKinds).not.toContain("reply");
		expect(selection.selected).not.toContain("post:reply");
	});

	it("keeps supported replies available when explicitly selected", () => {
		expect(resolveFeedContentSelection(["post:reply"])).toEqual({
			selected: ["post:reply"],
			unitKinds: [],
			postKinds: ["reply"],
		});
	});

	it("normalizes content selections into the contract order", () => {
		expect(resolveFeedContentSelection(["post:reply", "unit:book"]).selected).toEqual([
			"unit:book",
			"post:reply",
		]);
	});

	it("binds multiple content ratings as scalar values", () => {
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: true,
					contentRatings: ["general", "r15"],
					preferredLanguages: ["zh"],
				},
				{},
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toMatch(/"unit"\."content_rating" in \(\$\d+, \$\d+\)/);
		expect(query.sql).not.toContain("::text[]");
		expect(query.params).toEqual(expect.arrayContaining(["general", "r15"]));
	});

	it("filters content kinds before candidate ranking", () => {
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: false,
					contentRatings: ["general"],
					preferredLanguages: [],
				},
				{ content: ["post:post"] },
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toContain('"unit"."kind" =');
		expect(query.sql).toContain('"post"."kind" in');
		expect(query.params).toEqual(expect.arrayContaining(["post", "general"]));
		expect(query.params).not.toContain("reply");
	});

	it("uses simple domain content filters to narrow the feed universe", () => {
		const selection = resolveFeedContentSelection(["unit:book", "post:review"]);

		expect(selection).toEqual({
			selected: ["unit:book", "post:review"],
			unitKinds: ["book"],
			postKinds: ["review"],
		});
	});

	it("applies every requested language and Realm as array membership filters", () => {
		const realmIds = [
			"00000000-0000-4000-8000-000000000001",
			"00000000-0000-4000-8000-000000000002",
		];
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: false,
					contentRatings: ["general"],
					preferredLanguages: [],
				},
				{ languages: ["zh", "en"], realmIds },
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toContain("scoped_localization.language in");
		expect(query.sql).toContain("scoped_content.realm_id in");
		expect(query.params).toEqual(expect.arrayContaining(["zh", "en", ...realmIds]));
	});

	it("keeps Review Score filtering context-addressed inside the internal scope", () => {
		const contextUnitId = "00000000-0000-4000-8000-000000000003";
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: false,
					contentRatings: ["general"],
					preferredLanguages: [],
				},
				{
					content: ["post:review"],
					reviewScore: { contextUnitId, values: [8, 9, 10] },
				},
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toContain("scoped_post_score");
		expect(query.sql).toContain("scoped_score.context_unit_id");
		expect(query.sql).toContain("scoped_score.value in");
		expect(query.params).toEqual(
			expect.arrayContaining(["review", contextUnitId, 8, 9, 10, "general"]),
		);
	});

	it("compiles Tag and displayed Score predicates from the public Filter tree", () => {
		const realmId = "00000000-0000-4000-8000-000000000003";
		const tagId = "00000000-0000-4000-8000-000000000004";
		const query = dialect.sqlToQuery(
			getFeedEligibilityCondition(
				{
					personalized: false,
					contentRatings: ["general"],
					preferredLanguages: [],
				},
				{
					filter: {
						all: [
							{
								tags: {
									some: {
										tag: { id: { in: [tagId] } },
										authority: {
											kind: "realm",
											realm: { id: { in: [realmId] } },
											view: {
												kind: "community",
												consensus: {
													score: { range: { minimum: 1 } },
												},
											},
										},
									},
								},
							},
							{
								post: {
									is: {
										kind: { in: ["review"] },
										scores: {
											displayed: {
												some: {
													context: { id: { in: [realmId] } },
													value: { in: [8, 9, 10] },
												},
											},
										},
									},
								},
							},
						],
					},
				},
				new Date("2026-07-16T00:00:00.000Z"),
			),
		);

		expect(query.sql).toContain("realm_tag_vote_stat");
		expect(query.sql).toContain("post_score filter_post_score");
		expect(query.sql).toContain("score filter_score");
		expect(query.params).toEqual(
			expect.arrayContaining([tagId, realmId, 1, "review", realmId, 8, 9, 10]),
		);
	});
});

describe("feed candidate realm SQL", () => {
	it("uses the physical follow table for personalized realm preference", () => {
		const profileId = "00000000-0000-4000-8000-000000000001";
		const query = dialect.sqlToQuery(
			getFeedCandidateRealmIdExpression({
				profileId,
				personalized: true,
			}),
		);

		expect(query.sql).toContain('select 1 from "unit_follow"');
		expect(query.sql).toContain('"unit_follow"."follower_profile_id"');
		expect(query.sql).toContain('"unit_follow"."unit_id" = candidate_realm.realm_id');
		expect(query.sql).not.toContain('"preferred_realm_follow"');
		expect(query.params).toEqual([profileId]);
	});

	it.each([
		{
			name: "signed-in viewer with personalization disabled",
			viewer: {
				profileId: "00000000-0000-4000-8000-000000000001",
				personalized: false,
			},
		},
		{
			name: "anonymous viewer",
			viewer: { personalized: false },
		},
	])("uses deterministic realm ordering for $name", ({ viewer }) => {
		const query = dialect.sqlToQuery(getFeedCandidateRealmIdExpression(viewer));

		expect(query.sql).not.toContain('"unit_follow"');
		expect(query.sql).not.toContain("case when exists");
		expect(query.sql).toContain("candidate_realm.created_at desc, candidate_realm.realm_id");
		expect(query.params).toEqual([]);
	});

	it("limits Realm selection to the explicitly requested Realms", () => {
		const realmId = "00000000-0000-4000-8000-000000000002";
		const query = dialect.sqlToQuery(
			getFeedCandidateRealmIdExpression(
				{
					profileId: "00000000-0000-4000-8000-000000000001",
					personalized: true,
				},
				[realmId],
			),
		);

		expect(query.sql).toContain("candidate_realm.realm_id in ($1::uuid)");
		expect(query.params).toContain(realmId);
	});
});

describe("feed realm context ordering", () => {
	it("places the ranked realm first and preserves the remaining order", () => {
		const realms = [{ id: "first" }, { id: "ranked" }, { id: "third" }] as const;

		expect(prioritizeFeedRealmContexts(realms, "ranked")).toEqual([
			realms[1],
			realms[0],
			realms[2],
		]);
	});

	it("returns a copy without dropping contexts when the ranked realm is unavailable", () => {
		const realms = [{ id: "first" }, { id: "second" }] as const;
		const prioritized = prioritizeFeedRealmContexts(realms, "missing");

		expect(prioritized).toEqual(realms);
		expect(prioritized).not.toBe(realms);
	});
});
