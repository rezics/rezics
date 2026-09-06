import { describe, expect, it } from "vitest";
import {
	canonicalizeContentLanguageTag,
	parseContentLanguageTag,
	LanguageTagValidationError,
} from ".";
import { ianaRegistry } from "./iana-registry.generated";

describe("pinned IANA content language policy", () => {
	it.each([
		["CMN-hANS-cn", "cmn-Hans-CN"],
		["zh-CMN-hANT", "cmn-Hant"],
		["zh", "zh"],
		["zh-Hant-TW", "zh-Hant-TW"],
		["en-Latn-US", "en-Latn-US"],
		["sh", "sh"],
		["iw-IL", "he-IL"],
		["en-BU", "en-MM"],
		["bh", "bih"],
		["i-klingon", "tlh"],
		["en-GB-oed", "en-GB-oxendict"],
		["i-default", "i-default"],
		["und", "und"],
		["mul", "mul"],
		["zxx", "zxx"],
		["ta", "ta"],
		["tl", "tl"],
		["yue-Hant-HK", "yue-Hant-HK"],
	])("canonicalizes %s to %s without inferring script or a macrolanguage", (input, expected) => {
		expect(canonicalizeContentLanguageTag(input)).toBe(expected);
	});

	it.each([
		"zz",
		"abcd",
		"en-Abcd",
		"en-XX",
		"en-999",
		"en-foobar",
		"en-cmn",
		"en_US",
		" en",
		"en-",
		"",
		null,
		"sl-rozaj-rozaj",
		"ja-Latn-hepburn-heploc-alalc97",
		"en-u-ca-gregory",
		"en-u",
		"en-a-aa-a-bb",
	])("rejects invalid or role-inappropriate input %s", (input) => {
		expect(() => parseContentLanguageTag(input)).toThrow(LanguageTagValidationError);
	});

	it.each(["x-EXAMPLE", "en-x-custom", "qaa", "en-Qaaa", "en-QM"])(
		"requires a namespace for %s",
		(input) => {
			expect(() => parseContentLanguageTag(input)).toThrow("private_use_namespace");
			const parsed = parseContentLanguageTag(input, { privateUseNamespace: "urn:rezics:fixture" });
			expect(parsed).toMatchObject({ kind: "private-use", namespace: "urn:rezics:fixture" });
			expect(() => canonicalizeContentLanguageTag(input)).toThrow();
		},
	);

	it("accepts every registered primary language and keeps canonicalization idempotent", () => {
		const failures: string[] = [];
		for (const language of ianaRegistry.subtags.language.split(" ")) {
			try {
				const result = canonicalizeContentLanguageTag(language);
				if (canonicalizeContentLanguageTag(result) !== result) failures.push(language);
			} catch {
				failures.push(language);
			}
		}
		expect(failures).toEqual([]);
	});

	it("resolves every registered extlang in its declared prefix", () => {
		const failures: string[] = [];
		for (const [extlang, prefixes] of Object.entries(ianaRegistry.extlangPrefixes)) {
			for (const prefix of prefixes) {
				try {
					const result = canonicalizeContentLanguageTag(`${prefix}-${extlang}`);
					if (canonicalizeContentLanguageTag(result) !== result)
						failures.push(`${prefix}-${extlang}`);
				} catch {
					failures.push(`${prefix}-${extlang}`);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	it("keeps all grandfathered and redundant registry tags addressable", () => {
		const failures: string[] = [];
		for (const tag of Object.keys(ianaRegistry.wholeTags)) {
			try {
				const canonical = canonicalizeContentLanguageTag(tag);
				if (canonicalizeContentLanguageTag(canonical) !== canonical) failures.push(tag);
			} catch {
				failures.push(tag);
			}
		}
		expect(failures).toEqual([]);
	});
});
