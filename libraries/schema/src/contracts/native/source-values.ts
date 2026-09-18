import { z } from "zod";
import { CatalogPartialDateSchema } from "./catalog";
import { isFractionalPosition } from "./positions";
import { ProgramStructureSchema, PublishingStructureSchema } from "./structures";
const id = z.uuid().nullable(),
	text = z.string().max(131072).nullable(),
	position = z.number().int().nonnegative().safe().nullable(),
	date = CatalogPartialDateSchema;
const coverage = z.strictObject({ targetId: id, position, coverageText: text });
export const ChildSourceValueSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("text_work"), fields: coverage }),
	z.strictObject({ kind: z.literal("publication_text"), fields: coverage }),
	z.strictObject({ kind: z.literal("publication_work"), fields: coverage }),
	z.strictObject({
		kind: z.literal("facet"),
		fields: z.strictObject({ definitionRevisionId: id }),
	}),
	z.strictObject({
		kind: z.literal("event"),
		fields: z.strictObject({
			publisherEntityId: id,
			publisherCredit: text,
			areaId: id,
			date,
			dateText: z.string().max(4096).nullable(),
		}),
	}),
	z.strictObject({
		kind: z.literal("installment"),
		fields: z.strictObject({
			parentId: id,
			position: z.string().max(512).refine(isFractionalPosition).nullable(),
			label: text,
			kindRevisionId: id,
			date,
			dateText: z.string().max(4096).nullable(),
		}),
	}),
	z.strictObject({
		kind: z.literal("episode_occurrence"),
		fields: z.strictObject({
			episodeId: id,
			position: z.string().max(512).refine(isFractionalPosition).nullable(),
			sourceNumber: z.string().max(4096).nullable(),
		}),
	}),
]);
export type ChildSourceValue = z.output<typeof ChildSourceValueSchema>;
export const ChildSourceComponentSchema = z.enum([
	"program_episode_occurrence",
	"publishing_text_work",
	"publishing_publication_text",
	"publishing_publication_work",
	"publishing_publication_facet",
	"publishing_release_event",
	"publishing_installment",
]);
export type ChildSourceComponent = z.output<typeof ChildSourceComponentSchema>;

export const StructureSourceComponentSchema = z.enum([
	"program_work",
	"program_season",
	"program_version",
	"program_episode",
	"publishing_work",
	"publishing_text_version",
	"publishing_publication",
	"publishing_serialization",
]);
export type StructureSourceComponent = z.output<typeof StructureSourceComponentSchema>;
export type StructureSourceValue =
	| z.output<typeof ProgramStructureSchema>
	| z.output<typeof PublishingStructureSchema>;
