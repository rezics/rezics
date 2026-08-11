import { describe, expect, it } from "vitest";

import { UnitDetailSections } from "../model/unit-detail-section";
import {
	unitCreditsHref,
	unitDetailHref,
	unitExcerptsHref,
	unitQuestionsHref,
	unitReviewsHref,
	unitTagsHref,
	getUnitDetailHrefs,
	parseUnitDetailSection,
} from "./unit-detail-routes";

const UnitId = "019b76da-a800-7300-8000-000000000001";

describe("unit detail routes", () => {
	it("keeps the overview at the immutable Unit identity route", () => {
		expect(unitDetailHref("book", UnitId)).toBe(`/units/book/${UnitId}`);
		expect(parseUnitDetailSection(`/units/book/${UnitId}`, "book", UnitId)).toBe("overview");
	});

	it("builds every domain-specific tab as a distinct page", () => {
		for (const type of ["book", "media", "software", "series"] as const) {
			expect(getUnitDetailHrefs(type, UnitId).map(({ id }) => id)).toEqual(
				UnitDetailSections[type],
			);
		}
		expect(unitDetailHref("book", UnitId, "contents")).toBe(`/units/book/${UnitId}/contents`);
		expect(unitDetailHref("media", UnitId, "contents")).toBe(`/units/media/${UnitId}/contents`);
		expect(unitDetailHref("software", UnitId, "requirements")).toBe(
			`/units/software/${UnitId}/requirements`,
		);
		expect(unitDetailHref("series", UnitId, "releases")).toBe(`/units/series/${UnitId}/releases`);
		expect(unitDetailHref("book", UnitId, "associations")).toBe(
			`/units/book/${UnitId}/associations`,
		);
		expect(unitDetailHref("book", UnitId, "collections")).toBe(`/units/book/${UnitId}/collections`);
	});

	it("rejects a section that belongs to another domain", () => {
		expect(
			parseUnitDetailSection(`/units/media/${UnitId}/requirements`, "media", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/book/${UnitId}/requirements`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/book/${UnitId}/reviews/extra`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/book/${UnitId}/editions`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/media/${UnitId}/versions`, "media", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/series/${UnitId}/contents`, "series", UnitId),
		).toBeUndefined();
	});

	it("keeps dedicated pages outside the tab section registry", () => {
		expect(unitCreditsHref("book", UnitId)).toBe(`/units/book/${UnitId}/credits`);
		expect(parseUnitDetailSection(unitCreditsHref("book", UnitId), "book", UnitId)).toBe(undefined);
		expect(UnitDetailSections.book).not.toContain("credits");
		expect(UnitDetailSections.book).not.toContain("tags");
		expect(UnitDetailSections.book).not.toContain("reviews");
		expect(unitReviewsHref("book", UnitId)).toBe(`/units/book/${UnitId}/reviews`);
		expect(unitExcerptsHref("book", UnitId)).toBe(`/units/book/${UnitId}/excerpts`);
		expect(unitQuestionsHref("book", UnitId)).toBe(`/units/book/${UnitId}/questions`);
		expect(unitTagsHref("book", UnitId)).toBe(`/units/book/${UnitId}/tags`);
	});
});
