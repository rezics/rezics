import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { UnitKindValues } from "../../database/schema/contract-values";
import {
	AddUnitLinkBody,
	ListEntityEntriesQuery,
	UnitSourceLinkParams,
	UnitSourceLinkUnitParams,
	UpdateUnitTagCurationBody,
} from "./schema";

describe("Unit resource API schemas", () => {
	it("accepts only direct-permission or public credit Entity searches", () => {
		expect(
			Value.Check(ListEntityEntriesQuery, {
				creditAttributionSearch: "direct",
				query: "Studio",
			}),
		).toBe(true);
		expect(
			Value.Check(ListEntityEntriesQuery, {
				creditAttributionSearch: "public",
				query: "Studio",
			}),
		).toBe(true);
		expect(
			Value.Check(ListEntityEntriesQuery, {
				creditAttributionSearch: "owner",
				query: "Studio",
			}),
		).toBe(false);
	});

	it("accepts only structured source-link fields", () => {
		const sourceLink = {
			url: "https://example.test/units/book",
			sourceEntityUnitId: "018ff2b7-7c00-7000-8000-000000000001",
		};
		expect(Value.Check(AddUnitLinkBody, sourceLink)).toBe(true);
		expect(Value.Check(AddUnitLinkBody, { ...sourceLink, position: "a0" })).toBe(true);
		expect(Value.Check(AddUnitLinkBody, { ...sourceLink, role: "official" })).toBe(false);
		expect(Value.Check(AddUnitLinkBody, { ...sourceLink, fallbackText: "Official page" })).toBe(
			false,
		);
		expect(Value.Check(AddUnitLinkBody, { ...sourceLink, label: "Official page" })).toBe(false);
		expect(
			Value.Check(AddUnitLinkBody, { ...sourceLink, url: "ftp://example.test/book" }),
		).toBe(false);
		expect(
			Value.Check(AddUnitLinkBody, {
				...sourceLink,
				url: "HTTPS://EXAMPLE.TEST/units/book",
			}),
		).toBe(true);
		expect(
			Value.Check(AddUnitLinkBody, {
				...sourceLink,
				url: `https://example.test/${"a".repeat(2_000)}`,
			}),
		).toBe(true);
	});

	it("accepts every registered Unit kind as a source-link owner", () => {
		for (const type of UnitKindValues)
			expect(
				Value.Check(UnitSourceLinkUnitParams, {
					type,
					unitId: "018ff2b7-7c00-7000-8000-000000000001",
				}),
			).toBe(true);
		expect(
			Value.Check(UnitSourceLinkUnitParams, {
				type: "unknown",
				unitId: "018ff2b7-7c00-7000-8000-000000000001",
			}),
		).toBe(false);
	});

	it("requires a Unit-scoped link identifier for source-link removal", () => {
		for (const type of UnitKindValues)
			expect(
				Value.Check(UnitSourceLinkParams, {
					type,
					unitId: "018ff2b7-7c00-7000-8000-000000000001",
					linkId: "018ff2b7-7c00-7000-8000-000000000002",
				}),
			).toBe(true);
		expect(
			Value.Check(UnitSourceLinkParams, {
				type: "profile",
				unitId: "018ff2b7-7c00-7000-8000-000000000001",
				linkId: "not-a-unit-link-id",
			}),
		).toBe(false);
	});

	it("requires a position exactly when a Unit Tag is pinned", () => {
		const updatedAt = "2026-07-28T12:00:00.000Z";
		const expectedFeaturedTagIds = ["018ff2b7-7c00-7000-8000-000000000001"];
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: true,
				position: "a0",
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: false,
				position: null,
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: true,
				position: null,
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(false);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: false,
				position: "a0",
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(false);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: false,
				position: null,
				updatedAt,
				expectedFeaturedTagIds,
				score: 10,
			}),
		).toBe(false);
	});
});
