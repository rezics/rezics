import { z } from "zod";
import {
	SoftwareContentDetailsSchema,
	SoftwareVersionDetailsSchema,
	SoftwareReleaseDetailsSchema,
} from "./software";
import { SoftwareComponentValuesSchema } from "./software-components";
import { SoftwareParticipationValuesSchema } from "./software-participation";
import { SoftwareParticipationContextValuesSchema } from "./software-contexts";
import { DomainPageQuerySchema } from "./domain-api-pagination";
export const NativeRevisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const SoftwareDetailValueSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("content"), value: SoftwareContentDetailsSchema }),
	z.strictObject({ kind: z.literal("version"), value: SoftwareVersionDetailsSchema }),
	z.strictObject({ kind: z.literal("release"), value: SoftwareReleaseDetailsSchema }),
]);
export const SoftwareDetailSchema = z.strictObject({
	id: z.uuid(),
	revision: NativeRevisionSchema,
	contentId: z.uuid().nullable(),
	details: SoftwareDetailValueSchema,
});
export const SoftwareDetailEditSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	details: SoftwareDetailValueSchema,
});
export const SoftwareComponentKindSchema = z.enum([
	"content",
	"platform",
	"medium",
	"language",
	"event",
	"patch_target",
	"animation",
]);
export const SoftwareComponentKeySchema = z.string().min(1).max(96);
export const SoftwareComponentSchema = z.strictObject({
	id: SoftwareComponentKeySchema,
	revision: NativeRevisionSchema,
	value: SoftwareComponentValuesSchema,
});
export const SoftwareComponentPutSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	expectedComponentRevision: NativeRevisionSchema.nullable(),
	value: SoftwareComponentValuesSchema,
});
export const SoftwareComponentRemoveSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	expectedComponentRevision: NativeRevisionSchema,
});
export const SoftwareComponentRestoreSchema = SoftwareComponentRemoveSchema.extend({
	historicalRevision: NativeRevisionSchema,
});
export const SoftwareMutationSchema = z.strictObject({ revision: NativeRevisionSchema });
export const SoftwareComponentMutationSchema = SoftwareMutationSchema.extend({
	componentRevision: NativeRevisionSchema,
});
export const SoftwareDetailRestoreSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	historicalRevision: NativeRevisionSchema,
});
export const SoftwareDetailHistorySchema = z.strictObject({
	revision: NativeRevisionSchema,
	recordedAt: z.iso.datetime(),
	details: SoftwareDetailValueSchema,
});
export const SoftwareComponentHistorySchema = z.strictObject({
	id: SoftwareComponentKeySchema,
	revision: NativeRevisionSchema,
	operation: z.enum(["put", "remove"]),
	value: SoftwareComponentValuesSchema,
});
export const SoftwareContextSchema = z.strictObject({
	id: z.uuid(),
	revision: NativeRevisionSchema,
	value: SoftwareParticipationContextValuesSchema,
});
export const SoftwareContextCreateSchema = z.strictObject({
	value: SoftwareParticipationContextValuesSchema,
});
export const SoftwareContextEditSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	value: SoftwareParticipationContextValuesSchema,
});
export const SoftwareChildRestoreSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	historicalRevision: NativeRevisionSchema,
});
export const SoftwareCreditSchema = z.strictObject({
	id: z.uuid(),
	revision: NativeRevisionSchema,
	value: SoftwareParticipationValuesSchema,
});
export const SoftwareCreditCreateSchema = z.strictObject({
	value: SoftwareParticipationValuesSchema,
});
export const SoftwareCreditEditSchema = z.strictObject({
	expectedRevision: NativeRevisionSchema,
	value: SoftwareParticipationValuesSchema,
});
export const SoftwareChildHistorySchema = z.strictObject({
	id: z.uuid(),
	revision: NativeRevisionSchema,
	recordedAt: z.iso.datetime(),
	value: z.union([SoftwareParticipationContextValuesSchema, SoftwareParticipationValuesSchema]),
});
export const softwarePage = <T extends z.ZodType>(item: T) =>
	z.strictObject({ items: z.array(item).max(100), nextCursor: z.string().nullable() });
export const SoftwarePageQuerySchema = DomainPageQuerySchema;
export const SoftwareChildrenQuerySchema = DomainPageQuerySchema.extend({
	includeWithdrawn: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
});
export const SoftwareReleaseSearchSchema = DomainPageQuerySchema.extend({
	languageTag: z.string().max(255).optional(),
	machineTranslated: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
	platformRevisionId: z.uuid().optional(),
	mediumTypeRevisionId: z.uuid().optional(),
	isPatch: z
		.enum(["true", "false"])
		.transform((value) => value === "true")
		.optional(),
});
export const SoftwareReleaseSummarySchema = z.strictObject({
	id: z.uuid(),
	isPatch: z.boolean().nullable(),
	engine: z.string().nullable(),
	dateYear: z.number().nullable(),
	dateMonth: z.number().nullable(),
	dateDay: z.number().nullable(),
});
