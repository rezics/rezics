import { describe, expect, it } from "vitest";
import { decodeSoftwareComponentSnapshot } from "./software-components";

describe("software occurrence history boundaries", () => {
	it("restores exact language values without collapsing unknown flags", () => {
		expect(
			decodeSoftwareComponentSnapshot("language", {
				language_tag: "zh-hant",
				channel_revision_id: null,
				machine_translated: null,
				main: false,
				title: "標題",
				transliterated_title: null,
			}),
		).toEqual({
			kind: "language",
			languageTag: "zh-Hant",
			channelRevisionId: null,
			machineTranslated: null,
			main: false,
			title: "標題",
			transliteratedTitle: null,
		});
	});
	it("rejects invalid historic references and dates before writing", () => {
		expect(() => decodeSoftwareComponentSnapshot("content", { content_id: "not-an-id" })).toThrow();
		expect(() =>
			decodeSoftwareComponentSnapshot("event", {
				area_id: null,
				date_year: 2023,
				date_month: 2,
				date_day: 29,
				date_text: null,
			}),
		).toThrow();
	});
	it("roundtrips animation contexts through their native constraints", () => {
		expect(
			decodeSoftwareComponentSnapshot("animation", {
				context: "story_sprite",
				state: "animated",
				hand_drawn: true,
				vectorial: false,
				three_dimensional: false,
				live_action: false,
				frequency: "some",
			}),
		).toMatchObject({ kind: "animation", handDrawn: true, frequency: "some" });
		expect(() =>
			decodeSoftwareComponentSnapshot("animation", {
				context: "story_sprite",
				state: "animated",
				hand_drawn: false,
				vectorial: false,
				three_dimensional: false,
				live_action: false,
				frequency: "some",
			}),
		).toThrow();
	});
});
