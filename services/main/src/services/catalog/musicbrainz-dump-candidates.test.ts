import { describe, expect, it } from "vitest";
import { MusicBrainzDumpCandidateSchema } from "./musicbrainz-dump-candidates";

const fixture = {
	id: 2,
	title: "Unidentified disc",
	artist: null,
	tracks: [{ id: 3, release: 2, title: "", sequence: 1 }],
	tocs: [
		{
			id: 4,
			release: 2,
			discid: "XzPS7vW.HPHsYemQh0HBUGr8vuU-",
			track_count: 1,
			leadout_offset: 50000,
			track_offset: [150],
		},
	],
};
describe("MusicBrainz incomplete dump candidates", () => {
	it("retains unknown artist/title without inventing a recording or artist", () => {
		const parsed = MusicBrainzDumpCandidateSchema.parse(fixture);
		expect(parsed.artist).toBeNull();
		expect(parsed.tracks[0]?.title).toBe("");
	});
	it("rejects a joined track from another candidate", () => {
		expect(
			MusicBrainzDumpCandidateSchema.safeParse({
				...fixture,
				tracks: [{ ...fixture.tracks[0], release: 9 }],
			}).success,
		).toBe(false);
	});
	it("rejects duplicate occurrence positions and mismatched TOCs", () => {
		expect(
			MusicBrainzDumpCandidateSchema.safeParse({
				...fixture,
				tracks: [fixture.tracks[0], { ...fixture.tracks[0], id: 5 }],
			}).success,
		).toBe(false);
		expect(
			MusicBrainzDumpCandidateSchema.safeParse({
				...fixture,
				tocs: [{ ...fixture.tocs[0], track_count: 2 }],
			}).success,
		).toBe(false);
	});
});
