import { SOURCE_DOCUMENT_BYTE_LIMIT } from "@rezics/schema/postgres/ingestion/source-limits";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { MusicBrainzReleaseSchema, type MusicBrainzArtistSchema, type MusicBrainzCredit, type MusicBrainzRelease } from "./musicbrainz";
import type { CatalogSourceReceipt } from "./source-observations";
import { preflightMusicBrainzReleaseDelta, tracks } from "./musicbrainz-release-plan";

export const MusicBrainzReleaseBundleProfile = "musicbrainz.release.owned.1";
export const MusicBrainzReleaseBundleDerivationSha256 = createHash("sha256").update("REZICS musicbrainz.release.owned.1: tracks+printed-credits; media+TOCs+ISRCs; root-metadata+relations; overlap-check; minimal-reference-native-view").digest("hex");
export const MusicBrainzReleaseRawProfileKeys = ["tracks", "media", "metadata"] as const;
const relationshipIncludes = ["area-rels", "artist-rels", "event-rels", "genre-rels", "instrument-rels", "label-rels", "place-rels", "recording-rels", "release-rels", "release-group-rels", "series-rels", "url-rels", "work-rels"];

/** Three bounded raw views preserve release-owned fields without expanding recording/work relationship graphs. */
export function musicBrainzReleaseAcquisitionProfiles(externalId: string) {
	const id = z.uuid().parse(externalId);
	return MusicBrainzReleaseRawProfileKeys.map((key) => {
		const includes = key === "tracks" ? ["recordings", "media", "artist-credits"]
			: key === "media" ? ["recordings", "media", "discids", "isrcs"]
				: ["aliases", "annotation", "labels", "release-groups", "artist-credits", ...relationshipIncludes];
		return { key, profile: `${MusicBrainzReleaseBundleProfile}.${key}`, url: `https://musicbrainz.org/ws/2/release/${id}?fmt=json&inc=${includes.join("+")}` };
	});
}

/** Runtime node/depth admission is independent of the fixed archive byte bound. */
export function boundedSourceJson(bytes: Uint8Array): unknown {
	if (bytes.byteLength > SOURCE_DOCUMENT_BYTE_LIMIT) throw new RangeError("Multipart source profile exceeds 8 MB");
	const document: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const stack = [{ value: document, depth: 0 }]; let nodes = 0;
	while (stack.length) {
		const item = stack.pop()!;
		if (++nodes > 1_000_000 || item.depth > 64) throw new RangeError("Source profile exceeds its structural grammar budget");
		if (item.value !== null && typeof item.value === "object") for (const value of Object.values(item.value)) stack.push({ value, depth: item.depth + 1 });
	}
	return document;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function assertOverlap(left: unknown, right: unknown, path: string) {
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) throw new TypeError(`MusicBrainz profiles disagree on array length: ${path}`);
		for (let index = 0; index < left.length; index++) assertOverlap(left[index], right[index], `${path}/${index}`);
	} else if (object(left) && object(right)) {
		for (const key of Object.keys(left)) if (Object.hasOwn(right, key)) assertOverlap(left[key], right[key], `${path}/${key}`);
	} else if (!isDeepStrictEqual(left, right)) throw new TypeError(`MusicBrainz profiles disagree on overlapping evidence: ${path}`);
}
function artist(input: z.infer<typeof MusicBrainzArtistSchema>) {
	return { id: input.id, name: input.name, "sort-name": input["sort-name"], type: input.type, "type-id": input["type-id"], disambiguation: input.disambiguation };
}
function credit(input: MusicBrainzCredit | undefined): MusicBrainzCredit | undefined {
	return input?.map((member) => ({ name: member.name, joinphrase: member.joinphrase, artist: artist(member.artist) }));
}

