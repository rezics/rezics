import { musicBrainzReleaseAcquisitionProfiles } from "./musicbrainz-release-bundle";
import { z } from "zod";
import { MusicBrainzCatalogContractSha256, MusicBrainzRecordingSchema, MusicBrainzReleaseGroupSchema, MusicBrainzReleaseSchema, MusicBrainzWorkSchema } from "./musicbrainz";
import { parseMusicBrainzSupportingEndpoint } from "./musicbrainz-entities";

/** @internal WS/2 lookup resources verified against https://musicbrainz.org/doc/MusicBrainz_API. */
export const MusicBrainzLookupObjectTypes = ["release", "recording", "work", "release_group", "artist", "label", "area", "place", "event", "instrument", "series", "genre", "url"] as const;
const typeSchema = z.enum(MusicBrainzLookupObjectTypes);
const relationshipIncludes = ["area-rels", "artist-rels", "event-rels", "genre-rels", "instrument-rels", "label-rels", "place-rels", "recording-rels", "release-rels", "release-group-rels", "series-rels", "url-rels", "work-rels"];

/**
 * @internal Code-owned provider descriptor; transport, rates, deadlines and archive admission stay shared.
 * @remarks Artist/label discographies are acquired through paged browse or SQL ingestion. Embedding
 * their first 25 linked releases in a lookup is not a complete discography. SQL-only moods and
 * secondary/dump/art families do not acquire an invented WS/2 lookup URL here.
 */
export function musicBrainzAcquisitionDescriptor(objectType: string, externalId: string) {
	const type = typeSchema.parse(objectType);
	const id = z.uuid().parse(externalId);
	const endpoint = type === "release_group" ? "release-group" : type;
	const includes = type === "url" ? [...relationshipIncludes] : type === "genre" ? ["aliases", "annotation"] : ["aliases", "annotation", ...relationshipIncludes];
	if (type === "release") { includes.length = 0; includes.push("recordings", "media", "artist-credits"); }
	if (type === "recording") includes.push("artist-credits", "isrcs", "work-level-rels");
	if (type === "release_group") includes.push("artist-credits");
	return {
		url: `https://musicbrainz.org/ws/2/${endpoint}/${id}?fmt=json&inc=${[...new Set(includes)].join("+")}`,
		method: "GET" as const,
		...(type === "release" ? { profiles: musicBrainzReleaseAcquisitionProfiles(id) } : {}),
		contractSha256: MusicBrainzCatalogContractSha256,
		parse(input: unknown) {
			const record = type === "release" ? MusicBrainzReleaseSchema.parse(input) : type === "recording" ? MusicBrainzRecordingSchema.parse(input) : type === "work" ? MusicBrainzWorkSchema.parse(input) : type === "release_group" ? MusicBrainzReleaseGroupSchema.parse(input) : parseMusicBrainzSupportingEndpoint(type, input).record;
			if (record.id !== id) throw new TypeError("MusicBrainz lookup returned another entity or a redirect requiring review");
			return record;
		},
	};
}
