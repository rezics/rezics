import { describe, expect, it } from "vitest";

import { selectCustomThemeReviewBatch } from "./review";

describe("Custom Theme review scheduling", () => {
	it("bounds global and per-origin fetch concurrency without starving other origins", () => {
		const queue = [
			...Array.from({ length: 12 }, (_, index) => ({
				id: `hot-${index}`,
				url: `https://hot.example.test/${index}.js`,
			})),
			...Array.from({ length: 8 }, (_, index) => ({
				id: `other-${index}`,
				url: `https://origin-${index}.example.test/module.js`,
			})),
		];
		const batch = selectCustomThemeReviewBatch(queue);
		expect(batch).toHaveLength(8);
		expect(
			batch.filter(({ url }) => new URL(url).origin === "https://hot.example.test"),
		).toHaveLength(2);
		expect(new Set(batch.map(({ id }) => id)).size).toBe(batch.length);
	});
});
