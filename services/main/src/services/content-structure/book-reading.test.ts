import { describe, expect, it } from "vitest";
import type { ContentLanguage } from "@rezics/i18n";

import { orderReaderChapterNodeIds, selectReaderChapterLocalization } from "./book-reading";

describe("selectReaderChapterLocalization", () => {
	const rows: readonly {
		readonly language: ContentLanguage;
		readonly content: unknown | null;
		readonly contentStatus: string | null;
	}[] = [
		{ language: "zh", content: null, contentStatus: null },
		{ language: "en", content: { type: "root" }, contentStatus: "published" },
	];

	it("falls back to any readable body before selecting a title-only localization", () => {
		expect(
			selectReaderChapterLocalization(rows, {
				canReadDraftContent: false,
				localizationLanguages: ["zh"],
			})?.language,
		).toBe("en");
	});

	it("keeps an explicit title-only localization exact", () => {
		expect(
			selectReaderChapterLocalization(rows, {
				canReadDraftContent: false,
				exactLanguage: "zh",
				localizationLanguages: ["en"],
			})?.language,
		).toBe("zh");
	});

	it("uses the preferred title when no localization has readable content", () => {
		const titleOnly = rows.map((row) => ({ ...row, content: null, contentStatus: null }));
		expect(
			selectReaderChapterLocalization(titleOnly, {
				canReadDraftContent: false,
				localizationLanguages: ["zh"],
			})?.language,
		).toBe("zh");
	});

	it("falls back when an explicitly requested language version does not exist", () => {
		expect(
			selectReaderChapterLocalization(rows.slice(0, 1), {
				canReadDraftContent: false,
				exactLanguage: "en",
				localizationLanguages: ["zh"],
			})?.language,
		).toBe("zh");
	});

	it("lets an editor read a draft body", () => {
		const draft: readonly {
			readonly language: ContentLanguage;
			readonly content: unknown;
			readonly contentStatus: string;
		}[] = [{ language: "zh", content: {}, contentStatus: "draft" }];
		expect(
			selectReaderChapterLocalization(draft, {
				canReadDraftContent: true,
				localizationLanguages: ["zh"],
			}),
		).toBe(draft[0]);
	});
});

describe("orderReaderChapterNodeIds", () => {
	it("uses depth-first structure order and omits labels", () => {
		expect(
			orderReaderChapterNodeIds([
				{
					id: "later-node",
					contentUnitId: "later",
					parentId: null,
					position: "a2",
					contentKind: "chapter",
				},
				{
					id: "group",
					contentUnitId: "group-label",
					parentId: null,
					position: "a1",
					contentKind: "label",
				},
				{
					id: "nested-2-node",
					contentUnitId: "nested-2",
					parentId: "group",
					position: "a2",
					contentKind: "chapter",
				},
				{
					id: "nested-1-node",
					contentUnitId: "nested-1",
					parentId: "group",
					position: "a1",
					contentKind: "chapter",
				},
			]),
		).toEqual(["nested-1-node", "nested-2-node", "later-node"]);
	});

	it("keeps title-only chapters in navigation", () => {
		expect(
			orderReaderChapterNodeIds([
				{
					id: "first-node",
					contentUnitId: "first",
					parentId: null,
					position: "a1",
					contentKind: "chapter",
				},
				{
					id: "second-node",
					contentUnitId: "second",
					parentId: null,
					position: "a2",
					contentKind: "chapter",
				},
			]),
		).toEqual(["first-node", "second-node"]);
	});
});
