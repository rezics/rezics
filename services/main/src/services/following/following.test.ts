import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../pagination/errors";
import { decodeFollowingCursor, encodeFollowingCursor } from "./cursor";

describe("following cursors", () => {
	const boundary = {
		favorite: true,
		position: "a0V",
		unitId: "019c48b5-4ada-7f46-bfe9-f7c80224b320",
	} as const;

	it("round-trips a typed boundary within its Unit-kind scope", () => {
		const cursor = encodeFollowingCursor("zone", "zh", boundary);
		expect(decodeFollowingCursor(cursor, "zone", "zh")).toEqual(boundary);
		expect(decodeFollowingCursor(undefined, "zone", "zh")).toBeUndefined();
	});

	it("rejects malformed cursors and cursors from another filter scope", () => {
		const cursor = encodeFollowingCursor("zone", "zh", boundary);
		expect(() => decodeFollowingCursor(cursor, "realm", "zh")).toThrow(InvalidPaginationCursor);
		expect(() => decodeFollowingCursor(cursor, "zone", "en")).toThrow(InvalidPaginationCursor);
		expect(() => decodeFollowingCursor(cursor, undefined, "zh")).toThrow(
			InvalidPaginationCursor,
		);
		expect(() => decodeFollowingCursor("not-a-cursor", "zone", "zh")).toThrow(
			InvalidPaginationCursor,
		);
	});
});
