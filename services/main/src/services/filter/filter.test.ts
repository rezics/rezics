import {
	assertUnitFilter,
	canonicalUnitFilter,
	createSimpleFeedFilter,
	FilterContentLanguageValues,
	FilterPostKindValues,
	FilterRealmUnitStatusValues,
	FilterUnitKindValues,
	readSimpleFeedFilter,
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
			languages: ["zh", "en"],
			realmIds: [RealmId],
			tagIds: [TagId],
		});

		expect(filter).toBeDefined();
		expect(readSimpleFeedFilter(filter)).toEqual({
			languages: ["zh", "en"],
			realmIds: [RealmId],
			tagIds: [TagId],
		});
	});

	it("canonicalizes object key order for cursor identity", () => {
		expect(
			canonicalUnitFilter({
				kind: { in: ["book"] },
				id: { in: [RealmId] },
			}),
		).toBe(
			canonicalUnitFilter({
				id: { in: [RealmId] },
				kind: { in: ["book"] },
			}),
		);
	});

	it("rejects inverted Score ranges at the runtime JSON boundary", () => {
		expect(() =>
			assertUnitFilter({
				scores: {
					received: {
						some: { value: { range: { minimum: 9, maximum: 3 } } },
					},
				},
			}),
		).toThrow("minimum exceeds maximum");
	});

	it("does not reinterpret an advanced Filter as standard Feed UI state", () => {
		expect(
			readSimpleFeedFilter({
				any: [{ kind: { in: ["book"] } }, { kind: { in: ["media"] } }],
			}),
		).toBeUndefined();
	});
});