/** @internal Raw profiles remain unchanged. The actual archived native_view contains only modeled release fields and reference data. */
export function normalizeMusicBrainzReleaseBundle(externalId: string, input: Record<(typeof MusicBrainzReleaseRawProfileKeys)[number], Uint8Array>) {
	const rawTracks = boundedSourceJson(input.tracks), rawMedia = boundedSourceJson(input.media), rawMetadata = boundedSourceJson(input.metadata);
	if (!object(rawTracks) || !object(rawMedia) || !object(rawMetadata)) throw new TypeError("Release profiles require JSON objects");
	if ([rawTracks.id, rawMedia.id, rawMetadata.id].some((id) => id !== externalId)) throw new TypeError("Multipart release profiles cross upstream identities");
	const { media: _rawTracksMedia, ...tracksRoot } = rawTracks, { media: _rawMediaMedia, ...mediaRootRaw } = rawMedia, { media: _rawMetadataMedia, ...metadataRoot } = rawMetadata;
	// Unknown shared fields remain evidence too, even when the native mapper does not own them.
	assertOverlap(tracksRoot, mediaRootRaw, "/"); assertOverlap(tracksRoot, metadataRoot, "/"); assertOverlap(mediaRootRaw, metadataRoot, "/");
	const structure = MusicBrainzReleaseSchema.strip().parse(rawTracks);
	const media = MusicBrainzReleaseSchema.strip().parse(rawMedia);
	const metadata = MusicBrainzReleaseSchema.omit({ media: true }).strip().parse(rawMetadata);
	if ([structure.id, media.id, metadata.id].some((id) => id !== externalId)) throw new TypeError("Multipart release profiles cross upstream identities");
	const { media: _tracksMedia, ...structureRoot } = structure, { media: _mediaMedia, ...mediaRoot } = media;
	assertOverlap(structureRoot, mediaRoot, "/"); assertOverlap(structureRoot, metadata, "/"); assertOverlap(mediaRoot, metadata, "/");
	const mediaByPosition = new Map(media.media.map((medium) => [medium.position, medium]));
	if (mediaByPosition.size !== media.media.length || new Set(structure.media.map((medium) => medium.position)).size !== structure.media.length || media.media.length !== structure.media.length)
		throw new TypeError("Multipart release medium counts or positions disagree");
	const result: MusicBrainzRelease = { ...metadata, "artist-credit": credit(structure["artist-credit"]),
		"release-group": metadata["release-group"] ? { ...metadata["release-group"], "artist-credit": credit(metadata["release-group"]["artist-credit"]) } : undefined,
		media: structure.media.map((medium, index) => {
			const support = mediaByPosition.get(medium.position);
			if (!support) throw new TypeError("Multipart release medium correspondence is missing");
			assertOverlap(medium, support, `/media/${index}`);
			const supportTracks = new Map(tracks(support, index).map((entry) => [entry.track.id, entry.track]));
			if (supportTracks.size !== tracks(support, index).length || tracks(medium, index).length !== supportTracks.size)
				throw new TypeError("Multipart release track counts or identities disagree");
			const track = (entry: NonNullable<(typeof medium)["tracks"]>[number]) => {
				const supported = supportTracks.get(entry.id);
				if (!supported || supported.recording.id !== entry.recording.id) throw new TypeError("Multipart release recording correspondence differs");
				return { id: entry.id, position: entry.position, number: entry.number, title: entry.title, length: entry.length,
					"artist-credit": credit(entry["artist-credit"]), recording: { id: entry.recording.id, title: entry.recording.title,
						length: entry.recording.length, video: entry.recording.video, disambiguation: entry.recording.disambiguation,
						isrcs: supported.recording.isrcs, "artist-credit": credit(entry.recording["artist-credit"]) } };
			};
			return { id: medium.id, position: medium.position, title: medium.title, format: medium.format, "format-id": medium["format-id"],
				"track-count": medium["track-count"], discs: support.discs, tracks: medium.tracks?.map(track), "data-tracks": medium["data-tracks"]?.map(track), pregap: medium.pregap ? track(medium.pregap) : undefined };
		}),
	};
	preflightMusicBrainzReleaseDelta(result, result);
	const bytes = new TextEncoder().encode(JSON.stringify(result));
	if (bytes.byteLength > SOURCE_DOCUMENT_BYTE_LIMIT) throw new RangeError("Normalized release native view exceeds 8 MB");
	return { document: result, bytes };
}

/** @internal A derived part requires its reviewed recipe and complete profile identities. */
export function assertMusicBrainzReleaseArchive(receipt: CatalogSourceReceipt) {
	if (!receipt.bundle) return;
	const manifest = receipt.bundle.manifest;
	if (manifest.profile !== MusicBrainzReleaseBundleProfile || manifest.derivationContractSha256 !== MusicBrainzReleaseBundleDerivationSha256 ||
		manifest.parts.length !== 4 || MusicBrainzReleaseRawProfileKeys.some((key) => !manifest.parts.some((part) => part.key === key && part.kind === "upstream_response" && part.profile === `${MusicBrainzReleaseBundleProfile}.${key}`)) ||
		!manifest.parts.some((part) => part.key === "native_view" && part.kind === "derived_view" && part.profile === MusicBrainzReleaseBundleProfile))
		throw new TypeError("MusicBrainz release multipart recipe is not reviewed");
}
