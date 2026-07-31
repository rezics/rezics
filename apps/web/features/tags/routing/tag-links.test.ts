import { describe, expect, it } from "vitest";

import {
	getTagDetailHrefs,
	loadUnitTagsRouteState,
	parseTagDetailSection,
	parseTagManagementSection,
	tagDetailHref,
	tagManagementHref,
	tagSearchHref,
	unitTagsHref,
} from "./tag-links";

const UnitId = "00000000-0000-7000-8000-000000000001";
const RealmId = "00000000-0000-7000-8000-000000000002";
const TagId = "00000000-0000-7000-8000-000000000003";

describe("tagSearchHref", () => {
	it("serializes one Tag through the shared search URL contract", () => {
		expect(tagSearchHref("book", [{ tagId: "tag-a", label: "Fantasy" }])).toBe(
			"/search?template=book&tag=tag-a&tagLabel=Fantasy",
		);
	});

	it("keeps multiple Tag identities aligned and removes duplicates", () => {
		expect(
			tagSearchHref("media", [
				{ tagId: "tag-a", label: "Fantasy" },
				{ tagId: "tag-b", label: "Mystery" },
				{ tagId: "tag-a", label: "Fantasy duplicate" },
			]),
		).toBe("/search?template=media&tag=tag-a,tag-b&tagLabel=Fantasy+duplicate,Mystery");
	});

	it("uses the global search template for a series", () => {
		expect(tagSearchHref("series", [{ tagId: "tag-a", label: "Fantasy" }])).toBe(
			"/search?tag=tag-a&tagLabel=Fantasy",
		);
	});
});

describe("Unit Tag page routes", () => {
	it("round-trips a Realm context and newly created Tag", async () => {
		const href = unitTagsHref("book", UnitId, {
			context: { kind: "realm", realmId: RealmId },
			createdTagId: TagId,
		});
		const url = new URL(href, "https://rezics.example");

		expect(url.pathname).toBe(`/units/book/${UnitId}/tags`);
		await expect(loadUnitTagsRouteState(Object.fromEntries(url.searchParams))).resolves.toEqual(
			{
				context: { kind: "realm", realmId: RealmId },
				createdTagId: TagId,
			},
		);
	});

	it("falls back to global context and ignores invalid identifiers", async () => {
		await expect(
			loadUnitTagsRouteState({
				context: "realm",
				realmId: "not-a-realm",
				createdTagId: "not-a-tag",
			}),
		).resolves.toEqual({ context: { kind: "global" } });
	});
});

describe("Tag detail routes", () => {
	it("keeps Discussion as the Tag-owned second tab", () => {
		expect(getTagDetailHrefs(TagId)).toEqual([
			{ id: "overview", href: `/tags/${TagId}` },
			{ id: "discussion", href: `/tags/${TagId}/discussion` },
			{ id: "content", href: `/tags/${TagId}/content` },
			{ id: "structure", href: `/tags/${TagId}/structure` },
		]);
	});

	it("round-trips Tag detail sections without accepting nested routes", () => {
		const href = tagDetailHref(TagId, "discussion");
		expect(parseTagDetailSection(href, TagId)).toBe("discussion");
		expect(parseTagDetailSection(`${href}/nested`, TagId)).toBeUndefined();
	});
});

describe("Tag management routes", () => {
	it("keeps the content editor inside the shared management workspace", () => {
		const href = tagManagementHref(TagId, "content");
		expect(href).toBe(`/tags/${TagId}/edit/content`);
		expect(parseTagManagementSection(href, TagId)).toBe("content");
		expect(parseTagManagementSection(`${href}/nested`, TagId)).toBeUndefined();
	});
});
