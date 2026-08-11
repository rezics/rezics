import { describe, expect, it } from "vitest";

import { decodePlatformUserCursor, encodePlatformUserCursor } from "./cursor";

describe("platform user cursor", () => {
	it("round-trips a keyset position", () => {
		const cursor = {
			createdAt: "2026-07-28T12:00:00.000Z",
			userId: "01900000-0000-7000-8000-000000000001",
		};
		expect(decodePlatformUserCursor(encodePlatformUserCursor(cursor))).toEqual(cursor);
	});

	it.each([
		"not-json",
		Buffer.from(JSON.stringify({ createdAt: "invalid", userId: "invalid" })).toString("base64url"),
		Buffer.from(
			JSON.stringify({
				createdAt: "2026-07-28T12:00:00.000Z",
				userId: "01900000-0000-7000-8000-000000000001",
				extra: true,
			}),
		).toString("base64url"),
	])("rejects invalid cursor %s", (value) => {
		expect(decodePlatformUserCursor(value)).toBeUndefined();
	});
});
