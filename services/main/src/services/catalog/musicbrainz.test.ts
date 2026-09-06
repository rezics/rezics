import { describe, expect, it } from "vitest";
import { MusicBrainzReleaseSchema } from "./musicbrainz";

describe("MusicBrainz release source contract", () => {
	it("preserves separate track and recording identities, times and printed numbers", () => {
		const release = MusicBrainzReleaseSchema.parse({
			id: "f922ec87-4758-421d-a839-3193455345ff",
			title: "Fixture",
			media: [
				{
					id: "804a4f4c-711b-38d5-b4ff-9dd110b19736",
					position: 1,
					tracks: [
						{
							id: "36fe3880-4e12-4816-9e3d-dcdc57a953b5",
							position: 1,
							number: "A1",
							title: "Printed title",
							length: 300000,
							recording: {
								id: "5fb524f1-8cc8-4c04-a921-e34c0a911ea7",
								title: "Recording title",
								length: 301133,
								video: false,
							},
						},
					],
				},
			],
		});
		const track = release.media[0]?.tracks[0];
		expect(track?.number).toBe("A1");
		expect(track?.id).not.toBe(track?.recording.id);
		expect(track?.length).toBe(300000);
		expect(track?.recording.length).toBe(301133);
	});
});
