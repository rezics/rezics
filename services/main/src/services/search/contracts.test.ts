import { describe, expect, it } from "vitest";

import { extractCanonicalSearchText } from "./contracts";

describe("current PostgreSQL search text", () => {
	it("extracts only allow-listed Portable Text spans", () => {
		expect(
			extractCanonicalSearchText({
				_type: "portable-text",
				content: [
					{
						_type: "block",
						_key: "block-1",
						children: [
							{ _type: "span", _key: "span-1", text: "Multilingual", marks: [] },
							{ _type: "secret", _key: "inline", value: "not indexed" },
							{ _type: "span", _key: "span-2", text: " search", marks: [] },
						],
					},
					{ _type: "private-widget", _key: "custom", text: "not indexed" },
				],
			}),
		).toBe("Multilingual search");
	});

	it("returns no text for editor-only documents", () => {
		expect(extractCanonicalSearchText({ _type: "private-widget", text: "hidden" })).toBe("");
	});
});
