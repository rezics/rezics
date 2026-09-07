import { z } from "zod";
import { SoftwareContentDetailsSchema, SoftwareReleaseDetailsSchema } from "./software";

/** Immutable, typed mapper output before independent native fields are merged. The root epoch versions its interpretation. */
export const SoftwareSourceValueSchema = z
	.discriminatedUnion("sourceShape", [
		z.strictObject({
			sourceShape: z.literal("content"),
			sourceValue: SoftwareContentDetailsSchema,
		}),
		z.strictObject({
			sourceShape: z.literal("release"),
			sourceValue: SoftwareReleaseDetailsSchema,
		}),
	])
	.refine(
		(value) => Buffer.byteLength(JSON.stringify(value.sourceValue), "utf8") <= 2_097_152,
		"Software source interpretation exceeds its byte budget",
	);
export type SoftwareSourceValueInput = z.input<typeof SoftwareSourceValueSchema>;
