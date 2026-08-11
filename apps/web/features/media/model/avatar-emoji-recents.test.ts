import { describe, expect, it } from "vitest";

import { readRecentEmojiChoices, rememberRecentEmojiChoice } from "./avatar-emoji-recents";

class MemoryStorage implements Storage {
	private readonly values = new Map<string, string>();

	get length(): number {
		return this.values.size;
	}

	clear(): void {
		this.values.clear();
	}

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.values.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("avatar recents", () => {
	it("keeps valid emoji choices in most-recent-first order", () => {
		const storage = new MemoryStorage();

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
		const storage = new MemoryStorage();
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
		const storage = new MemoryStorage();

		rememberRecentEmojiChoice(storage, "en", { emoji: "🦈", label: "Shark" });
		rememberRecentEmojiChoice(storage, "zh-hant", { emoji: "🦈", label: "鯊魚" });

		expect(readRecentEmojiChoices(storage, "en")).toEqual([{ emoji: "🦈", label: "Shark" }]);
		expect(readRecentEmojiChoices(storage, "zh-hant")).toEqual([{ emoji: "🦈", label: "鯊魚" }]);
	});
});
