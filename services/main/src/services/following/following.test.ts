import { describe, expect, it } from "vitest";

import { UnitKindValues } from "../database/schema/contract-values";
import { InvalidPaginationCursor } from "../pagination/errors";
import { decodeFollowingCursor, encodeFollowingCursor } from "./cursor";
import {
	FollowableUnitKindValues,
	isFollowableUnitKind,
	NonFollowableUnitKindValues,
} from "./policy";

describe("following policy", () => {
	it("explicitly classifies every Unit kind", () => {
		expect(FollowableUnitKindValues).toEqual(["profile", "entity", "zone", "realm"]);
		expect(new Set([...FollowableUnitKindValues, ...NonFollowableUnitKindValues])).toEqual(
			new Set(UnitKindValues),
		);
		expect(FollowableUnitKindValues.length + NonFollowableUnitKindValues.length).toBe(
			UnitKindValues.length,
		);
		for (const kind of FollowableUnitKindValues) expect(isFollowableUnitKind(kind)).toBe(true);
		for (const kind of NonFollowableUnitKindValues)
			expect(isFollowableUnitKind(kind)).toBe(false);
	});
});

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
