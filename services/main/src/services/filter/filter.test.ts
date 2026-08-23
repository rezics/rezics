import {
	assertUnitPredicate,
	assertUnitFilter,
	canonicalUnitPredicate,
	collectUnitPredicateReferenceIds,
	createSimpleFeedFilter,
	FilterContentLanguageValues,
	FilterPostKindValues,
	FilterRealmUnitPublicationStateValues,
	FilterRealmUnitStatusValues,
	FilterUnitKindValues,
	mergeUnitFilter,
	parseUnitFilter,
	readSimpleFeedFilter,
	realmTagQueryPredicate,
	SimpleFeedContentKindValues,
	type UnitPredicate,
	unitFilterSearchQuery,
} from "@rezics/filter";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
	ContentLanguageValues,
	PostKindValues,
	RealmUnitPublicationStateValues,
	RealmUnitStatusValues,
	UnitKindValues,
} from "../database/schema/contract-values";
import { compileUnitPredicateCandidateSet, compileUnitPredicateSql } from "./sql";

const RealmId = "00000000-0000-4000-8000-000000000001";
const TagId = "00000000-0000-4000-8000-000000000002";
const dialect = new PgDialect();

describe("domain Filter contract", () => {
	it("stays aligned with the canonical Unit, Post, and language vocabularies", () => {
		expect(FilterUnitKindValues).toEqual(UnitKindValues);
		expect(FilterPostKindValues).toEqual(PostKindValues);
		expect(FilterContentLanguageValues).toEqual(ContentLanguageValues);
		expect(FilterRealmUnitStatusValues).toEqual(RealmUnitStatusValues);
		expect(FilterRealmUnitPublicationStateValues).toEqual(RealmUnitPublicationStateValues);
	});

	it("round-trips the standard Feed selection without widening it", () => {
		const filter = createSimpleFeedFilter({
			contentKinds: ["unit:book", "post:review"],
			languages: ["zh", "en"],
			realmIds: [RealmId],
			tagIds: [TagId],
		});

		expect(filter).toBeDefined();
		expect(readSimpleFeedFilter(filter)).toEqual({
			contentKinds: ["unit:book", "post:review"],
			languages: ["zh", "en"],
			realmIds: [RealmId],
			tagIds: [TagId],
		});
		expect(filter).toMatchObject({
			all: expect.arrayContaining([
				{
					realms: {
						some: {
							realm: { id: { in: [RealmId] } },
							status: { in: ["visible"] },
							publicationState: { in: ["active"] },
						},
					},
				},
			]),
		});
	});

	it("compiles Feed Realm intent through the public Filter schema", () => {
		const filter = createSimpleFeedFilter({ realmIds: [RealmId] });
		if (!filter) throw new Error("Expected a Realm Filter");
		const query = dialect.sqlToQuery(
			compileUnitPredicateSql(filter, {
				unitId: sql`candidate.id`,
				unitKind: sql`candidate.kind`,
			}),
		);

		expect(query.sql).toContain("filter_realm_unit.publication_state");
		expect(query.params).toEqual([RealmId, "visible", "active"]);
	});

	it("builds the standard content selection as Unit-or-Post eligibility", () => {
		expect(
			createSimpleFeedFilter({
				contentKinds: ["post:review", "unit:media", "unit:book", "unit:book"],
			}),
		).toEqual({
			any: [{ kind: { in: ["book", "media"] } }, { post: { is: { kind: { in: ["review"] } } } }],
		});
	});

	it("omits content eligibility after clearing the selection", () => {
		expect(createSimpleFeedFilter({ contentKinds: [] })).toBeUndefined();
		expect(SimpleFeedContentKindValues).not.toContain("post:reply");
	});

	it("requires canonical BCP 47 tags for content-consumption filters", () => {
		expect(() =>
			assertUnitPredicate({
				contentLanguageSupport: { some: { languageTag: "zh-Hant", channel: "text" } },
			}),
		).not.toThrow();
		expect(() =>
			assertUnitPredicate({
				contentLanguageSupport: { some: { languageTag: "zh-hant", channel: "text" } },
			}),
		).toThrow("canonical BCP 47 casing");
	});

	it("compiles content-consumption language and channel through the reverse projection", () => {
		const filter = {
			contentLanguageSupport: { some: { languageTag: "zh-Hant", channel: "text" } },
		} satisfies UnitPredicate;
		const eligibility = dialect.sqlToQuery(
			compileUnitPredicateSql(filter, {
				unitId: sql`candidate.id`,
				unitKind: sql`candidate.kind`,
			}),
		);
		const candidates = compileUnitPredicateCandidateSet(filter);
		if (!candidates) throw new Error("Expected content-language candidate projection");
		const candidateQuery = dialect.sqlToQuery(candidates);

		expect(eligibility.sql).toContain("unit_content_language_search");
		expect(eligibility.sql).toContain("filter_content_language.channel_mask in");
		expect(eligibility.params).toEqual(["zh-Hant", 1, 3, 5, 7, 9, 11, 13, 15]);
		expect(candidateQuery.sql).toContain("unit_content_language_search");
		expect(candidateQuery.params).toEqual(["zh-Hant", 1, 3, 5, 7, 9, 11, 13, 15]);
	});

	it("canonicalizes object key order for cursor identity", () => {
		expect(
			canonicalUnitPredicate({
				kind: { in: ["book"] },
				id: { in: [RealmId] },
			}),
		).toBe(
			canonicalUnitPredicate({
				id: { in: [RealmId] },
				kind: { in: ["book"] },
			}),
		);
	});

	it("rejects inverted Score ranges at the runtime JSON boundary", () => {
		expect(() =>
			assertUnitPredicate({
				scores: {
					received: {
						some: { value: { range: { minimum: 9, maximum: 3 } } },
					},
				},
			}),
		).toThrow("minimum exceeds maximum");
	});

	it("accepts Post subjects and Collection items as typed Unit references", () => {
		expect(() =>
			assertUnitPredicate({
				any: [
					{ post: { is: { subject: { is: { kind: { in: ["book"] } } } } } },
					{
						collection: {
							is: { items: { some: { kind: { in: ["book"] } } } },
						},
					},
				],
			}),
		).not.toThrow();
	});

	it("filters Feed Units by publisher credit rather than access ownership", () => {
		expect(() =>
			assertUnitPredicate({
				publishers: {
					some: { kind: "profile", id: { in: [RealmId] } },
				},
			}),
		).not.toThrow();
	});

	it("accepts credited-Entity and subject-Entity relations at the runtime boundary", () => {
		const filter = {
			any: [
				{ creditAttributions: { some: { id: { in: [RealmId] } } } },
				{ subjectAssociations: { some: { id: { in: [RealmId] } } } },
			],
		};

		expect(() => assertUnitPredicate(filter)).not.toThrow();
		expect(collectUnitPredicateReferenceIds(filter)).toEqual([RealmId]);
	});

	it("compiles credited-Entity and subject-Entity relations as indexed membership checks", () => {
		const query = dialect.sqlToQuery(
			compileUnitPredicateSql(
				{
					any: [
						{ creditAttributions: { some: { id: { in: [RealmId] } } } },
						{ subjectAssociations: { some: { id: { in: [RealmId] } } } },
					],
				},
				{ unitId: sql`candidate.id`, unitKind: sql`candidate.kind` },
			),
		);

		expect(query.sql).toContain("from credit_attribution filter_credit_attribution");
		expect(query.sql).toContain("candidate.id in");
		expect(query.sql).toContain("select filter_credit_attribution.source_unit_id");
		expect(query.sql).toContain("from subject_association filter_subject_association");
		expect(query.sql).toContain("select filter_subject_association.unit_id");
		expect(query.params).toEqual([RealmId, RealmId]);
	});

	it("derives an indexed union seed only when every OR branch is safely seedable", () => {
		const candidateSet = compileUnitPredicateCandidateSet({
			any: [
				{ creditAttributions: { some: { id: { in: [RealmId] } } } },
				{ subjectAssociations: { some: { id: { in: [RealmId] } } } },
			],
		});
		if (!candidateSet) throw new Error("Expected a relation-driven candidate set");
		const query = dialect.sqlToQuery(candidateSet);

		expect(query.sql).toContain("filter_credit_attribution.source_unit_id as unit_id");
		expect(query.sql).toContain(" union ");
		expect(query.sql).toContain("filter_subject_association.unit_id");
		expect(query.params).toEqual([RealmId, RealmId]);
		expect(
			compileUnitPredicateCandidateSet({
				any: [
					{ creditAttributions: { some: { id: { in: [RealmId] } } } },
					{ kind: { in: ["book"] } },
				],
			}),
		).toBeUndefined();
	});

	it("derives bounded reverse-index seeds for every sparse relationship filter", () => {
		const cases: readonly {
			readonly filter: UnitPredicate;
			readonly table: string;
			readonly column: string;
		}[] = [
			{
				filter: {
					tags: {
						some: {
							tag: { id: { in: [TagId] } },
							authority: { kind: "global", view: { kind: "effective" } },
						},
					},
				},
				table: "current_unit_effective_tag",
				column: "filter_effective_tag.tag_id",
			},
			{
				filter: { scores: { received: { some: { realm: { id: { in: [RealmId] } } } } } },
				table: "score filter_candidate_score",
				column: "filter_candidate_score.realm_id",
			},
			{
				filter: { post: { is: { subject: { is: { id: { in: [RealmId] } } } } } },
				table: "post filter_candidate_post",
				column: "filter_candidate_post.subject_unit_id",
			},
			{
				filter: { collection: { is: { items: { some: { id: { in: [RealmId] } } } } } },
				table: "collection_item filter_candidate_collection_item",
				column: "filter_candidate_collection_item.unit_id",
			},
		];

		for (const { filter, table, column } of cases) {
			const candidateSet = compileUnitPredicateCandidateSet(filter);
			if (!candidateSet) throw new Error(`Expected a bounded candidate set for ${table}`);
			const query = dialect.sqlToQuery(candidateSet);
			expect(query.sql).toContain(table);
			expect(query.sql).toContain(column);
		}
	});

	it("does not materialize low-selectivity Filter dimensions without an equality anchor", () => {
		expect(
			compileUnitPredicateCandidateSet({
				localizations: { some: { language: { in: ["en"] } } },
			}),
		).toBeUndefined();
		expect(
			compileUnitPredicateCandidateSet({
				creditAttributions: { some: { kind: { in: ["profile"] } } },
			}),
		).toBeUndefined();
		expect(
			compileUnitPredicateCandidateSet({
				any: [{ tags: { some: { tag: { id: { in: [TagId] } } } } }, { kind: { in: ["book"] } }],
			}),
		).toBeUndefined();
	});

	it("requires positive fit evidence for aggregate-backed Tag assertions", () => {
		const cases: readonly {
			readonly filter: UnitPredicate;
			readonly voteCountGuard: string;
		}[] = [
			{
				filter: {
					tags: {
						some: {
							tag: { id: { in: [TagId] } },
							authority: {
								kind: "global",
								view: {
									kind: "effective",
									consensus: { score: { range: { minimum: 0 } } },
								},
							},
						},
					},
				},
				voteCountGuard: "filter_tag_stat.vote_count > 0",
			},
			{
				filter: {
					tags: {
						some: {
							tag: { id: { in: [TagId] } },
							authority: {
								kind: "realm",
								realm: { id: { in: [RealmId] } },
								view: { kind: "community" },
							},
						},
					},
				},
				voteCountGuard: "filter_realm_tag_stat.vote_count > 0",
			},
		];

		for (const { filter, voteCountGuard } of cases) {
			const query = dialect.sqlToQuery(
				compileUnitPredicateSql(filter, {
					unitId: sql`candidate.id`,
					unitKind: sql`candidate.kind`,
				}),
			);

			expect(query.sql).toContain(voteCountGuard);
		}
	});

	it("excludes spoiler-only Realm community aggregates from candidate seeds", () => {
		const candidateSet = compileUnitPredicateCandidateSet({
			tags: {
				some: {
					tag: { id: { in: [TagId] } },
					authority: {
						kind: "realm",
						realm: { id: { in: [RealmId] } },
						view: { kind: "community" },
					},
				},
			},
		});
		if (!candidateSet) throw new Error("Expected a Realm community candidate set");
		const query = dialect.sqlToQuery(candidateSet);

		expect(query.sql).toContain("filter_realm_tag_stat.vote_count > 0");
		expect(query.params).toEqual([RealmId, TagId]);
	});

	it("maps Realm taxonomy query strategies to independent Tag authorities", () => {
		expect(
			realmTagQueryPredicate({
				realmId: RealmId,
				tagId: TagId,
				strategy: "global_effective",
			}),
		).toEqual({
			tags: {
				some: {
					tag: { id: { in: [TagId] } },
					authority: { kind: "global", view: { kind: "effective" } },
				},
			},
		});
		expect(
			realmTagQueryPredicate({
				realmId: RealmId,
				tagId: TagId,
				strategy: "realm_community",
			}),
		).toMatchObject({
			tags: {
				some: {
					authority: {
						kind: "realm",
						view: {
							kind: "community",
							consensus: { score: { range: { minimum: 1 } } },
						},
					},
				},
			},
		});
		expect(
			realmTagQueryPredicate({
				realmId: RealmId,
				tagId: TagId,
				strategy: "realm_policy",
			}),
		).toMatchObject({
			tags: {
				some: {
					authority: {
						kind: "realm",
						view: { kind: "policy" },
					},
				},
			},
		});
	});

	it("accepts Realm Tag explanation filters at the runtime boundary", () => {
		expect(() =>
			assertUnitPredicate({
				post: {
					is: {
						explainsRealmTag: {
							realm: { id: { in: [RealmId] } },
							tag: { id: { in: [TagId] } },
						},
					},
				},
			}),
		).not.toThrow();
	});

	it("does not reinterpret an advanced Filter as standard Feed UI state", () => {
		expect(
			readSimpleFeedFilter({
				any: [{ kind: { in: ["book"] } }, { kind: { in: ["media"] } }],
			}),
		).toBeUndefined();
	});

	it("keeps service-backed Search positive and outside recursive predicates", () => {
		const filter = parseUnitFilter({
			search: { query: "distributed systems" },
			where: { kind: { in: ["book"] } },
		});

		expect(() => assertUnitFilter(filter)).not.toThrow();
		expect(unitFilterSearchQuery(filter)).toBe("distributed systems");
		expect(() =>
			assertUnitFilter({
				where: { not: { search: { query: "cannot be nested" } } },
			}),
		).toThrow("Invalid Unit filter");
	});

	it("composes Feed selections into the same Filter without replacing Search", () => {
		const content = createSimpleFeedFilter({ contentKinds: ["post:review"] });
		const filter = mergeUnitFilter({ search: { query: "architecture" } }, content);

		expect(filter).toEqual({
			search: { query: "architecture" },
			where: { post: { is: { kind: { in: ["review"] } } } },
		});
	});
});
