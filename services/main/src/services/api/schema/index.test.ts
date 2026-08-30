import { Compile } from "typebox/compile";
import Elysia, { t } from "elysia";
import { describe, expect, it } from "vitest";

import {
	DisplayPosition,
	FractionalPosition,
	FractionalPositionInput,
	ContentLanguage,
	LocalizationLanguageHints,
	OrdinalPosition,
} from ".";
import {
	FractionalPositionInputMaximumBytes,
	fractionalPositionBetween,
} from "../../ordering/position";

describe("position schemas", () => {
	it("keep fractional, ordinal, and display position contracts distinct", () => {
		const fractional = Compile(FractionalPosition);
		const fractionalInput = Compile(FractionalPositionInput);
		const ordinal = Compile(OrdinalPosition);
		const display = Compile(DisplayPosition);

		expect(fractional.Check("a0V")).toBe(true);
		expect(fractional.Check("V")).toBe(false);
		let longPosition = "a0";
		while (longPosition.length <= FractionalPositionInputMaximumBytes)
			longPosition = fractionalPositionBetween(longPosition, "a1");
		expect(fractional.Check(longPosition)).toBe(true);
		expect(fractionalInput.Check(longPosition)).toBe(false);
		expect(ordinal.Check(1_000)).toBe(true);
		expect(ordinal.Check(-1)).toBe(false);
		expect(display.Check(999)).toBe(true);
		expect(display.Check(1_000)).toBe(false);
	});
});

describe("ContentLanguage", () => {
	it("accepts only supported content-language groups", () => {
		const check = Compile(ContentLanguage);

		expect(check.Check("en")).toBe(true);
		expect(check.Check("zh")).toBe(true);
		expect(check.Check("ja")).toBe(true);
		expect(check.Check("ko")).toBe(true);
		expect(check.Check("de")).toBe(true);
		expect(check.Check("fr")).toBe(true);
		expect(check.Check("es")).toBe(true);
	});

	it("rejects UI locales and unsupported content languages", () => {
		const check = Compile(ContentLanguage);

		expect(check.Check("zh-Hant")).toBe(false);
		expect(check.Check("zh-hant")).toBe(false);
		expect(check.Check("en-US")).toBe(false);
		expect(check.Check("invalid")).toBe(false);
	});

	it("validates request values through Elysia", async () => {
		const app = new Elysia().post(
			"/",
			{
				body: t.Object({ language: ContentLanguage }),
			},
			({ body }) => body,
		);

		const valid = await app.handle(
			new Request("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ language: "zh" }),
			}),
		);
		const invalid = await app.handle(
			new Request("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ language: "invalid" }),
			}),
		);

		expect(valid.status).toBe(200);
		expect(invalid.status).toBe(422);
	});
});

describe("LocalizationLanguageHints", () => {
	it("accepts an empty or unique ordered list of supported languages", () => {
		const check = Compile(LocalizationLanguageHints);

		expect(check.Check(["zh", "en"])).toBe(true);
		expect(check.Check(["en"])).toBe(true);
		expect(check.Check([])).toBe(true);
		expect(check.Check(["en", "en"])).toBe(false);
		expect(check.Check(["ja"])).toBe(true);
		expect(check.Check(["zh-Hans"])).toBe(false);
	});
});
