import { z } from "zod";
import { CatalogPartialDateSchema } from "./contracts";

/** @alpha Pinned upstream catalog semantics; source observations retain extra supplied fields. */
export const MusicBrainzCatalogContractSha256 =
	"92d1981a0d4f5032bca1565d27fafa8a0eac4d11b7f34feab71bfde8a00ecb13";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const text = z.string().max(131_072);
const optionalText = text.nullable().optional();
const optionalId = z.uuid().nullable().optional();

/** Empty and unknown date components never acquire invented precision. */
export function musicBrainzDate(value: string | null | undefined) {
	if (!value) return { year: null, month: null, day: null };
	const match = /^(\d{4}|\?{4})(?:-(\d{2}|\?{2})(?:-(\d{2}|\?{2}))?)?$/u.exec(value);
	if (!match) throw new TypeError("Invalid MusicBrainz partial date");
	const part = (value: string | undefined) =>
		!value || value.includes("?") ? null : Number(value);
	return CatalogPartialDateSchema.parse({
		year: part(match[1]),
		month: part(match[2]),
		day: part(match[3]),
	});
}
const date = text.refine((value) => {
	try {
		musicBrainzDate(value);
		return true;
	} catch {
		return false;
	}
}, "Invalid partial date");

export const MusicBrainzAliasSchema = z
	.object({
		name: text,
		"sort-name": optionalText,
		locale: optionalText,
		type: optionalText,
		"type-id": optionalId,
		primary: z.boolean().nullable().optional(),
		begin: date.nullable().optional(),
		end: date.nullable().optional(),
		ended: z.boolean().nullable().optional(),
	})
	.passthrough();
export const MusicBrainzAreaSchema = z
	.object({
		id: z.uuid(),
		name: text,
		"sort-name": optionalText,
		disambiguation: optionalText,
		type: optionalText,
		"type-id": optionalId,
		"iso-3166-1-codes": z.array(text).optional(),
		"iso-3166-2-codes": z.array(text).optional(),
		"iso-3166-3-codes": z.array(text).optional(),
	})
	.passthrough();
export const MusicBrainzArtistSchema = z
	.object({
		id: z.uuid(),
		name: text,
		"sort-name": optionalText,
		type: optionalText,
		"type-id": optionalId,
		disambiguation: optionalText,
		aliases: z.array(MusicBrainzAliasSchema).optional(),
	})
	.passthrough();
export const MusicBrainzCreditSchema = z
	.array(
		z
			.object({
				artist: MusicBrainzArtistSchema,
				name: text.min(1),
				joinphrase: text.optional(),
			})
			.passthrough(),
	)
	.max(8192);

const relationshipTarget = z
	.object({ id: z.uuid(), name: optionalText, title: optionalText })
	.passthrough();
/** All catalog relationship metadata is typed before dispatch to native relation owners. */
export const MusicBrainzRelationSchema = z
	.object({
		"type-id": z.uuid(),
		type: text,
		direction: z.enum(["forward", "backward"]),
		"target-type": z.enum([
			"artist",
			"label",
			"area",
			"place",
			"event",
			"instrument",
			"series",
			"genre",
			"mood",
			"recording",
			"release",
			"release_group",
			"release-group",
			"work",
			"url",
		]),
		begin: date.nullable().optional(),
		end: date.nullable().optional(),
		ended: z.boolean().nullable().optional(),
		"ordering-key": integer.optional(),
		"source-credit": optionalText,
		"target-credit": optionalText,
		attributes: z.array(text).optional(),
		"attribute-ids": z.record(z.string(), z.uuid()).optional(),
		"attribute-values": z.record(z.string(), text).optional(),
		"attribute-credits": z.record(z.string(), text).optional(),
		artist: relationshipTarget.optional(),
		label: relationshipTarget.optional(),
		area: relationshipTarget.optional(),
		place: relationshipTarget.optional(),
		event: relationshipTarget.optional(),
		instrument: relationshipTarget.optional(),
		series: relationshipTarget.optional(),
		genre: relationshipTarget.optional(),
		mood: relationshipTarget.optional(),
		recording: relationshipTarget.optional(),
		release: relationshipTarget.optional(),
		"release-group": relationshipTarget.optional(),
		work: relationshipTarget.optional(),
		url: z.object({ id: z.uuid(), resource: z.url() }).passthrough().optional(),
	})
	.passthrough()
	.superRefine((value, context) => {
		const key = value["target-type"] === "release_group" ? "release-group" : value["target-type"];
		if (!value[key])
			context.addIssue({ code: "custom", message: "Missing relationship target", path: [key] });
	});
const common = {
	id: z.uuid(),
	title: text,
	disambiguation: optionalText,
	annotation: optionalText,
	aliases: z.array(MusicBrainzAliasSchema).optional(),
	relations: z.array(MusicBrainzRelationSchema).max(8192).optional(),
};
export const MusicBrainzWorkSchema = z
	.object({
		...common,
		type: optionalText,
		"type-id": optionalId,
		language: optionalText,
		languages: z.array(text).optional(),
		iswcs: z.array(text).optional(),
		attributes: z
			.array(z.object({ type: text, "type-id": optionalId, value: text }).passthrough())
			.optional(),
	})
	.passthrough();
