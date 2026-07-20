import { TypeCompiler } from "@sinclair/typebox/compiler";
import Elysia, { t } from "elysia";
import { describe, expect, it } from "vitest";

import { DisplayPosition, FractionalPosition, ContentLanguage, OrdinalPosition } from ".";

describe("position schemas", () => {
	it("keep fractional, ordinal, and display position contracts distinct", () => {
		const fractional = TypeCompiler.Compile(FractionalPosition);
		const ordinal = TypeCompiler.Compile(OrdinalPosition);
		const display = TypeCompiler.Compile(DisplayPosition);

		expect(fractional.Check("a0V")).toBe(true);
		expect(fractional.Check("V")).toBe(false);
		expect(ordinal.Check(1_000)).toBe(true);
		expect(ordinal.Check(-1)).toBe(false);
		expect(display.Check(999)).toBe(true);
		expect(display.Check(1_000)).toBe(false);
	});
});

describe("ContentLanguage", () => {
	it("accepts only supported content-language groups", () => {
		const check = TypeCompiler.Compile(ContentLanguage);

		expect(check.Check("en")).toBe(true);
		expect(check.Check("zh")).toBe(true);
	});

	it("rejects UI locales and unsupported content languages", () => {
		const check = TypeCompiler.Compile(ContentLanguage);

		expect(check.Check("zh-Hant")).toBe(false);
		expect(check.Check("zh-hant")).toBe(false);
		expect(check.Check("en-US")).toBe(false);
		expect(check.Check("ja")).toBe(false);
		expect(check.Check("invalid")).toBe(false);
	});

	it("validates request values through Elysia", async () => {
		const app = new Elysia().post("/", ({ body }) => body, {
			body: t.Object({ language: ContentLanguage }),
		});

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
