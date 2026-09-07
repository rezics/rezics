import { expect, test } from "bun:test";
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
	const url = musicBrainzAcquisitionDescriptor("release", id).url;
	for (const include of ["labels", "discids", "recordings", "artist-credits", "recording-level-rels", "release-group-level-rels", "work-level-rels", "aliases", "annotation"]) expect(url).toContain(include);
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
