import { TypeCompiler } from "@sinclair/typebox/compiler";
import Elysia, { t } from "elysia";
import { describe, expect, it } from "vitest";

import { LanguageTag } from ".";

describe("LanguageTag", () => {
	it("accepts IANA BCP 47 language tags", () => {
		const check = TypeCompiler.Compile(LanguageTag);

		expect(check.Check("en")).toBe(true);
		expect(check.Check("en-US")).toBe(true);
		expect(check.Check("zh-Hant")).toBe(true);
		expect(check.Check("und")).toBe(true);
	});

	it("rejects unknown or malformed tags", () => {
		const check = TypeCompiler.Compile(LanguageTag);

		expect(check.Check("invalid")).toBe(false);
		expect(check.Check("en-QQ")).toBe(false);
		expect(check.Check("en_US")).toBe(false);
	});

	it("validates request values through Elysia", async () => {
		const app = new Elysia().post("/", ({ body }) => body, {
			body: t.Object({ language: LanguageTag }),
		});

		const valid = await app.handle(
			new Request("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ language: "zh-Hant" }),
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
