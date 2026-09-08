import { describe, expect, it } from "vitest";

import { classifyPublicUnitSeoIndexing, isPublicUnitSeoOwner } from "./seo-contract";

describe("public Unit SEO contract", () => {
	it.each(["general", "r15"] as const)(
		"indexes a public %s Unit with a presentation",
		(contentRating) => {
			expect(
				classifyPublicUnitSeoIndexing({
					contentRating,
					visibility: "public",
					hasPresentation: true,
				}),
			).toEqual({ state: "index" });
		},
	);

	it.each(["r18", "r18g"] as const)(
		"blocks %s before presentation data is used",
		(contentRating) => {
			expect(
				classifyPublicUnitSeoIndexing({
					contentRating,
					visibility: "public",
					hasPresentation: true,
				}),
			).toEqual({ state: "noindex", reason: "adult" });
		},
	);

	it("keeps unlisted and incomplete Units out of the index", () => {
		expect(
			classifyPublicUnitSeoIndexing({
				contentRating: "general",
				visibility: "unlisted",
				hasPresentation: true,
			}),
		).toEqual({ state: "noindex", reason: "unlisted" });
		expect(
			classifyPublicUnitSeoIndexing({
				contentRating: "r15",
				visibility: "public",
				hasPresentation: false,
			}),
		).toEqual({ state: "noindex", reason: "incomplete" });
	});

	it("covers every Unit kind with a public landing route and excludes internal-only kinds", () => {
		for (const owner of [
			"publishing",
			"music",
			"program",
			"software",
			"entity",
			"grouping",
			"reference",
			"distribution",
			"video",
			"audio",
			"post",
			"poll",
			"zone",
			"realm",
			"collection",
			"tag",
		])
			expect(isPublicUnitSeoOwner(owner)).toBe(true);

		for (const kind of ["slug_namespace", "label", "realm_rule", "tag_path"] as const)
			expect(isPublicUnitSeoOwner(kind)).toBe(false);
	});
});
