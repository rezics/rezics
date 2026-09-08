import { describe, expect, test } from "bun:test";
import {
	correlateMusicBrainzMedia,
	correlateMusicBrainzDiscs,
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
	test("TOC correspondence consumes exact duplicate occurrences without property-order dependence", () => {
		const disc = { id: "x".repeat(28), sectors: 30000, offsets: [150], "offset-count": 1 };
		const reordered = { offsets: [150], "offset-count": 1, sectors: 30000, id: "x".repeat(28) };
		expect(correlateMusicBrainzDiscs([disc, disc], [reordered, disc, disc])).toEqual([0, 1, null]);
	});
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
	test("unchanged source rows do not consume the native mutation budget", () => {
		const large = MusicBrainzReleaseSchema.parse({
			...release,
			media: Array.from({ length: 129 }, (_, i) => ({ position: i + 1 })),
		});
		expect(() => preflightMusicBrainzReleaseDelta(large, { ...large, barcode: "1234" })).not.toThrow();
	});
	test("source occurrence read capacity is independent and explicit", () => {
		const tooLarge = MusicBrainzReleaseSchema.parse({ ...release, media: Array.from({ length: 4096 }, (_, i) => ({ position: i + 1, tracks: [track(crypto.randomUUID()), { ...track(crypto.randomUUID()), position: 2 }] })) });
		expect(() => preflightMusicBrainzReleaseDelta(tooLarge, tooLarge)).toThrow("source support");
	});
	test("admits identifier and relation fields covered by native semantic writers", () => {
		expect(
			preflightMusicBrainzReleaseDelta(release, { ...release, asin: "B000000001" }),
		).toBeUndefined();
		expect(
			preflightMusicBrainzReleaseDelta(release, { ...release, relations: [] }),
		).toBeUndefined();
	});
});
