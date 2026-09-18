import { z } from "zod";
/** @alpha Source-neutral schema declarations; unknown facets remain explicit rather than fabricated. */
export const ConvertedFieldSchema = z.strictObject({
	id: z.uuid(),
	path: z.string(),
	shape: z.string(),
	required: z.enum(["yes", "no", "unspecified"]),
	cardinality: z.enum(["one", "many", "unspecified"]),
	nullability: z.enum(["nullable", "non-null", "unspecified"]),
	references: z.array(
		z.strictObject({ kind: z.string(), value: z.string(), target: z.string().nullable() }),
	),
	keywords: z.array(z.strictObject({ key: z.string(), value: z.unknown() })),
});
export const ConvertedContractSchema = z.strictObject({
	id: z.uuid(),
	source: z.string(),
	name: z.string(),
	version: z.string(),
	origin: z.string(),
	dialect: z.string(),
	digest: z.string(),
	fields: z.array(ConvertedFieldSchema),
});
export type ConvertedField = z.infer<typeof ConvertedFieldSchema>;
export type ConvertedContract = z.infer<typeof ConvertedContractSchema>;
