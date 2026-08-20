import { describe, expect, it } from "vitest";

import { EntityLocalizationDraftCodec } from "./entity-localization-draft";

describe("EntityLocalizationDraftCodec", () => {
	it("restores description and cover together with the existing Entity localization fields", () => {
		expect(
			EntityLocalizationDraftCodec.decode({
				title: "Saber",
				summary: "A principal character.",
				description: [],
				avatar: { type: "emoji", emoji: "⚔️" },
				banner: { id: "banner-asset", url: "https://example.com/banner.webp" },
				cover: { id: "cover-asset", url: "https://example.com/cover.webp" },
			}),
		).toEqual({
			title: "Saber",
			summary: "A principal character.",
			description: [],
			avatar: { type: "emoji", emoji: "⚔️" },
			banner: { id: "banner-asset", url: "https://example.com/banner.webp" },
			cover: { id: "cover-asset", url: "https://example.com/cover.webp" },
		});
	});

	it("rejects a version-one-shaped draft that cannot preserve the new fields", () => {
		expect(
			EntityLocalizationDraftCodec.decode({
				title: "Saber",
				summary: "A principal character.",
				avatar: null,
				banner: null,
			}),
		).toBeUndefined();
	});

	it("keeps an omitted image distinct from an explicit null image", () => {
		expect(
			EntityLocalizationDraftCodec.decode({
				title: "Saber",
				summary: "",
				description: [],
				avatar: null,
				banner: null,
			}),
		).toBeUndefined();
	});
});
