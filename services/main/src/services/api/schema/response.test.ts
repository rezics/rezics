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
		const value = {
			_type: "portable-text" as const,
			_key: "001122aabbcc",
			content: [
				{
					_key: "block-1",
					_type: "block" as const,
					children: [
						{ _key: "span-1", _type: "span" as const, text: "Safe by construction" },
					],
				},
			],
		};

		expect(toPortableTextResponse(value)).toBe(value);
		expect(() =>
			toPortableTextResponse({
				_type: "portable-text",
				_key: "not-a-block-key",
				content: [],
			}),
		).toThrow("Invalid Block document");
	});
});
