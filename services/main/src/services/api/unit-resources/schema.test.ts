import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";

import { UnitOwnerValues } from "@rezics/reference";
import {
	AttributionUnitParams,
	AddUnitExternalLinkBody,
	UnitExternalLinkParams,
	UnitExternalLinkUnitParams,
	UnitTagParams,
	UpdateUnitReferenceCurationBody,
	UpdateUnitTagCurationBody,
} from "./schema";

describe("Unit resource API schemas", () => {
	it("accepts Entity as a generic Tag owner", () => {
		expect(
			Value.Check(UnitTagParams, {
				owner: "entity",
				unitId: "018ff2b7-7c00-7000-8000-000000000001",
				tagId: "018ff2b7-7c00-7000-8000-000000000002",
			}),
		).toBe(true);
	});

	it("accepts every registered generic credit attribution owner", () => {
		for (const owner of UnitOwnerValues)
			expect(
				Value.Check(AttributionUnitParams, {
					owner,
					unitId: "018ff2b7-7c00-7000-8000-000000000001",
				}),
			).toBe(true);
		expect(
			Value.Check(AttributionUnitParams, {
				owner: "unknown-owner",
				unitId: "018ff2b7-7c00-7000-8000-000000000001",
			}),
		).toBe(false);
	});

	it("accepts only structured external-link fields", () => {
		const externalLink = {
			url: "https://example.test/units/book",
			sourceEntityId: "018ff2b7-7c00-7000-8000-000000000001",
		};
		expect(Value.Check(AddUnitExternalLinkBody, externalLink)).toBe(true);
		expect(Value.Check(AddUnitExternalLinkBody, { ...externalLink, position: "a0" })).toBe(false);
		expect(Value.Check(AddUnitExternalLinkBody, { ...externalLink, role: "official" })).toBe(false);
		expect(
			Value.Check(AddUnitExternalLinkBody, {
				...externalLink,
				fallbackText: "Official page",
			}),
		).toBe(false);
		expect(Value.Check(AddUnitExternalLinkBody, { ...externalLink, label: "Official page" })).toBe(
			false,
		);
		expect(
			Value.Check(AddUnitExternalLinkBody, {
				...externalLink,
				url: "ftp://example.test/book",
			}),
		).toBe(false);
		expect(
			Value.Check(AddUnitExternalLinkBody, {
				...externalLink,
				url: "HTTPS://EXAMPLE.TEST/units/book",
			}),
		).toBe(true);
		expect(
			Value.Check(AddUnitExternalLinkBody, {
				...externalLink,
				url: `https://example.test/${"a".repeat(2_000)}`,
			}),
		).toBe(true);
	});

	it("accepts every registered Unit kind as a external-link owner", () => {
		for (const owner of UnitOwnerValues)
			expect(
				Value.Check(UnitExternalLinkUnitParams, {
					owner,
					unitId: "018ff2b7-7c00-7000-8000-000000000001",
				}),
			).toBe(true);
		expect(
			Value.Check(UnitExternalLinkUnitParams, {
				owner: "unknown-owner",
				unitId: "018ff2b7-7c00-7000-8000-000000000001",
			}),
		).toBe(false);
	});

	it("requires a Unit-scoped link identifier for external-link voting and curation", () => {
		for (const owner of UnitOwnerValues)
			expect(
				Value.Check(UnitExternalLinkParams, {
					owner,
					unitId: "018ff2b7-7c00-7000-8000-000000000001",
					externalLinkId: "018ff2b7-7c00-7000-8000-000000000002",
				}),
			).toBe(true);
		expect(
			Value.Check(UnitExternalLinkParams, {
				owner: "unknown-owner",
				unitId: "018ff2b7-7c00-7000-8000-000000000001",
				externalLinkId: "not-a-unit-link-id",
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
