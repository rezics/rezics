import { describe, expect, it } from "vitest";
import { correlateMusicBrainzNativeAliases } from "./musicbrainz-name-plan";
const name = (value: string) => ({ kind: "alias", value, languageTag: null });
describe("native MusicBrainz alias correspondence", () => {
	it("does not invent alias identity from an unordered array position", () => {
		expect(
			correlateMusicBrainzNativeAliases(
				[{ path: "/aliases/0", value: name("Old") }],
				[name("New")],
			),
		).toEqual([undefined]);
	});
	it("reserves a later unchanged alias before a changed earlier occurrence", () => {
		expect(
			correlateMusicBrainzNativeAliases(
				[
					{ path: "/aliases/0", value: name("Stable") },
					{ path: "/aliases/1", value: name("Old") },
				],
				[name("New"), name("Stable")],
			),
		).toEqual([undefined, "/aliases/0"]);
	});
	it("retains deterministic separate occurrences for equal aliases", () => {
		expect(
			correlateMusicBrainzNativeAliases(
				[
					{ path: "/aliases/10", value: name("Same") },
					{ path: "/aliases/2", value: name("Same") },
				],
				[name("Same"), name("Same")],
			),
		).toEqual(["/aliases/2", "/aliases/10"]);
	});
	it("matches canonical native values rather than arbitrary provider-only fields", () => {
		expect(
			correlateMusicBrainzNativeAliases(
				[{ path: "/aliases/0", value: { ...name("Same"), languageTag: "EN-us" } }],
				[{ ...name("Same"), languageTag: "en-US" }],
			),
		).toEqual(["/aliases/0"]);
		expect(() =>
			correlateMusicBrainzNativeAliases(
				[
					{ path: "/aliases/0", value: name("A") },
					{ path: "/aliases/0", value: name("B") },
				],
				[],
			),
		).toThrow("ambiguous");
	});
});
