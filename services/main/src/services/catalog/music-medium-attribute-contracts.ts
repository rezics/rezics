import { z } from "zod";

/** @alpha @remarks Reviewed configuration is bounded; carrier assertion cardinality is not capped. */
export const MusicMediumAttributePolicyInputSchema = z
	.strictObject({
		definitionRevisionId: z.uuid(),
		valueMode: z.enum(["text", "vocabulary"]),
		formatRevisionIds: z.array(z.uuid()).min(1).max(512),
		valueFormats: z
			.array(z.strictObject({ valueRevisionId: z.uuid(), formatRevisionId: z.uuid() }))
			.max(512)
			.default([]),
	})
	.superRefine((value, context) => {
		if (new Set(value.formatRevisionIds).size !== value.formatRevisionIds.length)
			context.addIssue({ code: "custom", message: "Duplicate allowed format" });
		if ((value.valueMode === "vocabulary") !== value.valueFormats.length > 0)
			context.addIssue({
				code: "custom",
				message: "Only vocabulary policies require value-format membership",
			});
		const pairs = value.valueFormats.map(
			(pair) => `${pair.valueRevisionId}/${pair.formatRevisionId}`,
		);
		if (new Set(pairs).size !== pairs.length)
			context.addIssue({ code: "custom", message: "Duplicate allowed value-format pair" });
		if (value.valueFormats.some((pair) => !value.formatRevisionIds.includes(pair.formatRevisionId)))
			context.addIssue({
				code: "custom",
				message: "Value format is outside the attribute formats",
			});
	});

/** @alpha @remarks An assertion carries exactly one typed value, independently of an upstream source. */
export const MusicMediumAttributeInputSchema = z.discriminatedUnion("valueMode", [
	z.strictObject({
		definitionRevisionId: z.uuid(),
		valueMode: z.literal("text"),
		textValue: z.string().min(1).max(4096),
	}),
	z.strictObject({
		definitionRevisionId: z.uuid(),
		valueMode: z.literal("vocabulary"),
		valueRevisionId: z.uuid(),
	}),
]);
