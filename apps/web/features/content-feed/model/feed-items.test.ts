import { describe, expect, it } from "vitest";

import { collectUniqueFeedItems } from "./feed-items";

describe("collectUniqueFeedItems", () => {
	it("preserves first-seen order and keeps the latest value for an item repeated across pages", () => {
		expect(
			collectUniqueFeedItems(
				[
					{
						items: [
							{ id: "first", value: 1 },
							{ id: "repeated", value: 1 },
						],
					},
					{
						items: [
							{ id: "repeated", value: 2 },
							{ id: "last", value: 1 },
						],
					},
				],
				(item) => item.id,
			),
		).toEqual([
			{ id: "first", value: 1 },
			{ id: "repeated", value: 2 },
			{ id: "last", value: 1 },
		]);
	});
});
