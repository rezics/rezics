import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { EntityKindValues, UnitKindValues } from "../../database/schema/contract-values";
import {
	AddUnitLinkBody,
	CreateEntityBody,
	ListEntityEntriesQuery,
	UnitSourceLinkParams,
	UnitSourceLinkUnitParams,
	UpdateUnitReferenceCurationBody,
	UpdateUnitTagCurationBody,
} from "./schema";

describe("Unit resource API schemas", () => {
	it("accepts only the supported Entity kinds", () => {
		const localization = { language: "en", title: "Example" };
		for (const kind of EntityKindValues) {
			expect(
				Value.Check(CreateEntityBody, {
					ownershipMode: "profile_owned",
					kind,
					localization,
				}),
			).toBe(true);
			expect(Value.Check(ListEntityEntriesQuery, { kind })).toBe(true);
		}
		expect(
			Value.Check(CreateEntityBody, {
				ownershipMode: "profile_owned",
				kind: "platform",
				localization,
			}),
		).toBe(false);
		expect(Value.Check(ListEntityEntriesQuery, { kind: "platform" })).toBe(false);
	});

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
		expect(Value.Check(AddUnitLinkBody, { ...sourceLink, position: "a0" })).toBe(false);
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

	it("requires a Unit-scoped link identifier for source-link voting and curation", () => {
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

	it("requires a position exactly when a Unit reference is pinned", () => {
		expect(
			Value.Check(UpdateUnitReferenceCurationBody, {
				baseVersion: 0,
				pinned: true,
				position: "a0",
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateUnitReferenceCurationBody, {
				baseVersion: 2,
				pinned: false,
				position: null,
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateUnitReferenceCurationBody, {
				baseVersion: 0,
				pinned: true,
				position: null,
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
