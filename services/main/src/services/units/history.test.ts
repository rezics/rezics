import { describe, expect, it } from "vitest";
import type { ContentLanguage } from "@rezics/i18n";

import {
	getUnitRevisionSlotContent,
	parseUnitRevisionSlotIdentity,
	type UnitRevisionDocuments,
	undoRevisionDocuments,
} from "./history";

function documents(payload: unknown): UnitRevisionDocuments {
	return { main: { model: "rezics.unit.main.v1", payload }, localizations: {} };
}

function localizationDocument(language: ContentLanguage, title: string) {
	return {
		model: "rezics.unit.localization.v1",
		payload: {
			version: 1,
			localization: {
				language,
				position: "a0",
				avatarType: null,
				avatarAssetId: null,
				avatarEmoji: null,
				avatarIconPrefix: null,
				avatarIconName: null,
				bannerAssetId: null,
				coverAssetId: null,
				title,
				summary: null,
				description: null,
				content: null,
				contentStatus: "published",
			},
		},
	} as const;
}

function localizationDocuments(
	localizations: Partial<Record<ContentLanguage, ReturnType<typeof localizationDocument>>>,
): UnitRevisionDocuments {
	return { localizations };
}

describe("revision undo merge", () => {
	it("reverts the target change while preserving later unrelated edits", () => {
		const result = undoRevisionDocuments(
			documents({ title: "before", score: 0 }),
			documents({ title: "after", score: 0 }),
			documents({ title: "after", score: 1 }),
		);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.main?.payload).toEqual({ title: "before", score: 1 });
	});

	it("reports the exact path when a later edit overlaps the target change", () => {
		const result = undoRevisionDocuments(
			documents({ title: "before" }),
			documents({ title: "after" }),
			documents({ title: "later" }),
		);

		expect(result.conflictPaths).toEqual(["/main/payload/title"]);
	});

	it("merges arrays by a stable item key", () => {
		const before = documents({
			items: [
				{ language: "en", title: "before" },
				{ language: "zh", title: "原文" },
			],
		});
		const after = documents({
			items: [
				{ language: "en", title: "after" },
				{ language: "zh", title: "原文" },
			],
		});
		const current = documents({
			items: [
				{ language: "en", title: "after" },
				{ language: "zh", title: "后续编辑" },
			],
		});

		const result = undoRevisionDocuments(before, after, current);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.main?.payload).toEqual({
			items: [
				{ language: "en", title: "before" },
				{ language: "zh", title: "后续编辑" },
			],
		});
	});

	it("undoes one localization without overwriting a later edit in another language", () => {
		const result = undoRevisionDocuments(
			localizationDocuments({
				en: localizationDocument("en", "Before"),
				zh: localizationDocument("zh", "原文"),
			}),
			localizationDocuments({
				en: localizationDocument("en", "After"),
				zh: localizationDocument("zh", "原文"),
			}),
			localizationDocuments({
				en: localizationDocument("en", "After"),
				zh: localizationDocument("zh", "後續編輯"),
			}),
		);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.localizations.en?.payload).toMatchObject({
			localization: { language: "en", title: "Before" },
		});
		expect(result.documents.localizations.zh?.payload).toMatchObject({
			localization: { language: "zh", title: "後續編輯" },
		});
	});

	it("restores a localization removed by the target revision", () => {
		const result = undoRevisionDocuments(
			localizationDocuments({ en: localizationDocument("en", "English") }),
			localizationDocuments({}),
			localizationDocuments({}),
		);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.localizations.en?.payload).toMatchObject({
			localization: { language: "en", title: "English" },
		});
	});

	it("removes a localization added by the target revision", () => {
		const result = undoRevisionDocuments(
			localizationDocuments({}),
			localizationDocuments({ en: localizationDocument("en", "English") }),
			localizationDocuments({ en: localizationDocument("en", "English") }),
		);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.localizations.en).toBeUndefined();
	});

	it("reports a language-keyed path for overlapping localization edits", () => {
		const result = undoRevisionDocuments(
			localizationDocuments({ en: localizationDocument("en", "Before") }),
			localizationDocuments({ en: localizationDocument("en", "After") }),
			localizationDocuments({ en: localizationDocument("en", "Later") }),
		);

		expect(result.conflictPaths).toEqual(["/localizations/en/title"]);
	});
});

describe("revision slot identity", () => {
	it("proves the role and key relationship at the runtime boundary", () => {
		expect(parseUnitRevisionSlotIdentity({ role: "localization", slotKey: "en" })).toEqual({
			role: "localization",
			slotKey: "en",
		});
		expect(parseUnitRevisionSlotIdentity({ role: "main", slotKey: "" })).toEqual({
			role: "main",
			slotKey: "",
		});
		expect(() => parseUnitRevisionSlotIdentity({ role: "localization", slotKey: "" })).toThrow(
			"Invalid Unit localization revision slot key",
		);
		expect(() => parseUnitRevisionSlotIdentity({ role: "main", slotKey: "en" })).toThrow(
			"Fixed Unit revision slot main has key en",
		);
	});

	it("rejects localization content whose language differs from its slot key", () => {
		const documents = localizationDocuments({
			en: localizationDocument("zh", "中文"),
		});

		expect(() =>
			getUnitRevisionSlotContent(documents, { role: "localization", slotKey: "en" }),
		).toThrow("Unit localization revision slot en contains zh content");
	});
});
