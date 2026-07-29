import {
	assertUnitPredicate,
	assertUnitFilter,
	canonicalUnitPredicate,
	createSimpleFeedFilter,
	FilterContentLanguageValues,
	FilterPostKindValues,
	FilterRealmUnitStatusValues,
	FilterUnitKindValues,
	mergeUnitFilter,
	parseUnitFilter,
	readSimpleFeedFilter,
	SimpleFeedContentKindValues,
	unitFilterSearchQuery,
} from "@rezics/filter";
import { describe, expect, it } from "vitest";
import {
	ContentLanguageValues,
	PostKindValues,
	RealmUnitStatusValues,
	UnitKindValues,
} from "../database/schema/contract-values";

const RealmId = "00000000-0000-4000-8000-000000000001";
const TagId = "00000000-0000-4000-8000-000000000002";

describe("domain Filter contract", () => {
	it("stays aligned with the canonical Unit, Post, and language vocabularies", () => {
		expect(FilterUnitKindValues).toEqual(UnitKindValues);
		expect(FilterPostKindValues).toEqual(PostKindValues);
		expect(FilterContentLanguageValues).toEqual(ContentLanguageValues);
		expect(FilterRealmUnitStatusValues).toEqual(RealmUnitStatusValues);
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
