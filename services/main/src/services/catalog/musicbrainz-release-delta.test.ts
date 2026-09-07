import { describe, expect, test } from "bun:test";
import {
	correlateMusicBrainzMedia,
	preflightMusicBrainzReleaseDelta,
} from "./musicbrainz-release-plan";
import { MusicBrainzReleaseSchema } from "./musicbrainz";

const releaseId = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";
const track = (id: string) => ({
	id,
	title: "Track",
	number: "1",
	position: 1,
	recording: { id, title: "Recording" },
});
const release = MusicBrainzReleaseSchema.parse({
	id: releaseId,
	title: "Album",
	media: [
		{ position: 1, tracks: [track(first)] },
		{ position: 2, tracks: [track(second)] },
	],
});

describe("MusicBrainz archived structural delta admission", () => {
	test("reorders anonymous media by stable track membership", () => {
		const reordered = MusicBrainzReleaseSchema.parse({
			...release,
			media: [
				{ ...release.media[1], position: 1 },
				{ ...release.media[0], position: 2 },
			],
		});
		expect(correlateMusicBrainzMedia(release, reordered)).toEqual([1, 0]);
	});
	test("does not silently infer a merged medium's identity", () => {
		const merged = MusicBrainzReleaseSchema.parse({
			...release,
			media: [{ position: 1, tracks: [track(first), { ...track(second), position: 2 }] }],
		});
		expect(() => correlateMusicBrainzMedia(release, merged)).toThrow(
			"explicit reviewed structural mapping",
		);
	});
	test("duplicate track identities cannot overwrite the native correspondence map", () => {
		const duplicate = MusicBrainzReleaseSchema.parse({
			...release,
			media: [{ position: 1, tracks: [track(first), { ...track(first), position: 2 }] }],
		});
		expect(() => preflightMusicBrainzReleaseDelta(release, duplicate)).toThrow("Duplicate");
	});
	test("large sources require staged activation before an atomic writer starts", () => {
		const large = MusicBrainzReleaseSchema.parse({
			...release,
			media: Array.from({ length: 129 }, (_, i) => ({ position: i + 1 })),
		});
		expect(() => preflightMusicBrainzReleaseDelta(release, large)).toThrow("staged application");
	});
	test("unsupported changed semantic fields cannot silently count as a successful projection", () => {
		expect(() =>
			preflightMusicBrainzReleaseDelta(release, { ...release, asin: "B000000001" }),
		).toThrow("native semantic writer");
	});
});
