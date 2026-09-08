import { expect, test } from "vitest";
import { musicBrainzLanguageTag } from "./musicbrainz-language";
import mapping from "./source-contracts/musicbrainz-language-map.json";

test("source ISO639 codes become valid native language identities", () => {
	for (const [source, target] of Object.entries(mapping.aliases))
		expect(String(musicBrainzLanguageTag(source))).toBe(target);
	expect(Object.keys(mapping.aliases).length).toBe(204);
	expect(mapping.sourceRows).toBe(7923);
});
test("preserves distinctions that locale preference aliases would collapse", () => {
	for (const [source, target] of [
		["jpn", "ja"],
		["eng", "en"],
		["hbs", "sh"],
		["tgl", "tl"],
		["twi", "tw"],
		["cmn", "cmn"],
		["yue", "yue"],
		["zxx", "zxx"],
		["mul", "mul"],
		["grc", "grc"],
	] as const)
		expect(String(musicBrainzLanguageTag(source))).toBe(target);
});
test("does not invent a valid language from unrecognized or private source codes", () => {
	expect(() => musicBrainzLanguageTag("qaa")).toThrow();
	expect(() => musicBrainzLanguageTag("not-a-language")).toThrow();
});
