import { describe, expect, it } from "vitest";
import {
	MusicBrainzReleaseSchema,
	MusicBrainzDiscSchema,
	MusicBrainzWorkSchema,
	MusicBrainzRelationSchema,
	musicBrainzDate,
} from "./musicbrainz";

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
		const track = release.media[0]?.tracks?.[0];
		expect(track?.number).toBe("A1");
		expect(track?.id).not.toBe(track?.recording.id);
		expect(track?.length).toBe(300000);
		expect(track?.recording.length).toBe(301133);
	});
});

describe("MusicBrainz physical release conformance", () => {
	it("accepts an unknown tracklist without manufacturing tracks or a medium MBID", () => {
		const value = MusicBrainzReleaseSchema.parse({
			id: "f922ec87-4758-421d-a839-3193455345ff",
			title: "Unknown contents",
			media: [{ position: 1, format: "12″ Vinyl", "track-count": 0 }],
		});
		expect(value.media[0]?.tracks).toBeUndefined();
		expect(value.media[0]?.id).toBeUndefined();
	});
	it("retains multiple regional partial dates, packaging and label catalog numbers", () => {
		const value = MusicBrainzReleaseSchema.parse({
			id: "f922ec87-4758-421d-a839-3193455345ff",
			title: "Physical album",
			barcode: "",
			packaging: "Jewel Case",
			status: "Official",
			"text-representation": { language: "jpn", script: "Jpan" },
			"release-events": [{ date: "2001" }, { date: "2001-02" }],
			"label-info": [{ "catalog-number": "ABC-001", label: null }, { "catalog-number": "DEF-9" }],
			media: [],
		});
		expect(value.barcode).toBe("");
		expect(value["label-info"]?.map((row) => row["catalog-number"])).toEqual(["ABC-001", "DEF-9"]);
		expect(musicBrainzDate(value["release-events"]?.[1]?.date)).toEqual({
			year: 2001,
			month: 2,
			day: null,
		});
	});
	it("validates TOC shape, rather than treating a disc ID as recording identity", () => {
		const input = {
			id: "XzPS7vW.HPHsYemQh0HBUGr8vuU-",
			sectors: 30000,
			"offset-count": 2,
			offsets: [150, 15000],
		};
		expect(MusicBrainzDiscSchema.parse(input).offsets).toEqual([150, 15000]);
		for (const invalid of [
			{ ...input, "offset-count": 3 },
			{ ...input, offsets: [150, 150] },
			{ ...input, offsets: [150, 30000] },
		])
			expect(MusicBrainzDiscSchema.safeParse(invalid).success).toBe(false);
	});
	it("rejects invalid calendar precision and retains unknown components", () => {
		expect(musicBrainzDate("????-02-29")).toEqual({ year: null, month: 2, day: 29 });
		expect(musicBrainzDate("2000-??-03")).toEqual({ year: 2000, month: null, day: 3 });
		expect(() => musicBrainzDate("1900-02-29")).toThrow();
		expect(() => musicBrainzDate("2020-13")).toThrow();
	});
	it("keeps work identifier and language multiplicity independent from recording", () => {
		const value = MusicBrainzWorkSchema.parse({
			id: "f922ec87-4758-421d-a839-3193455345ff",
			title: "Work",
			languages: ["jpn", "eng"],
			iswcs: ["T-123.456.789-0", "T-123.456.789-1"],
		});
		expect(value.languages).toHaveLength(2);
		expect(value.iswcs).toHaveLength(2);
	});
	it("requires a typed target and preserves relationship attribute identity, value and credit", () => {
		const input = {
			"type-id": "f922ec87-4758-421d-a839-3193455345ff",
			type: "performance",
			direction: "forward",
			"target-type": "work",
			attributes: ["live"],
			"attribute-ids": { live: "f922ec87-4758-421d-a839-3193455345ff" },
			"attribute-credits": { live: "Live" },
			"attribute-values": { live: "Session" },
			ended: false,
		};
		expect(MusicBrainzRelationSchema.safeParse(input).success).toBe(false);
		const value = MusicBrainzRelationSchema.parse({
			...input,
			work: { id: "f922ec87-4758-421d-a839-3193455345ff", title: "Work" },
		});
		expect(value["attribute-values"]?.live).toBe("Session");
		expect(value.ended).toBe(false);
	});
});
