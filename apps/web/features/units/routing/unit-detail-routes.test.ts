import { describe, expect, it } from "vitest";

import { UnitDetailSections, UnitDetailUnitTypes } from "../model/unit-detail-section";
import {
	bookReaderHref,
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
	it("addresses Reader context by content node occurrence", () => {
		expect(bookReaderHref(UnitId, "node-id")).toBe(`/catalog/publishing/${UnitId}/read/node-id`);
		expect(
			parseUnitDetailSection(`/units/book/${UnitId}/read/node-id`, "publishing", UnitId),
		).toBeUndefined();
	});

	it("keeps the overview at the immutable Unit identity route", () => {
		expect(unitDetailHref("publishing", UnitId)).toBe(`/catalog/publishing/${UnitId}`);
		expect(parseUnitDetailSection(`/catalog/publishing/${UnitId}`, "publishing", UnitId)).toBe(
			"overview",
		);
		expect(unitDetailHref("video", UnitId)).toBe(`/units/video/${UnitId}`);
		expect(parseUnitDetailSection(`/units/video/${UnitId}`, "video", UnitId)).toBe("overview");
		expect(parseUnitDetailSection(`/units/book/${UnitId}`, "publishing", UnitId)).toBeUndefined();
	});

	it("builds every domain-specific tab as a distinct page", () => {
		for (const type of UnitDetailUnitTypes) {
			expect(getUnitDetailHrefs(type, UnitId).map(({ id }) => id)).toEqual(
				UnitDetailSections[type],
			);
		}
		expect(unitDetailHref("publishing", UnitId, "contents")).toBe(
			`/catalog/publishing/${UnitId}/contents`,
		);
		expect(unitDetailHref("program", UnitId, "contents")).toBe(
			`/catalog/program/${UnitId}/contents`,
		);
		expect(unitDetailHref("software", UnitId, "facts")).toBe(`/catalog/software/${UnitId}/facts`);
		expect(unitDetailHref("grouping", UnitId, "facts")).toBe(`/catalog/grouping/${UnitId}/facts`);
		expect(unitDetailHref("publishing", UnitId, "associations")).toBe(
			`/catalog/publishing/${UnitId}/associations`,
		);
		expect(unitDetailHref("publishing", UnitId, "collections")).toBe(
			`/catalog/publishing/${UnitId}/collections`,
		);
		expect(unitDetailHref("audio", UnitId)).toBe(`/units/audio/${UnitId}`);
	});

	it("rejects a section that belongs to another domain", () => {
		expect(
			parseUnitDetailSection(`/catalog/program/${UnitId}/facts`, "program", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/catalog/publishing/${UnitId}/facts`, "publishing", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/catalog/publishing/${UnitId}/reviews/extra`, "publishing", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/catalog/publishing/${UnitId}/editions`, "publishing", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/video/${UnitId}/versions`, "video", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/catalog/grouping/${UnitId}/contents`, "grouping", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/media/${UnitId}/contents`, "program", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/software/${UnitId}/requirements`, "software", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/series/${UnitId}/releases`, "grouping", UnitId),
		).toBeUndefined();
		expect(
			parseUnitDetailSection(`/units/video/${UnitId}/contents`, "video", UnitId),
		).toBeUndefined();
	});

	it("keeps dedicated pages outside the tab section registry", () => {
		expect(unitCreditsHref("publishing", UnitId)).toBe(`/catalog/publishing/${UnitId}/credits`);
		expect(
			parseUnitDetailSection(unitCreditsHref("publishing", UnitId), "publishing", UnitId),
		).toBe(undefined);
		expect(UnitDetailSections.publishing).not.toContain("credits");
		expect(UnitDetailSections.publishing).not.toContain("tags");
		expect(UnitDetailSections.publishing).not.toContain("reviews");
		expect(unitReviewsHref("publishing", UnitId)).toBe(`/catalog/publishing/${UnitId}/reviews`);
		expect(unitExcerptsHref("publishing", UnitId)).toBe(`/catalog/publishing/${UnitId}/excerpts`);
		expect(unitQuestionsHref("publishing", UnitId)).toBe(`/catalog/publishing/${UnitId}/questions`);
		expect(unitTagsHref("publishing", UnitId)).toBe(`/catalog/publishing/${UnitId}/tags`);
		expect(unitReviewsHref("video", UnitId)).toBe(`/units/video/${UnitId}/reviews`);
		expect(unitQuestionsHref("video", UnitId)).toBe(`/units/video/${UnitId}/questions`);
	});
});
