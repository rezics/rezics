import { describe, expect, it } from "vitest";

import { resolveFeedPageContinuation } from "./continuation";

describe("Feed page continuation", () => {
	it("treats an empty presented page as terminal even when Search can scan again", () => {
		expect(resolveFeedPageContinuation([], "s2_internal-search-position")).toEqual({
			status: "exhausted",
			cursor: null,
		});
	});

	it("retains a non-empty continuation only after presenting an item", () => {
		expect(resolveFeedPageContinuation([{ id: "visible" }], "next-page")).toEqual({
			status: "available",
			cursor: "next-page",
		});
	});

	it.each([null, undefined, ""])("normalizes a missing cursor to terminal (%s)", (cursor) => {
		expect(resolveFeedPageContinuation([{ id: "visible" }], cursor)).toEqual({
			status: "exhausted",
			cursor: null,
		});
	});
});
