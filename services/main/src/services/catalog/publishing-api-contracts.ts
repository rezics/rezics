import { z } from "zod";
import { PublishingStructureSchema } from "./publishing";
import { PublishingComponentValuesSchema } from "./publishing-components";
import { DomainPageQuerySchema } from "./domain-api-pagination";
import { CatalogNameLabelSchema } from "./child-name-labels";
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const structures = PublishingStructureSchema.options;
export const PublishingWireStructureSchema = z.discriminatedUnion("shape", [
	structures[0],
	structures[1].extend({
		fields: structures[1].shape.fields.extend({
			languageTag: z.string().max(255).nullable().default(null),
		}),
	}),
	structures[2],
	structures[3],
]);
export const PublishingChildKindSchema = z.enum([
	"text_work",
	"publication_text",
	"publication_work",
	"facet",
	"event",
	"installment",
]);
export const PublishingHistoryComponentSchema = z.enum([
	"publishing_work",
	"publishing_text_version",
	"publishing_publication",
	"publishing_serialization",
	"publishing_text_work",
	"publishing_publication_text",
	"publishing_publication_work",
	"publishing_publication_facet",
	"publishing_release_event",
	"publishing_installment",
]);
export const PublishingDetailsSchema = z.strictObject({
	id: z.uuid(),
	canEdit: z.boolean(),
	revision,
	historyId: z.uuid(),
	componentSequence: revision,
	structure: PublishingWireStructureSchema,
});
export const PublishingMutationSchema = z.strictObject({
	revision,
	historyId: z.uuid(),
	componentSequence: revision,
});
export const PublishingEditSchema = z.strictObject({
	expectedRevision: revision,
	expectedHistoryId: z.uuid(),
	structure: PublishingWireStructureSchema,
});
export const PublishingChildSchema = z.strictObject({
	id: z.uuid(),
	historyId: z.uuid(),
	componentSequence: revision,
	value: PublishingComponentValuesSchema,
	name: CatalogNameLabelSchema.nullable(),
});
export const PublishingChildPutSchema = z.strictObject({
	expectedRevision: revision,
	expectedHistoryId: z.uuid().nullable(),
	value: PublishingComponentValuesSchema,
});
export const PublishingChildRemoveSchema = z.strictObject({
	expectedRevision: revision,
	expectedHistoryId: z.uuid(),
});
export const PublishingRestoreSchema = PublishingChildRemoveSchema.extend({ historyId: z.uuid() });
export const PublishingHistoryValueSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("structure"), value: PublishingWireStructureSchema }),
	z.strictObject({ kind: z.literal("child"), value: PublishingComponentValuesSchema }),
]);
export const PublishingHistorySchema = z.strictObject({
	id: z.uuid(),
	component: PublishingHistoryComponentSchema,
	componentKey: z.uuid(),
	componentSequence: revision,
	operation: z.enum(["INSERT", "UPDATE", "DELETE"]),
	recordedAt: z.iso.datetime(),
	snapshot: PublishingHistoryValueSchema,
});
export const PublishingPageQuerySchema = DomainPageQuerySchema;
export const PublishingChildrenQuerySchema = DomainPageQuerySchema.extend({
	parentId: z.uuid().optional(),
});
export const PublishingConnectionKindSchema = z.enum([
	"text_work",
	"publication_text",
	"publication_work",
	"serialization_text",
]);
export const PublishingConnectionsQuerySchema = DomainPageQuerySchema.extend({
	kind: PublishingConnectionKindSchema,
	direction: z.enum(["outgoing", "incoming"]),
});
export const PublishingConnectionSchema = z.strictObject({
	id: z.uuid(),
	name: CatalogNameLabelSchema.nullable(),
	position: z.number().int().nonnegative().nullable(),
	coverageText: z.string().nullable(),
});
export const publishingPage = <T extends z.ZodType>(item: T) =>
	z.strictObject({ items: z.array(item).max(100), nextCursor: z.string().nullable() });
