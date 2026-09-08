import { describe, expect, test } from "vitest";
import { normalizeMusicBrainzReleaseBundle } from "./musicbrainz-release-bundle";

const id = "11111111-1111-4111-8111-111111111111", trackId = "22222222-2222-4222-8222-222222222222", recordingId = "33333333-3333-4333-8333-333333333333";
const printedArtist = { id: "44444444-4444-4444-8444-444444444444", name: "Printed artist", aliases: [{ name: "Nested data remains in raw profile" }] };
const recordingArtist = { id: "55555555-5555-4555-8555-555555555555", name: "Recording artist" };
const root = { id, title: "Release", barcode: "001", "artist-credit": [{ name: "Printed artist", artist: printedArtist }] };
const track = { id: trackId, position: 1, title: "Track", number: "A1", "artist-credit": [{ name: "Printed artist", artist: printedArtist }], recording: { id: recordingId, title: "Recording", "artist-credit": [{ name: "Recording artist", artist: recordingArtist }] } };
const disc = { id: "x".repeat(28), sectors: 30000, offsets: [150], "offset-count": 1 };
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
function profiles() {
	return {
		tracks: bytes({ ...root, media: [{ position: 1, format: "CD", tracks: [track] }] }),
		media: bytes({ id, title: "Release", barcode: "001", media: [{ position: 1, format: "CD", discs: [disc], tracks: [{ id: trackId, position: 1, title: "Track", number: "A1", recording: { id: recordingId, title: "Recording", isrcs: ["USAAA2000001"] } }] }] }),
		metadata: bytes({ ...root, aliases: [{ name: "Release alias", locale: "en" }], annotation: "Release-owned note", relations: [] }),
	};
}
describe("MusicBrainz compound release native view", () => {
	test("preserves printed track credit, recording credit, TOCs, ISRCs and release metadata independently", () => {
		const raw = profiles(), copied = raw.tracks.slice();
		const result = normalizeMusicBrainzReleaseBundle(id, raw);
		expect(result.document.media[0]?.tracks?.[0]?.["artist-credit"]?.[0]?.artist.id).toBe(printedArtist.id);
		expect(result.document.media[0]?.tracks?.[0]?.recording["artist-credit"]?.[0]?.artist.id).toBe(recordingArtist.id);
		expect(result.document.media[0]?.tracks?.[0]?.recording.isrcs).toEqual(["USAAA2000001"]);
		expect(result.document.media[0]?.discs).toEqual([disc]);
		expect(result.document.aliases?.[0]?.name).toBe("Release alias");
		expect(result.document.annotation).toBe("Release-owned note");
		expect(new TextDecoder().decode(result.bytes)).not.toContain("Nested data remains in raw profile");
		expect(raw.tracks).toEqual(copied);
	});
	test("overlapping scalar, identity and medium/track position conflicts block the entire assembly", () => {
		const raw = profiles();
		expect(() => normalizeMusicBrainzReleaseBundle(id, { ...raw, metadata: bytes({ ...root, title: "A later title" }) })).toThrow("overlapping evidence");
		expect(() => normalizeMusicBrainzReleaseBundle(id, { ...raw, metadata: bytes({ ...root, id: recordingId }) })).toThrow("identities");
		expect(() => normalizeMusicBrainzReleaseBundle(id, { ...raw, media: bytes({ ...root, media: [{ position: 2, tracks: [track] }] }) })).toThrow("correspondence");
		expect(() => normalizeMusicBrainzReleaseBundle(id, { ...raw, media: bytes({ ...root, media: [{ position: 1, tracks: [{ ...track, position: 2 }] }] }) })).toThrow("overlapping evidence");
	});
});
