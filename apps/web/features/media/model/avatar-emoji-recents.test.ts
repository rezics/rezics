/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import { readRecentEmojiChoices, rememberRecentEmojiChoice } from "./avatar-emoji-recents";

describe("avatar recents", () => {
	it("keeps valid emoji choices in most-recent-first order", () => {
		const storage = window.localStorage;
		storage.clear();

		rememberRecentEmojiChoice(storage, "zh-hant", { emoji: "🦈", label: "鯊魚" });
		rememberRecentEmojiChoice(storage, "zh-hant", {
			emoji: "🏳️‍🌈",
			label: "彩虹旗",
		});
		rememberRecentEmojiChoice(storage, "zh-hant", { emoji: "🦈", label: "鯊魚" });

		expect(readRecentEmojiChoices(storage, "zh-hant")).toEqual([
			{ emoji: "🦈", label: "鯊魚" },
			{ emoji: "🏳️‍🌈", label: "彩虹旗" },
		]);
	});

	it("rejects malformed stored emoji values", () => {
		const storage = window.localStorage;
		storage.clear();
		storage.setItem(
			"rezics-avatar-recent-emojis-v1:en",
			JSON.stringify({
				version: 1,
				items: [
					{ emoji: "🦈🦈", label: "two emoji" },
					{ emoji: "🦈", label: "Shark" },
				],
			}),
		);

		expect(readRecentEmojiChoices(storage, "en")).toEqual([{ emoji: "🦈", label: "Shark" }]);
	});

	it("isolates localized labels by picker locale", () => {
		const storage = window.localStorage;
		storage.clear();

		rememberRecentEmojiChoice(storage, "en", { emoji: "🦈", label: "Shark" });
		rememberRecentEmojiChoice(storage, "zh-hant", { emoji: "🦈", label: "鯊魚" });

		expect(readRecentEmojiChoices(storage, "en")).toEqual([{ emoji: "🦈", label: "Shark" }]);
		expect(readRecentEmojiChoices(storage, "zh-hant")).toEqual([
			{ emoji: "🦈", label: "鯊魚" },
		]);
	});
});
