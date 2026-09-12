import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../pagination/errors";
import { decodeFollowingCursor, encodeFollowingCursor } from "./cursor";

describe("following cursors", () => {
	const boundary = {
		favorite: true,
		position: "a0V",
		targetReferenceId: "019c48b5-4ada-7f46-bfe9-f7c80224b320",
	} as const;
	const contentRatings = ["general", "r15"] as const;

	it("round-trips a typed boundary within its Unit-kind scope", () => {
		const cursor = encodeFollowingCursor("zone", ["zh", "en"], contentRatings, boundary);
		expect(decodeFollowingCursor(cursor, "zone", ["zh", "en"], contentRatings)).toEqual(boundary);
		expect(decodeFollowingCursor(undefined, "zone", ["zh", "en"], contentRatings)).toBeUndefined();
	});

	it("encodes only the declared boundary from a scanned candidate", () => {
		const candidate = {...boundary,unitId:"019c48b5-4ada-7f46-bfe9-f7c80224b321"};
		const cursor = encodeFollowingCursor("zone", ["zh", "en"], contentRatings, candidate);
		expect(decodeFollowingCursor(cursor,"zone",["zh","en"],contentRatings)).toEqual(boundary);
	});

	it("rejects malformed cursors and cursors from another filter scope", () => {
		const cursor = encodeFollowingCursor("zone", ["zh", "en"], contentRatings, boundary);
		expect(() => decodeFollowingCursor(cursor, "realm", ["zh", "en"], contentRatings)).toThrow(
			InvalidPaginationCursor,
		);
		expect(() => decodeFollowingCursor(cursor, "zone", ["en", "zh"], contentRatings)).toThrow(
			InvalidPaginationCursor,
		);
		expect(() => decodeFollowingCursor(cursor, undefined, ["zh", "en"], contentRatings)).toThrow(
			InvalidPaginationCursor,
		);
		expect(() =>
			decodeFollowingCursor("not-a-cursor", "zone", ["zh", "en"], contentRatings),
		).toThrow(InvalidPaginationCursor);
	});
});
