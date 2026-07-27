import { describe, expect, it } from "vitest";

import { decodeAuditCursor, encodeAuditCursor } from "./cursor";

describe("Audit cursor", () => {
	it("round-trips the keyset position", () => {
		const cursor = {
			createdAt: "2026-07-27T12:00:00.000Z",
			id: "01900000-0000-7000-8000-000000000001",
		};

		expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
	});

	it.each([
		"not-json",
		Buffer.from(JSON.stringify({ createdAt: "not-a-date", id: "not-a-uuid" })).toString(
			"base64url",
		),
		Buffer.from(
			JSON.stringify({
				createdAt: "2026-07-27T12:00:00.000Z",
				id: "01900000-0000-7000-8000-000000000001",
				extra: true,
			}),
		).toString("base64url"),
	])("rejects an invalid cursor", (value) => {
		expect(decodeAuditCursor(value)).toBeUndefined();
	});
});
