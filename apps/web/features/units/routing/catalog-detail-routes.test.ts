import { describe, expect, it } from "vitest";

import { CatalogDetailSections } from "../model/catalog-detail-section";
import {
	catalogCreditsHref,
	catalogDetailHref,
	catalogExcerptsHref,
	catalogQuestionsHref,
	catalogReviewsHref,
	catalogTagsHref,
	getCatalogDetailHrefs,
	parseCatalogDetailSection,
} from "./catalog-detail-routes";

const UnitId = "019b76da-a800-7300-8000-000000000001";

describe("catalog detail routes", () => {
	it("keeps the overview at the immutable Unit identity route", () => {
		expect(catalogDetailHref("book", UnitId)).toBe(`/units/book/${UnitId}`);
		expect(parseCatalogDetailSection(`/units/book/${UnitId}`, "book", UnitId)).toBe("overview");
	});

	it("builds every domain-specific tab as a distinct page", () => {
		for (const type of ["book", "media", "software"] as const) {
			expect(getCatalogDetailHrefs(type, UnitId).map(({ id }) => id)).toEqual(
				CatalogDetailSections[type],
			);
		}
		expect(catalogDetailHref("book", UnitId, "contents")).toBe(
			`/units/book/${UnitId}/contents`,
		);
		expect(catalogDetailHref("media", UnitId, "contents")).toBe(
			`/units/media/${UnitId}/contents`,
		);
		expect(catalogDetailHref("software", UnitId, "requirements")).toBe(
			`/units/software/${UnitId}/requirements`,
		);
		expect(catalogDetailHref("book", UnitId, "associations")).toBe(
			`/units/book/${UnitId}/associations`,
		);
		expect(catalogDetailHref("book", UnitId, "collections")).toBe(
			`/units/book/${UnitId}/collections`,
		);
	});

	it("rejects a section that belongs to another domain", () => {
		expect(
			parseCatalogDetailSection(`/units/media/${UnitId}/requirements`, "media", UnitId),
		).toBeUndefined();
		expect(
			parseCatalogDetailSection(`/units/book/${UnitId}/requirements`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseCatalogDetailSection(`/units/book/${UnitId}/reviews/extra`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseCatalogDetailSection(`/units/book/${UnitId}/editions`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseCatalogDetailSection(`/units/media/${UnitId}/versions`, "media", UnitId),
		).toBeUndefined();
	});

	it("keeps dedicated pages outside the tab section registry", () => {
		expect(catalogCreditsHref("book", UnitId)).toBe(`/units/book/${UnitId}/credits`);
		expect(parseCatalogDetailSection(catalogCreditsHref("book", UnitId), "book", UnitId)).toBe(
			undefined,
		);
		expect(CatalogDetailSections.book).not.toContain("credits");
		expect(CatalogDetailSections.book).not.toContain("tags");
		expect(CatalogDetailSections.book).not.toContain("reviews");
		expect(catalogReviewsHref("book", UnitId)).toBe(`/units/book/${UnitId}/reviews`);
		expect(catalogExcerptsHref("book", UnitId)).toBe(`/units/book/${UnitId}/excerpts`);
		expect(catalogQuestionsHref("book", UnitId)).toBe(`/units/book/${UnitId}/questions`);
		expect(catalogTagsHref("book", UnitId)).toBe(`/units/book/${UnitId}/tags`);
	});
});
