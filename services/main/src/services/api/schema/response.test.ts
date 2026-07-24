import { Check, Decode, Encode } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DateTime } from ".";
import {
	toPortableTextResponse,
	UnitProgressStatisticsResponse,
	UnitVariantContextResponse,
} from "./response";

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

	it("keeps every viewer-safe Main-Variant state explicit", () => {
		const summary = {
			id: "00000000-0000-7000-8000-000000000001",
			type: "book",
			title: "Main title",
			cover: null,
		};
		expect(Check(UnitVariantContextResponse, { role: "standalone" })).toBe(true);
		expect(Check(UnitVariantContextResponse, { role: "main", variants: [summary] })).toBe(true);
		expect(
			Check(UnitVariantContextResponse, {
				role: "variant",
				relationUpdatedAt: "2026-07-20T00:00:00.000Z",
				main: { state: "available", unit: summary },
			}),
		).toBe(true);
		expect(
			Check(UnitVariantContextResponse, {
				role: "variant",
				relationUpdatedAt: "2026-07-20T00:00:00.000Z",
				main: { state: "unavailable" },
			}),
		).toBe(true);
		expect(
			Check(UnitVariantContextResponse, {
				role: "variant",
				relationUpdatedAt: "2026-07-20T00:00:00.000Z",
				main: { state: "unavailable", unit: summary },
			}),
		).toBe(false);
	});

	it("accepts only non-negative integer Unit progress statistics", () => {
		expect(Check(UnitProgressStatisticsResponse, { active: 2_540, backlog: 90_307 })).toBe(
			true,
		);
		expect(Check(UnitProgressStatisticsResponse, { active: -1, backlog: 0 })).toBe(false);
		expect(Check(UnitProgressStatisticsResponse, { active: 1.5, backlog: 0 })).toBe(false);
	});
});
