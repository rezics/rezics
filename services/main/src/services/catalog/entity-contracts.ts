import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { z } from "zod";
import { CatalogPartialDateSchema } from "./contracts";

const text = (maximum: number) =>
	z.string().refine((value) => Buffer.byteLength(value, "utf8") <= maximum);
export const NativeCatalogNameSchema = z.strictObject({
	languageTag: z.string().transform(canonicalizeContentLanguageTag).nullable(),
	value: text(131_072).refine((value) => value.length > 0),
});
export const EntityShapeSchema = z.enum([
	"person",
	"organization",
	"character",
	"label",
	"collective",
	"unresolved",
]);
const date = CatalogPartialDateSchema.safeExtend({ text: text(4096).nullable().default(null) })
	.nullable()
	.default(null);
const definition = z.uuid().nullable().default(null);

/**
 * Existence lifecycle, not a fictional biography or a credit's period of participation.
 * @alpha
 * @remarks Shared manual and source adoption contract; catalog identity grants no account authority.
 */
export const EntityProfileSchema = z.strictObject({
	typeRevisionId: definition,
	genderRevisionId: definition,
	areaId: definition,
	beginAreaId: definition,
	endAreaId: definition,
	begin: date,
	end: date,
	ended: z.boolean().nullable().default(null),
});
export type EntityProfileInput = z.input<typeof EntityProfileSchema>;
export type EntityProfile = z.output<typeof EntityProfileSchema>;
export const CreateEntitySchema = z.strictObject({
	shape: EntityShapeSchema,
	name: NativeCatalogNameSchema,
	profile: EntityProfileSchema.default(() => EntityProfileSchema.parse({})),
});

const common = { typeRevisionId: definition };
const lifecycle = { begin: date, end: date, ended: z.boolean().nullable().default(null) };
/**
 * Concrete geography, instrument and event semantics independent of provider object keys.
 * @alpha
 * @remarks Partial dates retain unknown precision; coordinates must be supplied as a pair.
 */
export const ReferenceProfileSchema = z.discriminatedUnion("shape", [
	z.strictObject({ shape: z.literal("area"), ...common, ...lifecycle }),
	z.strictObject({ shape: z.literal("instrument"), ...common }),
	z
		.strictObject({
			shape: z.literal("place"),
			...common,
			...lifecycle,
			areaId: definition,
			address: text(16_384).nullable().default(null),
			latitude: z.number().finite().min(-90).max(90).nullable().default(null),
			longitude: z.number().finite().min(-180).max(180).nullable().default(null),
		})
		.refine((value) => (value.latitude === null) === (value.longitude === null), {
			message: "Coordinates require latitude and longitude",
		}),
	z.strictObject({
		shape: z.literal("event"),
		...common,
		placeId: definition,
		begin: date,
		end: date,
		localTime: z
			.string()
			.regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,6})?)?$/u)
			.nullable()
			.default(null),
		cancelled: z.boolean().nullable().default(null),
		ended: z.boolean().nullable().default(null),
		setlist: text(65_536).nullable().default(null),
	}),
]);
export type ReferenceProfileInput = z.input<typeof ReferenceProfileSchema>;
export type ReferenceProfile = z.output<typeof ReferenceProfileSchema>;

export const AreaCodeSchema = z.strictObject({
	namespace: text(64).refine((value) => value.length > 0),
	code: text(128).refine((value) => value.length > 0),
});
