import { expect, test } from "vitest";
import { musicBrainzAcquisitionDescriptor, MusicBrainzLookupObjectTypes } from "./musicbrainz-acquisition";

const id = "11111111-1111-4111-8111-111111111111";
test("all documented primary lookup families receive code-owned URLs", () => {
	for (const type of MusicBrainzLookupObjectTypes) {
		const request = musicBrainzAcquisitionDescriptor(type, id);
		expect(new URL(request.url).hostname).toBe("musicbrainz.org");
		expect(request.method).toBe("GET");
	}
});
test("physical release requests include track/disc/label data and all relationship levels", () => {
	const descriptor = musicBrainzAcquisitionDescriptor("release", id);
	expect(descriptor.profiles?.map((profile) => profile.key)).toEqual(["tracks", "media", "metadata"]);
	const includes = Object.fromEntries(
		(descriptor.profiles ?? []).map((profile) => [
			profile.key,
			new URL(profile.url).searchParams.get("inc")?.split(/[+\s]/).filter(Boolean) ?? [],
		]),
	);
	for (const include of ["recordings", "media", "artist-credits"])
		expect(includes.tracks).toContain(include);
	for (const include of ["recordings", "media", "discids", "isrcs"])
		expect(includes.media).toContain(include);
	for (const include of ["labels", "aliases", "annotation", "artist-credits", "release-groups", "artist-rels", "label-rels", "url-rels"])
		expect(includes.metadata).toContain(include);
	for (const include of ["recording-level-rels", "release-group-level-rels", "work-level-rels"]) {
		expect(includes.tracks).not.toContain(include);
		expect(includes.media).not.toContain(include);
		expect(includes.metadata).not.toContain(include);
	}
	expect(descriptor.url).toBe(descriptor.profiles?.[0]?.url);
});
test("artist lookup does not misrepresent a 25-result embedded discography as complete", () => {
	const include = new URL(musicBrainzAcquisitionDescriptor("artist", id).url).searchParams.get("inc")?.split(" ");
	for (const truncated of ["releases", "recordings", "release-groups", "works"]) expect(include).not.toContain(truncated);
});
test("rejects unknown source families, arbitrary URLs and redirected identities", () => {
	expect(() => musicBrainzAcquisitionDescriptor("medium_attribute", id)).toThrow();
	expect(() => musicBrainzAcquisitionDescriptor("release", "https://localhost/private")).toThrow();
	expect(() => musicBrainzAcquisitionDescriptor("work", id).parse({ id: "22222222-2222-4222-8222-222222222222", title: "Other" })).toThrow("redirect requiring review");
});
