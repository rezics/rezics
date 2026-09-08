import { describe, expect, it } from "vitest";
import {
	chapterEditorHref,
	contentStructureHistoryHref,
	parseUnitManagementSection,
	unitManagementSectionHref,
} from "./unit-management-routes";

describe("unit management routes", () => {
	it("builds typed timed-resource section routes", () => {
		expect(unitManagementSectionHref("video", "unit-1", "metadata")).toBe(
			"/units/video/unit-1/edit/metadata",
		);
		expect(unitManagementSectionHref("audio", "unit-1", "tags")).toBe(
			"/units/audio/unit-1/edit/tags",
		);
	});
	it("keeps the overview separate from content and nested history", () => {
		expect(
			parseUnitManagementSection("/units/audio/unit-1/edit", "audio", "unit-1"),
		).toBeUndefined();
		expect(parseUnitManagementSection("/units/audio/unit-1/edit/content", "audio", "unit-1")).toBe(
			"content",
		);
		expect(
			parseUnitManagementSection("/units/audio/unit-1/edit/history/compare", "audio", "unit-1"),
		).toBe("history");
	});
	it("does not admit retired facade sections", () => {
		for (const section of [
			"relationships",
			"releases",
			"docks",
			"content-structure/history",
			"basic",
			"localizations",
		]) {
			expect(
				parseUnitManagementSection(`/units/audio/unit-1/edit/${section}`, "audio", "unit-1"),
			).toBeUndefined();
		}
	});
	it("addresses chapter text and native structures through their real owners", () => {
		expect(chapterEditorHref("text-version", "chapter-1")).toBe("/posts/chapter-1/edit");
		expect(contentStructureHistoryHref("publishing", "text-version")).toBe(
			"/catalog/publishing/text-version/contents/history",
		);
		expect(contentStructureHistoryHref("program", "program-1")).toBe(
			"/catalog/program/program-1/contents/history",
		);
	});
});
