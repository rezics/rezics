import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MusicBrainzCatalogContractSha256 } from "./musicbrainz";
import {
	MusicBrainzArtistEndpointSchema,
	MusicBrainzEventEndpointSchema,
	MusicBrainzPlaceEndpointSchema,
	musicBrainzArtistShape,
	musicBrainzLabelShape,
	musicBrainzLifecycle,
	parseMusicBrainzSupportingEndpoint,
	parseMusicBrainzSupportingDocument,
} from "./musicbrainz-entities";

const id = "ee797783-c5d3-49ef-a072-75f7b9d10670";

describe("MusicBrainz supporting endpoint semantics", () => {
	it("checks bytes, reviewed contract and source identity before projection", () => {
		const bytes = Buffer.from(JSON.stringify({ id, name: "Artist" }));
		const receipt = {
			key: { source: "musicbrainz", objectType: "artist", externalId: id },
			contentSha256: createHash("sha256").update(bytes).digest("hex"),
			contractSha256: MusicBrainzCatalogContractSha256,
		};
		expect(parseMusicBrainzSupportingDocument(receipt, bytes).type).toBe("artist");
		expect(() => parseMusicBrainzSupportingDocument(receipt, Buffer.from("{}"))).toThrow(
			"bytes differ",
		);
		expect(() =>
			parseMusicBrainzSupportingDocument({ ...receipt, contractSha256: "0".repeat(64) }, bytes),
		).toThrow("not been reviewed");
		expect(() =>
			parseMusicBrainzSupportingDocument(
				{ ...receipt, key: { ...receipt.key, source: "other" } },
				bytes,
			),
		).toThrow("differs from its source key");
		expect(() =>
			parseMusicBrainzSupportingDocument(
				{ ...receipt, key: { ...receipt.key, externalId: "089f392d-2b9b-43b1-bb66-e3b44997a68e" } },
				bytes,
			),
		).toThrow("differs from its source key");
	});
	it.each(["artist", "label", "area", "place", "event", "instrument", "series", "genre", "mood"])(
		"checks %s identity and retains endpoint discriminant",
		(type) => {
			expect(
				parseMusicBrainzSupportingEndpoint(type, { id, name: "同名", future: { opaque: true } }),
			).toMatchObject({ type, record: { id, name: "同名" } });
			expect(() =>
				parseMusicBrainzSupportingEndpoint(type, { id: "external text", name: "A" }),
			).toThrow();
		},
	);
	it("checks URL resources and rejects arbitrary endpoint dispatch", () => {
		expect(
			parseMusicBrainzSupportingEndpoint("url", { id, resource: "https://example.org/record?a=1" }),
		).toMatchObject({ type: "url", record: { resource: "https://example.org/record?a=1" } });
		expect(() =>
			parseMusicBrainzSupportingEndpoint("url", { id, resource: "not a URL" }),
		).toThrow();
		expect(() => parseMusicBrainzSupportingEndpoint("recording", { id, title: "A" })).toThrow();
	});
	it("does not infer collective or person semantics from unknown artist types", () => {
		expect(musicBrainzArtistShape("Person")).toBe("person");
		expect(musicBrainzArtistShape("Character")).toBe("character");
		for (const type of ["Group", "Orchestra", "Choir"])
			expect(musicBrainzArtistShape(type)).toBe("collective");
		for (const type of ["Other", "New provider type", null, undefined])
			expect(musicBrainzArtistShape(type)).toBe("unresolved");
	});
	it("distinguishes imprints from explicit company activities", () => {
		for (const type of ["Imprint", null, undefined, "Other"])
			expect(musicBrainzLabelShape(type)).toBe("label");
		for (const type of ["Holding", "Distributor"])
			expect(musicBrainzLabelShape(type)).toBe("organization");
	});
	it("retains real-world character concept lifecycle without fictional birthday inference", () => {
		const artist = MusicBrainzArtistEndpointSchema.parse({
			id,
			name: "Character",
			type: "Character",
			"life-span": { begin: "1998-??-12", end: null, ended: false },
		});
		expect(musicBrainzLifecycle(artist["life-span"])).toEqual({
			begin: { year: 1998, month: null, day: 12, text: "1998-??-12" },
			end: null,
			ended: false,
		});
		expect(musicBrainzLifecycle(undefined)).toEqual({ begin: null, end: null, ended: null });
		expect(() =>
			MusicBrainzArtistEndpointSchema.parse({
				id,
				name: "A",
				"life-span": { begin: "2023-02-29" },
			}),
		).toThrow();
	});
	it("preserves aliases independently with language, sorting and period", () => {
		const alias = {
			name: "Same",
			"sort-name": "Same, The",
			type: "Legal name",
			"type-id": id,
			locale: "ja",
			primary: false,
			begin: "2001",
			end: "2004-05",
			ended: true,
		};
		const record = MusicBrainzArtistEndpointSchema.parse({
			id,
			name: "Same",
			aliases: [alias, { ...alias, locale: "en" }],
		});
		expect(record.aliases).toHaveLength(2);
		expect(record.aliases?.[0]).toEqual(alias);
	});
	it("requires paired finite geographic coordinates and preserves exact numeric meaning", () => {
		expect(
			MusicBrainzPlaceEndpointSchema.parse({
				id,
				name: "Venue",
				coordinates: { latitude: "35.5", longitude: "139.75" },
			}).coordinates,
		).toEqual({ latitude: 35.5, longitude: 139.75 });
		for (const coordinates of [
			{ latitude: 10 },
			{ latitude: "", longitude: 0 },
			{ latitude: 91, longitude: 0 },
			{ latitude: "NaN", longitude: 0 },
		])
			expect(
				MusicBrainzPlaceEndpointSchema.safeParse({ id, name: "Venue", coordinates }).success,
			).toBe(false);
	});
	it("keeps event local time, cancellation and setlist distinct", () => {
		expect(
			MusicBrainzEventEndpointSchema.parse({
				id,
				name: "Concert",
				time: "19:30",
				cancelled: false,
				setlist: "1. A\n2. B",
				"life-span": { begin: "2001-04-05", end: "2001-04-06", ended: true },
			}),
		).toMatchObject({ time: "19:30", cancelled: false, setlist: "1. A\n2. B" });
		expect(
			MusicBrainzEventEndpointSchema.safeParse({ id, name: "Concert", time: "25:00" }).success,
		).toBe(false);
	});
	it("bounds per-document alias fanout", () => {
		expect(
			MusicBrainzArtistEndpointSchema.safeParse({
				id,
				name: "A",
				aliases: Array.from({ length: 8193 }, () => ({ name: "A" })),
			}).success,
		).toBe(false);
	});
});
