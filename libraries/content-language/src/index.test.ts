import { describe, expect, it } from "vitest";

import {
	canonicalizeContentLanguageTag,
	ContentLanguageChannelValues,
	ContentLanguageSupportValidationError,
	isCanonicalContentLanguageTag,
	normalizeContentLanguageSupport,
} from ".";

describe("content language support contract", () => {
	it("canonicalizes arbitrary well-formed BCP 47 tags independently of UI locales", () => {
		expect(canonicalizeContentLanguageTag("EN-us")).toBe("en-US");
		expect(canonicalizeContentLanguageTag("yue-Hant-HK")).toBe("yue-Hant-HK");
		expect(isCanonicalContentLanguageTag("en-US")).toBe(true);
		expect(isCanonicalContentLanguageTag("EN-us")).toBe(false);
		expect(isCanonicalContentLanguageTag("en_US")).toBe(false);
	});

	it("normalizes language and channel order without inventing channel detail", () => {
		expect(
			normalizeContentLanguageSupport([
				{ languageTag: "zh-hant", channels: ["interface", "text", "subtitle"] },
				{ languageTag: "ja" },
			]),
		).toEqual([
			{ languageTag: "ja" },
			{ languageTag: "zh-Hant", channels: ["text", "subtitle", "interface"] },
		]);
		expect(ContentLanguageChannelValues).toEqual(["text", "audio", "subtitle", "interface"]);
	});

	it("uses code-point order for revision and cache stability", () => {
		expect(
			normalizeContentLanguageSupport([
				{ languageTag: "zh" },
				{ languageTag: "sl-rozaj" },
				{ languageTag: "sl-1994" },
				{ languageTag: "en" },
			]).map(({ languageTag }) => languageTag),
		).toEqual(["en", "sl-1994", "sl-rozaj", "zh"]);
	});

	it("rejects ambiguous or malformed values", () => {
		expect(() =>
			normalizeContentLanguageSupport([{ languageTag: "en-US" }, { languageTag: "EN-us" }]),
		).toThrow("unique after BCP 47 canonicalization");
		expect(() => normalizeContentLanguageSupport([{ languageTag: "en", channels: [] }])).toThrow(
			"non-empty array",
		);
		expect(() =>
			normalizeContentLanguageSupport([{ languageTag: "en", channels: ["audio", "audio"] }]),
		).toThrow("unique");
		expect(() => normalizeContentLanguageSupport([{ languageTag: "not a tag" }])).toThrow(
			ContentLanguageSupportValidationError,
		);
		expect(() => normalizeContentLanguageSupport([{ languageTag: "en", stock: true }])).toThrow(
			"unknown field",
		);
	});
});