export const MusicBrainzRecordingSchema = z
	.object({
		...common,
		length: integer.nullable().optional(),
		video: z.boolean().optional(),
		"artist-credit": MusicBrainzCreditSchema.optional(),
		isrcs: z.array(text).optional(),
	})
	.passthrough();
export const MusicBrainzReleaseGroupSchema = z
	.object({
		...common,
		"artist-credit": MusicBrainzCreditSchema.optional(),
		"primary-type": optionalText,
		"primary-type-id": optionalId,
		"secondary-types": z.array(text).optional(),
		"secondary-type-ids": z.array(z.uuid()).optional(),
		"first-release-date": date.optional(),
	})
	.passthrough();
export const MusicBrainzTrackSchema = z
	.object({
		id: z.uuid(),
		title: text,
		position: integer,
		number: text,
		length: integer.nullable().optional(),
		recording: MusicBrainzRecordingSchema,
		"artist-credit": MusicBrainzCreditSchema.optional(),
	})
	.passthrough();
export const MusicBrainzDiscSchema = z
	.object({
		id: z.string().regex(/^[A-Za-z0-9._-]{28}$/u),
		sectors: integer,
		offsets: z.array(integer).min(1).max(99),
		"offset-count": integer.min(1).max(99),
		"first-track": integer.min(1).max(99).optional(),
	})
	.passthrough()
	.superRefine((value, context) => {
		if (
			value["offset-count"] !== value.offsets.length ||
			value.offsets.some(
				(offset, i) => offset >= value.sectors || (i > 0 && offset <= (value.offsets[i - 1] ?? -1)),
			)
		)
			context.addIssue({
				code: "custom",
				message: "Disc offsets must be strictly increasing, match the count, and precede leadout",
			});
	});
export const MusicBrainzMediumSchema = z
	.object({
		// WS/2 does not promise a medium MBID; SQL's numeric medium ID is snapshot-local.
		id: z.uuid().optional(),
		position: integer,
		title: text.optional(),
		format: optionalText,
		"format-id": optionalId,
		"track-count": integer.optional(),
		tracks: z.array(MusicBrainzTrackSchema).max(8192).optional(),
		"data-tracks": z.array(MusicBrainzTrackSchema).max(8192).optional(),
		pregap: MusicBrainzTrackSchema.optional(),
		discs: z.array(MusicBrainzDiscSchema).max(4096).optional(),
	})
	.passthrough();
export const MusicBrainzReleaseSchema = z
	.object({
		...common,
		"artist-credit": MusicBrainzCreditSchema.optional(),
		"release-group": MusicBrainzReleaseGroupSchema.optional(),
		status: optionalText,
		"status-id": optionalId,
		packaging: optionalText,
		"packaging-id": optionalId,
		barcode: optionalText,
		asin: optionalText,
		quality: optionalText,
		country: optionalText,
		date: date.optional(),
		"text-representation": z
			.object({ language: optionalText, script: optionalText })
			.passthrough()
			.optional(),
		"release-events": z
			.array(
				z
					.object({ date: date.optional(), area: MusicBrainzAreaSchema.nullable().optional() })
					.passthrough(),
			)
			.max(4096)
			.optional(),
		"label-info": z
			.array(
				z
					.object({
						"catalog-number": optionalText,
						label: z
							.object({
								id: z.uuid(),
								name: text,
								"sort-name": optionalText,
								"label-code": integer.nullable().optional(),
								type: optionalText,
								"type-id": optionalId,
								disambiguation: optionalText,
							})
							.passthrough()
							.nullable()
							.optional(),
					})
					.passthrough(),
			)
			.max(4096)
			.optional(),
		media: z.array(MusicBrainzMediumSchema).max(4096),
	})
	.passthrough();
export type MusicBrainzRelease = z.infer<typeof MusicBrainzReleaseSchema>;
export type MusicBrainzCredit = z.infer<typeof MusicBrainzCreditSchema>;
export type MusicBrainzRecording = z.infer<typeof MusicBrainzRecordingSchema>;
export type MusicBrainzWork = z.infer<typeof MusicBrainzWorkSchema>;
export type MusicBrainzReleaseGroup = z.infer<typeof MusicBrainzReleaseGroupSchema>;

export function musicBrainzSourceKey(
	objectType:
		| "artist"
		| "label"
		| "area"
		| "place"
		| "event"
		| "instrument"
		| "series"
		| "genre"
		| "mood"
		| "url"
		| "recording"
		| "release_group"
		| "release"
		| "work",
	id: string,
) {
	return { source: "musicbrainz", objectType, externalId: z.uuid().parse(id) };
}
