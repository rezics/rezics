import { z } from "zod";

/** Pinned SQL catalog contract used for native identity/structure semantics. */
export const MusicBrainzCatalogContractSha256 =
	"92d1981a0d4f5032bca1565d27fafa8a0eac4d11b7f34feab71bfde8a00ecb13";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const artist = z
	.object({ id: z.uuid(), name: z.string(), type: z.string().nullable().optional() })
	.passthrough();
const credit = z.array(
	z.object({ artist, name: z.string(), joinphrase: z.string().optional() }).passthrough(),
);
const recording = z
	.object({
		id: z.uuid(),
		title: z.string(),
		length: integer.nullable().optional(),
		video: z.boolean().optional(),
		"artist-credit": credit.optional(),
	})
	.passthrough();
const track = z
	.object({
		id: z.uuid(),
		title: z.string(),
		position: integer,
		number: z.string(),
		length: integer.nullable().optional(),
		recording,
		"artist-credit": credit.optional(),
	})
	.passthrough();

export const MusicBrainzReleaseSchema = z
	.object({
		id: z.uuid(),
		title: z.string(),
		"artist-credit": credit.optional(),
		"release-group": z.object({ id: z.uuid(), title: z.string() }).passthrough().optional(),
		media: z.array(
			z
				.object({
					id: z.uuid(),
					position: integer,
					title: z.string().optional(),
					"track-count": integer.optional(),
					tracks: z.array(track),
					discs: z.array(z.unknown()).optional(),
				})
				.passthrough(),
		),
	})
	.passthrough();
export type MusicBrainzRelease = z.infer<typeof MusicBrainzReleaseSchema>;
export type MusicBrainzCredit = z.infer<typeof credit>;

export function musicBrainzSourceKey(
	objectType: "artist" | "recording" | "release_group" | "release" | "work",
	id: string,
) {
	return { source: "musicbrainz", objectType, externalId: z.uuid().parse(id) };
}
