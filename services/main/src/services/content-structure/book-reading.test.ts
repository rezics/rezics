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

	it("falls back to a presentable body before selecting a title-only localization", () => {
		expect(
			selectReaderChapterLocalization(rows, {
				bodyPresentation: "published",
				localizationLanguages: ["zh"],
			})?.language,
		).toBe("en");
	});

	it("keeps an explicit title-only localization exact", () => {
		expect(
			selectReaderChapterLocalization(rows, {
				bodyPresentation: "published",
				exactLanguage: "zh",
				localizationLanguages: ["en"],
			})?.language,
		).toBe("zh");
	});

	it("uses the preferred title when no localization has a presentable body", () => {
		const titleOnly = rows.map((row) => ({ ...row, content: null, contentStatus: null }));
		expect(
			selectReaderChapterLocalization(titleOnly, {
				bodyPresentation: "published",
				localizationLanguages: ["zh"],
			})?.language,
		).toBe("zh");
	});

	it("falls back when an explicitly requested language version does not exist", () => {
		expect(
			selectReaderChapterLocalization(rows.slice(0, 1), {
				bodyPresentation: "published",
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
				bodyPresentation: "preview",
				localizationLanguages: ["zh"],
			}),
		).toBe(draft[0]);
	});

	it("selects the preferred title without considering bodies when presentation is omitted", () => {
		expect(
			selectReaderChapterLocalization(rows, {
				bodyPresentation: "omit",
				localizationLanguages: ["zh"],
			})?.language,
		).toBe("zh");
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

	it("omits Book occurrences and terminates on cyclic input", () => {
		expect(
			orderReaderChapterNodeIds([
				{
					id: "book-node",
					contentUnitId: "book",
					parentId: "chapter-node",
					position: "a1",
					contentKind: "book",
				},
				{
					id: "chapter-node",
					contentUnitId: "chapter",
					parentId: "book-node",
					position: "a2",
					contentKind: "chapter",
				},
			]),
		).toEqual(["chapter-node"]);
	});
});
