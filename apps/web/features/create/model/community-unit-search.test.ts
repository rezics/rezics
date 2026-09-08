import { describe, expect, it } from "vitest";
import {
	nativeCommunityUnitSearchSubject,
	entityCommunityUnitSearchSubject,
	parseCommunityUnitSearchSubject,
	communityUnitCreationHref,
	communityUnitSearchHref,
	communityUnitSearchResultHref,
	TagCommunityUnitSearchSubject,
} from "./community-unit-search";
describe("native duplicate-search routes", () => {
	it("keeps owner and shape independent", () => {
		expect(nativeCommunityUnitSearchSubject("publishing", "text_version")).toEqual({
			owner: "publishing",
			shape: "text_version",
			section: "publishing",
			searchIndex: "units",
		});
		expect(entityCommunityUnitSearchSubject("organization")).toEqual({
			owner: "entity",
			shape: "organization",
			section: "entity",
			searchIndex: "entities",
		});
	});
	it("rejects retired owner routes and malformed shape input", () => {
		expect(parseCommunityUnitSearchSubject("book", "work")).toBeUndefined();
		expect(parseCommunityUnitSearchSubject("publishing", "../../work")).toBeUndefined();
		expect(parseCommunityUnitSearchSubject("tag")).toEqual(TagCommunityUnitSearchSubject);
	});
	it("carries precise shape and text into search", () => {
		expect(
			communityUnitSearchHref(nativeCommunityUnitSearchSubject("program", "program"), " The Bear "),
		).toBe("/create/program/search?shape=program&q=The+Bear");
		expect(communityUnitSearchHref(entityCommunityUnitSearchSubject("person"), "")).toBe(
			"/create/entity/search?shape=person",
		);
	});
	it("returns to creation without imposing old ownership", () => {
		const url = new URL(
			communityUnitCreationHref(entityCommunityUnitSearchSubject("organization"), "Example"),
			"https://example.test",
		);
		expect(url.pathname).toBe("/create/entity/new");
		expect(url.searchParams.get("shape")).toBe("organization");
		expect(url.searchParams.get("ownershipMode")).toBeNull();
	});
	it("uses native public addresses for search results", () => {
		expect(
			communityUnitSearchResultHref(
				nativeCommunityUnitSearchSubject("software", "content"),
				"item",
			),
		).toBe("/catalog/software/item");
		expect(communityUnitSearchResultHref(TagCommunityUnitSearchSubject, "tag")).toBe("/tags/tag");
	});
});
