import { z } from "zod";
import { CatalogReferenceSchema } from "./contracts";

export const EntityMeasurementContextOwnerValues = ["publishing", "music", "program", "software"] as const;
export const EntityMeasurementContextSchema = CatalogReferenceSchema.extend({ owner: z.enum(EntityMeasurementContextOwnerValues) });
const scalar = z.number().int().nonnegative().safe().nullable();
const spoiler = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const EntityMeasurementValuesSchema = z.strictObject({
	heightMillimetres: scalar, weightGrams: scalar, bustMillimetres: scalar,
	waistMillimetres: scalar, hipsMillimetres: scalar,
});
export const EntityMeasurementContextQuerySchema = z.strictObject({
	contextOwner: z.enum(EntityMeasurementContextOwnerValues), contextId: z.uuid(),
	maxSpoiler: z.coerce.number().int().min(0).max(2).pipe(spoiler).default(0),
});
export const EntityMeasurementContextWriteSchema = z.strictObject({
	expectedRevision: z.number().int().positive().safe(),
	expectedHeadVersion: z.number().int().nonnegative().safe(),
	context: EntityMeasurementContextSchema,
	spoiler: spoiler.default(0),
	values: EntityMeasurementValuesSchema,
});
export const EntityContextMeasurementSchema = z.strictObject({
	relationId: z.uuid(), semanticId: z.uuid(), headVersion: z.number().int().positive().safe(),
	context: EntityMeasurementContextSchema, spoiler: z.number().int().min(0).max(2),
	values: EntityMeasurementValuesSchema,
});
export const EntityMeasurementContextResponseSchema = z.strictObject({
	revision: z.number().int().positive().safe(), canEdit: z.boolean(),
	headVersion: z.number().int().nonnegative().safe(),
	measurement: EntityContextMeasurementSchema.nullable(),
});
export const EntityMeasurementContextMutationSchema = z.strictObject({
	id: z.uuid(), revision: z.number().int().positive().safe(), semanticId: z.uuid(),
	headVersion: z.number().int().positive().safe(),
});
export type EntityMeasurementValues = z.output<typeof EntityMeasurementValuesSchema>;
export type EntityMeasurementContext = z.output<typeof EntityMeasurementContextSchema>;
export type EntityContextMeasurement = z.output<typeof EntityContextMeasurementSchema>;
