import { describe, expect, it } from "vitest";
import { planMusicBrainzDependencies } from "./musicbrainz-dependencies";

const id = "11111111-1111-4111-8111-111111111111";
const artist = { id, name: "Artist" };

describe("MusicBrainz pending proposal dependency plan", () => {
	it("deduplicates a shared artist while retaining an exact archived reference path", () => {
		const plan = planMusicBrainzDependencies("release", {
			id,
			title: "Release",
			"artist-credit": [{ name: "Printed", artist }],
			media: [
				{
					position: 1,
					tracks: [
						{
							id,
							title: "Track",
							number: "1",
							position: 1,
							"artist-credit": [{ name: "Another spelling", artist }],
							recording: { id, title: "Recording" },
						},
					],
				},
			],
		});
		expect(plan.map(({ kind, path }) => ({ kind, path }))).toEqual([
			{ kind: "artist", path: "/artist-credit/0/artist/id" },
			{ kind: "recording", path: "/media/0/tracks/0/recording/id" },
		]);
	});
	it("retains taxonomy UUID identity and name-only evidence without confusing their paths", () => {
		const plan = planMusicBrainzDependencies("release", {
			id,
			title: "Release",
			status: "Official",
			"status-id": id,
			packaging: "Box",
			media: [],
		});
		expect(plan.map(({ kind, path }) => ({ kind, path }))).toEqual([
			{ kind: "vocabulary", path: "/status-id" },
			{ kind: "vocabulary", path: "/packaging" },
		]);
	});
	it("enforces admission on distinct dependencies before materialization", () => {
		expect(() =>
			planMusicBrainzDependencies("recording", {
				id,
				title: "Recording",
				"artist-credit": Array.from({ length: 129 }, () => ({
					name: "Artist",
					artist: { id: crypto.randomUUID(), name: "Artist" },
				})),
			}),
		).toThrow("staged preparation");
	});
	it("counts repeated credits once and rejects unsupported source objects", () => {
		expect(
			planMusicBrainzDependencies("recording", {
				id,
				title: "Recording",
				"artist-credit": Array.from({ length: 129 }, () => ({ name: "Artist", artist })),
			}),
		).toHaveLength(1);
		expect(() => planMusicBrainzDependencies("artist", artist)).toThrow();
	});
});
