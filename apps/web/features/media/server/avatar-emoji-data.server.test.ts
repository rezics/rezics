import { describe, expect, it } from "vitest";

import { AvatarEmojiDataVersion, createAvatarEmojiDataResponse } from "./avatar-emoji-data.server";

describe("avatar emoji data", () => {
	it("serves the pinned localized dataset with immutable caching", async () => {
		const response = createAvatarEmojiDataResponse({
			version: AvatarEmojiDataVersion,
			locale: "zh-hant",
			file: "messages.json",
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
		expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
		expect((await response.text()).length).toBeGreaterThan(1_000);
	});

	it("rejects unsupported versions, locales, and files", () => {
		expect(
			createAvatarEmojiDataResponse({
				version: "latest",
				locale: "zh-hant",
				file: "messages.json",
			}).status,
		).toBe(404);
		expect(
			createAvatarEmojiDataResponse({
				version: AvatarEmojiDataVersion,
				locale: "fr",
				file: "messages.json",
			}).status,
		).toBe(404);
		expect(
			createAvatarEmojiDataResponse({
				version: AvatarEmojiDataVersion,
				locale: "en",
				file: "unknown.json",
			}).status,
		).toBe(404);
	});
});
