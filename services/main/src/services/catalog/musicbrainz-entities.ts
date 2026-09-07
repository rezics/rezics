import { createHash } from "node:crypto";
import { z } from "zod";
import {
	MusicBrainzAliasSchema,
	MusicBrainzAreaSchema,
	MusicBrainzArtistSchema,
	MusicBrainzCatalogContractSha256,
	MusicBrainzRelationSchema,
	musicBrainzDate,
} from "./musicbrainz";
import type { CatalogSourceReceipt } from "./source-observations";

const text = z.string().max(131_072);
const optionalText = text.nullable().optional();
const optionalId = z.uuid().nullable().optional();
const date = text.refine((value) => {
	try {
		musicBrainzDate(value);
		return true;
	} catch {
		return false;
	}
}, "Invalid MusicBrainz partial date");
const lifeSpan = z
	.object({
		begin: date.nullable().optional(),
		end: date.nullable().optional(),
		ended: z.boolean().nullable().optional(),
	})
	.passthrough();
const common = {
	id: z.uuid(),
	name: text.min(1),
	"sort-name": optionalText,
	type: optionalText,
	"type-id": optionalId,
	disambiguation: optionalText,
	annotation: optionalText,
	aliases: z.array(MusicBrainzAliasSchema).max(8192).optional(),
	relations: z.array(MusicBrainzRelationSchema).max(8192).optional(),
};
const identifiers = {
	ipis: z.array(text).max(8192).optional(),
	isnis: z.array(text).max(8192).optional(),
};

/**
 * Full supporting endpoints extend, rather than reinterpret, inline source references.
 * @alpha
 * @remarks Unknown properties remain archived; only these checked properties enter native commands.
 */
export const MusicBrainzArtistEndpointSchema = MusicBrainzArtistSchema.extend({
	...common,
	...identifiers,
	gender: optionalText,
	"gender-id": optionalId,
	country: optionalText,
	area: MusicBrainzAreaSchema.nullable().optional(),
	"begin-area": MusicBrainzAreaSchema.nullable().optional(),
	"end-area": MusicBrainzAreaSchema.nullable().optional(),
	"life-span": lifeSpan.optional(),
});
export const MusicBrainzLabelEndpointSchema = z
	.object({
		...common,
		...identifiers,
		country: optionalText,
		"label-code": z.number().int().min(0).max(99999).nullable().optional(),
		area: MusicBrainzAreaSchema.nullable().optional(),
		"life-span": lifeSpan.optional(),
	})
	.passthrough();
export const MusicBrainzAreaEndpointSchema = MusicBrainzAreaSchema.extend({
	...common,
	"life-span": lifeSpan.optional(),
});
const coordinate = z
	.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/u)])
	.transform(Number)
	.pipe(z.number().finite());
export const MusicBrainzPlaceEndpointSchema = z
	.object({
		...common,
		address: z.string().max(16384).nullable().optional(),
		area: MusicBrainzAreaSchema.nullable().optional(),
		"life-span": lifeSpan.optional(),
		coordinates: z
			.object({
				latitude: coordinate.pipe(z.number().min(-90).max(90)),
				longitude: coordinate.pipe(z.number().min(-180).max(180)),
			})
			.nullable()
			.optional(),
	})
	.passthrough();
export const MusicBrainzEventEndpointSchema = z
	.object({
		...common,
		"life-span": lifeSpan.optional(),
		cancelled: z.boolean().nullable().optional(),
		time: z
			.string()
			.regex(/^(?:|(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?)$/u)
			.nullable()
			.optional(),
		setlist: z.string().max(65536).nullable().optional(),
	})
	.passthrough();
export const MusicBrainzInstrumentEndpointSchema = z
	.object({
		...common,
		description: optionalText,
	})
	.passthrough();
export const MusicBrainzSeriesEndpointSchema = z
	.object({
		...common,
		"ordering-type": optionalText,
		"ordering-type-id": optionalId,
	})
	.passthrough();
export const MusicBrainzGenreEndpointSchema = z
	.object({ ...common, description: optionalText })
	.passthrough();
export const MusicBrainzMoodEndpointSchema = z
	.object({ ...common, description: optionalText })
	.passthrough();
export const MusicBrainzUrlEndpointSchema = z
	.object({
		id: z.uuid(),
		resource: z.url().max(131072),
		relations: z.array(MusicBrainzRelationSchema).max(8192).optional(),
	})
	.passthrough();

/** @alpha @remarks Identity shape requires a documented positive source classification. */
export function musicBrainzArtistShape(type: string | null | undefined) {
	switch (type) {
		case "Person":
			return "person";
		case "Character":
			return "character";
		case "Group":
		case "Orchestra":
		case "Choir":
			return "collective";
		default:
			return "unresolved";
	}
}
/** @alpha @remarks MusicBrainz labels primarily denote imprints, not legal organizations. */
export function musicBrainzLabelShape(type: string | null | undefined) {
	return [
		"Distributor",
		"Holding",
		"Rights Society",
		"Publisher",
		"Manufacturer",
		"Broadcaster",
	].includes(type ?? "")
		? "organization"
		: "label";
}

/** @alpha @remarks Preserves date text and precision, including explicit ended=false without an end date. */
export function musicBrainzLifecycle(value: z.infer<typeof lifeSpan> | undefined) {
	const partial = (value: string | null | undefined) =>
		value ? { ...musicBrainzDate(value), text: value } : null;
	return { begin: partial(value?.begin), end: partial(value?.end), ended: value?.ended ?? null };
}

/** @alpha @remarks Parse dispatch preserves a closed endpoint discriminant for exhaustive native adoption. */
export function parseMusicBrainzSupportingEndpoint(type: string, input: unknown) {
	switch (type) {
		case "artist":
			return { type, record: MusicBrainzArtistEndpointSchema.parse(input) } as const;
		case "label":
			return { type, record: MusicBrainzLabelEndpointSchema.parse(input) } as const;
		case "area":
			return { type, record: MusicBrainzAreaEndpointSchema.parse(input) } as const;
		case "place":
			return { type, record: MusicBrainzPlaceEndpointSchema.parse(input) } as const;
		case "event":
			return { type, record: MusicBrainzEventEndpointSchema.parse(input) } as const;
		case "instrument":
			return { type, record: MusicBrainzInstrumentEndpointSchema.parse(input) } as const;
		case "series":
			return { type, record: MusicBrainzSeriesEndpointSchema.parse(input) } as const;
		case "genre":
			return { type, record: MusicBrainzGenreEndpointSchema.parse(input) } as const;
		case "mood":
			return { type, record: MusicBrainzMoodEndpointSchema.parse(input) } as const;
		case "url":
			return { type, record: MusicBrainzUrlEndpointSchema.parse(input) } as const;
		default:
			throw new TypeError("Unsupported MusicBrainz supporting endpoint");
	}
}

/** @alpha @remarks Checks byte, contract and endpoint identity before any native or archive mutation. */
export function parseMusicBrainzSupportingDocument(
	receipt: Pick<CatalogSourceReceipt, "key" | "contentSha256" | "contractSha256">,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("MusicBrainz projection bytes differ from the archived observation");
	if (receipt.contractSha256 !== MusicBrainzCatalogContractSha256)
		throw new Error("MusicBrainz source contract has not been reviewed for this mapper");
	const parsed = parseMusicBrainzSupportingEndpoint(
		receipt.key.objectType,
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (receipt.key.source !== "musicbrainz" || receipt.key.externalId !== parsed.record.id)
		throw new TypeError("MusicBrainz supporting endpoint differs from its source key");
	return parsed;
}
