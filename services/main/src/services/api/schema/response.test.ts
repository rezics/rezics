import { Decode, Encode } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DateTime } from ".";
import { toPortableTextResponse } from "./response";

describe("API response values", () => {
	it("keeps Date values in code and ISO timestamps on the wire", () => {
		const value = "2026-07-14T08:00:00.000Z";
		const decoded = Decode(DateTime, value);

		expect(decoded).toBeInstanceOf(Date);
		expect(decoded.toISOString()).toBe(value);
		expect(Encode(DateTime, decoded)).toBe(value);
	});

	it("accepts proven Portable Text and rejects malformed persisted data", () => {
		const value = [
			{
				_key: "block-1",
				_type: "block",
				children: [{ _key: "span-1", _type: "span", text: "Safe by construction" }],
			},
		];

		expect(toPortableTextResponse(value)).toBe(value);
		expect(() =>
			toPortableTextResponse([{ _key: "block-1", _type: "block", children: [{}] }]),
		).toThrow("Persisted Portable Text is invalid");
	});
});
