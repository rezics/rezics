import { describe, expect, expectTypeOf, it } from "vitest";

import { getNextItemPageParam } from "./infinite-query";

describe("infinite item query continuation", () => {
	it("treats an empty page as terminal even when the API sends a cursor", () => {
		expect(
			getNextItemPageParam({ items: [], nextCursor: "unexpected-next-page" }, [], "current"),
		).toBeUndefined();
	});

	it("returns a new cursor after a non-empty page", () => {
		type Cursor = string & { readonly __cursor: unique symbol };
		const cursor = "next" as Cursor;
		const result = getNextItemPageParam(
			{ items: [{ id: "visible" }], nextCursor: cursor },
			[],
			null,
		);

		expect(result).toBe(cursor);
		expectTypeOf(result).toEqualTypeOf<Cursor | undefined>();
	});

	it.each([null, undefined, ""])("treats a missing cursor as terminal (%s)", (nextCursor) => {
		expect(
			getNextItemPageParam({ items: [{ id: "visible" }], nextCursor }, [], "current"),
		).toBeUndefined();
	});

	it("stops when a server repeats the current cursor", () => {
		expect(
			getNextItemPageParam(
				{ items: [{ id: "visible" }], nextCursor: "same-position" },
				[],
				"same-position",
			),
		).toBeUndefined();
	});
});
