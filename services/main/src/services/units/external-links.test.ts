import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getReadableUnitPresentationsByIds: vi.fn(),
}));

vi.mock("./attribution", () => ({
	getReadableUnitPresentationsByIds: mocks.getReadableUnitPresentationsByIds,
}));

import { attachReadableSourceEntities } from "./external-links";

describe("external-link source presentation", () => {
	it("attaches localized readable sources and omits links without a readable source", async () => {
		const sourceEntity = {
			id: "source-readable",
			kind: "entity" as const,
			language: "ja" as const,
			title: "情報源",
			summary: null,
			avatar: { type: "emoji" as const, emoji: "📚" },
		};
		mocks.getReadableUnitPresentationsByIds.mockResolvedValue(
			new Map([[sourceEntity.id, sourceEntity]]),
		);
		const readableLink = { id: "link-readable", sourceEntityId: sourceEntity.id };
		const duplicateSourceLink = {
			id: "link-readable-duplicate",
			sourceEntityId: sourceEntity.id,
		};
		const unreadableLink = { id: "link-unreadable", sourceEntityId: "source-unreadable" };

		const result = await attachReadableSourceEntities(
			[readableLink, duplicateSourceLink, unreadableLink],
			["ja"],
			"viewer-profile",
		);

		expect(mocks.getReadableUnitPresentationsByIds).toHaveBeenCalledWith({
			unitIds: [sourceEntity.id, "source-unreadable"],
			localizationLanguages: ["ja"],
			profileId: "viewer-profile",
		});
		expect(result).toEqual([
			{ ...readableLink, sourceEntity },
			{ ...duplicateSourceLink, sourceEntity },
		]);
	});
});
