import { describe, expect, it } from "vitest";

import {
	contentLanguageOrdersEqual,
	moveContentLanguage,
	parseContentLanguageOrder,
} from "./content-language-order";

describe("content language order", () => {
	it("proves only non-empty, unique supported sequences", () => {
		expect(parseContentLanguageOrder(["zh", "en"])).toEqual(["zh", "en"]);
		expect(parseContentLanguageOrder([])).toBeUndefined();
		expect(parseContentLanguageOrder(["zh", "zh"])).toBeUndefined();
		expect(parseContentLanguageOrder(["pt"])).toBeUndefined();
	});

	it("moves a language without losing the order invariant", () => {
		const order = parseContentLanguageOrder(["zh", "en"]);
		expect(order).toBeDefined();
		if (!order) return;
		expect(moveContentLanguage(order, "en", 0)).toEqual(["en", "zh"]);
		expect(moveContentLanguage(order, "zh", 99)).toEqual(["en", "zh"]);
	});

	it("compares ordered sequences rather than only their members", () => {
		expect(contentLanguageOrdersEqual(["zh", "en"], ["zh", "en"])).toBe(true);
		expect(contentLanguageOrdersEqual(["zh", "en"], ["en", "zh"])).toBe(false);
	});
});
