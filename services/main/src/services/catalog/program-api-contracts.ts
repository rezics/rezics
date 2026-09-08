import { z } from "zod";
import { ProgramStructureSchema } from "./program";
import { isFractionalPosition } from "../ordering/position";
import { DomainPageQuerySchema } from "./domain-api-pagination";
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const ProgramComponentSchema = z.enum([
	"program_work",
	"program_season",
	"program_version",
	"program_episode",
	"program_episode_occurrence",
]);
export const ProgramDetailsSchema = z.strictObject({
	id: z.uuid(),
	revision,
	historyId: z.uuid(),
	componentSequence: revision,
	structure: ProgramStructureSchema,
});
export const ProgramEditSchema = z.strictObject({
	expectedRevision: revision,
	expectedHistoryId: z.uuid(),
	structure: ProgramStructureSchema,
});
export const ProgramMutationSchema = z.strictObject({
	revision,
	historyId: z.uuid(),
	componentSequence: revision,
});
export const ProgramOccurrenceValueSchema = z.strictObject({
	episodeId: z.uuid(),
	position: z.string().max(512).refine(isFractionalPosition),
	sourceNumber: z.string().max(4096).nullable(),
});
export const ProgramOccurrenceSchema = z.strictObject({
	id: z.uuid(),
	historyId: z.uuid(),
	componentSequence: revision,
	value: ProgramOccurrenceValueSchema,
});
export const ProgramOccurrencePutSchema = z.strictObject({
	expectedRevision: revision,
	expectedHistoryId: z.uuid().nullable(),
	value: ProgramOccurrenceValueSchema,
});
export const ProgramOccurrenceRemoveSchema = z.strictObject({
	expectedRevision: revision,
	expectedHistoryId: z.uuid(),
});
export const ProgramRestoreSchema = ProgramOccurrenceRemoveSchema.extend({ historyId: z.uuid() });
export const ProgramHistoryValueSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("structure"), value: ProgramStructureSchema }),
	z.strictObject({ kind: z.literal("occurrence"), value: ProgramOccurrenceValueSchema }),
]);
export const ProgramHistorySchema = z.strictObject({
	id: z.uuid(),
	component: ProgramComponentSchema,
	componentKey: z.uuid(),
	componentSequence: revision,
	operation: z.enum(["INSERT", "UPDATE", "DELETE"]),
	recordedAt: z.iso.datetime(),
	snapshot: ProgramHistoryValueSchema,
});
export const ProgramPageQuerySchema = DomainPageQuerySchema;
export const programPage = <T extends z.ZodType>(item: T) =>
	z.strictObject({ items: z.array(item).max(100), nextCursor: z.string().nullable() });
