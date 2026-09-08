import { expect, test } from "vitest";
import { MusicBrainzAlternativeReleaseDumpSchema } from "./musicbrainz-alternative-contracts";

const gid = "11111111-1111-4111-8111-111111111111";
const document = {
	id: 1,
	gid,
	release: { id: 2, gid },
	name: "Alternative title",
	type: { gid, name: "Translation" },
	language: "ja",
	script: "Jpan",
	comment: "",
	media: [
		{
			id: 3,
			alternative_release: 1,
			medium: { id: 4, gid, release: 2 },
			name: null,
			tracks: [
				{
					alternative_medium: 3,
					track: { id: 5, gid, medium: 4 },
					alternative_track: { id: 6, name: "Alternative track" },
				},
			],
		},
	],
};
test("alternative tracklist retains native occurrence grain and source join identities", () => {
	expect(
		MusicBrainzAlternativeReleaseDumpSchema.parse(document).media[0]?.tracks[0]?.alternative_track
			.id,
	).toBe(6);
});
test("alternative tracklist rejects a cross-release or cross-medium join", () => {
	const crossed = structuredClone(document);
	crossed.media[0]!.tracks[0]!.track.medium = 99;
	expect(MusicBrainzAlternativeReleaseDumpSchema.safeParse(crossed).success).toBe(false);
});
test("alternative track text or credit must carry native content", () => {
	const empty = {
		...document,
		media: [
			{
				...document.media[0]!,
				tracks: [{ ...document.media[0]!.tracks[0]!, alternative_track: { id: 6, name: null } }],
			},
		],
	};
	expect(MusicBrainzAlternativeReleaseDumpSchema.safeParse(empty).success).toBe(false);
});
