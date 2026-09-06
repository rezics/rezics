import { describe, expect, it, vi } from "vitest";

const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("../database", () => ({
	database: { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) },
}));

import { getUnitContentLanguageSupport } from "./content-language-support";

describe("stored language contract", () => {
	it("does not reinterpret a previously stored tag on read after a policy change", async () => {
		limit.mockResolvedValueOnce([{ value: [{ languageTag: "bh" }] }]);
		await expect(getUnitContentLanguageSupport("fixture")).rejects.toThrow(
			"Invalid persisted Unit content language support",
		);
	});
	it("preserves canonical script precision without requiring JSON object key order", async () => {
		limit.mockResolvedValueOnce([{ value: [{ channels: ["text"], languageTag: "cmn-Hans" }] }]);
		await expect(getUnitContentLanguageSupport("fixture")).resolves.toEqual([
			{ languageTag: "cmn-Hans", channels: ["text"] },
		]);
	});
});
