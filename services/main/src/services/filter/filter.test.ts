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
import { compileUnitPredicateSql } from "./sql";

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
			any: [
				{ kind: { in: ["book", "media"] } },
				{ post: { is: { kind: { in: ["review"] } } } },
			],
		});
	});

	it("omits content eligibility after clearing the selection", () => {
		expect(createSimpleFeedFilter({ contentKinds: [] })).toBeUndefined();
		expect(SimpleFeedContentKindValues).not.toContain("post:reply");
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

	it("compiles credited-Entity and subject-Entity relations as indexed existence checks", () => {
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
		expect(query.sql).toContain("filter_credit_attribution.source_unit_id = candidate.id");
		expect(query.sql).toContain("from subject_association filter_subject_association");
		expect(query.sql).toContain("filter_subject_association.unit_id = candidate.id");
		expect(query.params).toEqual([RealmId, RealmId]);
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
