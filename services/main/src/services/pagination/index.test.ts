import { t } from "elysia";
import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor, parseJsonCursor } from ".";
import { InvalidPaginationCursor } from "./errors";

describe("pagination cursors", () => {
	it("round-trips a normalized timestamp and identifier", () => {
		const timestamp = "2026-01-02T03:04:05.000Z";

		expect(decodeCursor(encodeCursor(timestamp, "unit-id"))).toEqual([timestamp, "unit-id"]);
		expect(decodeCursor()).toBeUndefined();
	});

	it.each([
		"not-a-cursor",
		Buffer.from("2026-01-02T03:04:05.000Z\\0unit-id\\0extra").toString("base64url"),
		Buffer.from("not-a-date\\0unit-id").toString("base64url"),
	])("rejects malformed cursor %s", (cursor) => {
		expect(() => decodeCursor(cursor)).toThrow(InvalidPaginationCursor);
	});

	it("returns JSON cursors only after their runtime shape is proven", () => {
		const schema = t.Object(
			{ v: t.Literal(1), offset: t.Integer({ minimum: 0 }) },
			{ additionalProperties: false },
		);
		const valid = Buffer.from(JSON.stringify({ v: 1, offset: 12 })).toString("base64url");

		expect(parseJsonCursor(valid, schema)).toEqual({ v: 1, offset: 12 });

		for (const value of [null, { v: 1 }, { v: 1, offset: -1 }, { v: 2, offset: 12 }]) {
			const cursor = Buffer.from(JSON.stringify(value)).toString("base64url");
			expect(() => parseJsonCursor(cursor, schema)).toThrow("Cursor does not match its schema");
		}
		expect(() => parseJsonCursor("not-json", schema)).toThrow();
	});
});
