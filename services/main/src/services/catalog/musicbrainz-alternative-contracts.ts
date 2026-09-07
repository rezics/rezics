import { z } from "zod";
import { MusicBrainzCreditSchema } from "./musicbrainz";

const localId = z.number().int().positive().max(2147483647);
const title = z.string().min(1).max(131072).nullable();
const alternativeTrack = z
	.strictObject({ id: localId, name: title, "artist-credit": MusicBrainzCreditSchema.optional() })
	.refine(
		(row) => row.name !== null || Boolean(row["artist-credit"]?.length),
		"Alternative track needs a name or credit",
	);

/**
 * @alpha Reviewed joined public SQL alternative_release/medium/track contract.
 * @remarks Numeric IDs identify rows only within this archived join. The containing release,
 * medium and original track use their actual MBIDs, not positional guesses or a new recording.
 */
export const MusicBrainzAlternativeReleaseDumpSchema = z
	.strictObject({
		id: localId,
		gid: z.uuid(),
		release: z.strictObject({ id: localId, gid: z.uuid() }),
		name: title,
		"artist-credit": MusicBrainzCreditSchema.optional(),
		type: z.strictObject({ gid: z.uuid(), name: z.string().min(1).max(512) }),
		language: z.string().min(1).max(255).nullable(),
		script: z
			.string()
			.regex(/^[A-Z][a-z]{3}$/u)
			.nullable(),
		comment: z.string().max(131072),
		media: z
			.array(
				z.strictObject({
					id: localId,
					alternative_release: localId,
					medium: z.strictObject({ id: localId, gid: z.uuid(), release: localId }),
					name: title,
					tracks: z
						.array(
							z.strictObject({
								alternative_medium: localId,
								track: z.strictObject({ id: localId, gid: z.uuid(), medium: localId }),
								alternative_track: alternativeTrack,
							}),
						)
						.max(8192),
				}),
			)
			.max(4096),
	})
	.superRefine((record, ctx) => {
		const media = new Set<number>();
		const mediaIds = new Set<string>();
		const alternates = new Map<number, string>();
		for (const medium of record.media) {
			if (medium.alternative_release !== record.id || medium.medium.release !== record.release.id)
				ctx.addIssue({
					code: "custom",
					message: "Alternative medium join crosses release identity",
				});
			if (media.has(medium.id) || mediaIds.has(medium.medium.gid))
				ctx.addIssue({ code: "custom", message: "Duplicate alternative medium identity" });
			media.add(medium.id);
			mediaIds.add(medium.medium.gid);
			const tracks = new Set<string>();
			for (const track of medium.tracks) {
				if (track.alternative_medium !== medium.id || track.track.medium !== medium.medium.id)
					ctx.addIssue({
						code: "custom",
						message: "Alternative track join crosses medium identity",
					});
				if (tracks.has(track.track.gid))
					ctx.addIssue({ code: "custom", message: "Duplicate alternative track occurrence" });
				tracks.add(track.track.gid);
				const signature = JSON.stringify(track.alternative_track);
				const previous = alternates.get(track.alternative_track.id);
				if (previous && previous !== signature)
					ctx.addIssue({
						code: "custom",
						message: "Shared alternative-track row has inconsistent joined values",
					});
				alternates.set(track.alternative_track.id, signature);
			}
		}
	});
export type MusicBrainzAlternativeReleaseDump = z.infer<
	typeof MusicBrainzAlternativeReleaseDumpSchema
>;
