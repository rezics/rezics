import { describe, expect, it } from "vitest";

import {
	entityCommunityUnitSearchSubject,
	parseCommunityUnitSearchSubject,
	communityUnitCreationHref,
	communityUnitSearchHref,
	communityUnitSearchResultHref,
	TagCommunityUnitSearchSubject,
	unitCommunityUnitSearchSubject,
} from "./community-unit-search";

describe("unit public-entry search subjects", () => {
	it("keeps each public-entry type aligned with its exact search domain", () => {
		expect(unitCommunityUnitSearchSubject("book")).toEqual({
			filterKind: "book",
			kind: "book",
			searchIndex: "units",
			section: "book",
		});
		expect(entityCommunityUnitSearchSubject("organization")).toEqual({
			filterKind: "organization",
			kind: "organization",
			searchIndex: "entities",
			section: "entity",
		});
		expect(TagCommunityUnitSearchSubject).toEqual({
			kind: "tag",
			searchIndex: "tags",
			section: "tag",
		});
	});

	it("rejects a route whose section and kind do not describe the same subject", () => {
		expect(parseCommunityUnitSearchSubject("book", "software")).toBeUndefined();
		expect(parseCommunityUnitSearchSubject("entity", "entity")).toBeUndefined();
		expect(parseCommunityUnitSearchSubject("tag", undefined)).toBeUndefined();
		expect(parseCommunityUnitSearchSubject("entity", "character")).toEqual(
			entityCommunityUnitSearchSubject("character"),
		);
	});
});

describe("public-entry search routes", () => {
	it("carries the exact subject and current title into Studio search", () => {
		expect(communityUnitSearchHref(unitCommunityUnitSearchSubject("media"), "  The Bear  ")).toBe(
			"/create/media/search?kind=media&q=The+Bear",
		);
		expect(communityUnitSearchHref(entityCommunityUnitSearchSubject("person"), "")).toBe(
			"/create/entity/search?kind=person",
		);
	});

	it("returns to the correct creator after an optional duplicate search", () => {
		const href = communityUnitCreationHref(
			entityCommunityUnitSearchSubject("organization"),
			"OpenAI",
		);
		const url = new URL(href, "https://rezics.example");

		expect(url.pathname).toBe("/entities/new");
		expect(url.searchParams.get("ownershipMode")).toBe("community_owned");
		expect(url.searchParams.get("kind")).toBe("organization");
		expect(url.searchParams.get("title")).toBe("OpenAI");
		expect(url.searchParams.get("communityUnitSearch")).toBeNull();
	});

	it("keeps Tag creation inside Studio", () => {
		const href = communityUnitCreationHref(TagCommunityUnitSearchSubject, "Science");
		const url = new URL(href, "https://rezics.example");

		expect(url.pathname).toBe("/create/tag/new");
		expect(url.searchParams.get("title")).toBe("Science");
	});

	it("links search hits to the subject's public detail route", () => {
		expect(
			communityUnitSearchResultHref(unitCommunityUnitSearchSubject("software"), "unit-id"),
		).toBe("/units/software/unit-id");
		expect(communityUnitSearchResultHref(TagCommunityUnitSearchSubject, "tag-id")).toBe(
			"/tags/tag-id",
		);
	});
});
