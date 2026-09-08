import { parseContentLanguageTag } from "@rezics/content-language";
import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ routes: vi.fn(), execute: vi.fn() }));
vi.mock("../../database", () => ({
	database: {
		select: () => ({ from: () => ({ where: storage.routes }) }),
		execute: storage.execute,
	},
}));
import { readNativeZoneRenderReferences } from "./render-native-references";
const id = "019b0000-0000-7000-8000-000000000001";
const language = parseContentLanguageTag("ja-JP");
const row = {
	id,
	value: "Example title",
	language_tag: language.tag,
	language_policy: language.policy,
	private_use_namespace: null,
};
beforeEach(() => {
	vi.clearAllMocks();
	storage.routes.mockResolvedValue([{ owner: "publishing", id }]);
	storage.execute.mockResolvedValue({ rows: [row] });
});
describe("native Zone render names", () => {
	it("renders native names without a Unit localization and preserves the exact language tag", async () => {
		const readableUnitIds = vi.fn().mockResolvedValue(new Set([id]));
		const items = await readNativeZoneRenderReferences([id], { readableUnitIds });
		expect(items).toEqual([
			{
				id,
				kind: "publishing",
				zonePageSlug: null,
				language: null,
				languageTag: "ja-JP",
				title: "Example title",
				summary: null,
				avatar: null,
				banner: null,
				cover: null,
			},
		]);
		expect(readableUnitIds).toHaveBeenCalledWith([id]);
	});
	it("omits names whose native owner read policy denies the viewer", async () => {
		expect(
			await readNativeZoneRenderReferences([id], { readableUnitIds: async () => new Set() }),
		).toEqual([]);
	});
	it("rejects a stale language policy instead of relabeling persisted source text", async () => {
		storage.execute.mockResolvedValue({ rows: [{ ...row, language_policy: "stale" }] });
		await expect(
			readNativeZoneRenderReferences([id], { readableUnitIds: async () => new Set([id]) }),
		).rejects.toThrow("explicit policy migration");
	});
	it("does not dispatch an unbounded identity set", async () => {
		await expect(
			readNativeZoneRenderReferences(
				Array.from({ length: 501 }, () => id),
				{ readableUnitIds: async () => new Set() },
			),
		).rejects.toThrow(RangeError);
		expect(storage.execute).not.toHaveBeenCalled();
	});
});
