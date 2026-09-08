import { describe, expect, it } from "vitest";
import { catalogWirePage } from "./resource-pagination";

describe("catalog response budgets", () => {
	it("retains the first unreturned form for the next request when escaped text fills the page", () => {
		const first = { id: "a", value: { text: "\u0001".repeat(100) } };
		const second = { id: "b", value: { text: "second" } };
		const page = catalogWirePage([first, second], 100, 750);
		expect(page).toEqual({ items: [first.value], nextCursor: "a" });
		expect(catalogWirePage([second], 100, 750)).toEqual({
			items: [second.value],
			nextCursor: null,
		});
	});
	it("continues through a filtered candidate page without disclosing its fields", () => {
		expect(
			catalogWirePage(
				[
					{ id: "a", value: null },
					{ id: "b", value: null },
					{ id: "c", value: { name: "visible" } },
				],
				2,
			),
		).toEqual({ items: [], nextCursor: "b" });
	});
});
