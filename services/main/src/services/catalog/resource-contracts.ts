import { createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";
import {
	CatalogReferenceSchema,
	CatalogPartialDateSchema,
	CatalogFactStateValues,
} from "./contracts";
import {
	CreateEntitySchema,
	ReferenceProfileSchema,
	NativeCatalogNameSchema,
} from "./entity-contracts";
import { ProgramStructureSchema } from "./program";
import {
	SoftwareContentDetailsSchema,
	SoftwareReleaseDetailsSchema,
	SoftwareVersionDetailsSchema,
} from "./software";
import {
	CatalogNameInputSchema,
	CatalogIdentifierValuesSchema,
	CatalogRevisionNumberSchema,
	CatalogNameOriginValues,
	CatalogTranslationMethodValues,
} from "./name-contracts";
import { CatalogNameTables } from "../database/schema/catalog-names";
import {
	ContentRatingValues,
	ModerationStatusValues,
	ResourceVisibilityValues,
	UnitStatusValues,
} from "../database/schema/contract-values";

const name = NativeCatalogNameSchema;
const nullableId = z.uuid().nullable().optional();
const count = z.number().int().nonnegative().safe();
/** @alpha Source-free creation selects a real native structure and never requires an invented parent. */
export const CreateCatalogResourceSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("publishing_work"), name }),
	z.strictObject({ kind: z.literal("text_version"), name, languageTag: z.string().nullable() }),
	z.strictObject({
		kind: z.literal("publication"),
		name,
		pageCount: count.nullable().optional(),
		paginationText: z.string().max(131072).nullable().optional(),
	}),
	z.strictObject({
		kind: z.literal("serialization"),
		name,
		textVersionId: nullableId,
		statusRevisionId: nullableId,
	}),
	z.strictObject({ kind: z.literal("musical_work"), name }),
	z.strictObject({
		kind: z.literal("recording"),
		name,
		artistCreditId: nullableId,
		lengthMilliseconds: count.nullable().optional(),
		video: z.boolean().nullable().optional(),
	}),
	z.strictObject({ kind: z.literal("release_group"), name }),
	z.strictObject({
		kind: z.literal("music_release"),
		name,
		releaseGroup: CatalogReferenceSchema.optional(),
		artistCreditId: nullableId,
		languageTag: z.string().nullable().optional(),
		scriptCode: z
			.string()
			.regex(/^[A-Z][a-z]{3}$/u)
			.nullable()
			.optional(),
	}),
	z.strictObject({
		kind: z.literal("software_content"),
		name,
		visualNovel: z.boolean().optional(),
		details: SoftwareContentDetailsSchema.optional(),
	}),
	z.strictObject({
		kind: z.literal("software_version"),
		name,
		content: CatalogReferenceSchema,
		details: SoftwareVersionDetailsSchema,
	}),
	z.strictObject({
		kind: z.literal("software_release"),
		name,
		details: SoftwareReleaseDetailsSchema.optional(),
	}),
	z.strictObject({ kind: z.literal("program"), name, structure: ProgramStructureSchema }),
	CreateEntitySchema.extend({ kind: z.literal("entity") }),
	z.strictObject({ kind: z.literal("reference"), name, profile: ReferenceProfileSchema }),
	z.strictObject({
		kind: z.literal("grouping"),
		name,
		classes: z.array(z.uuid()).max(128).optional(),
	}),
	z.strictObject({ kind: z.literal("distribution"), name }),
]);

/** @alpha Public resource metadata excludes account provenance and internal routing state. */
export const CatalogResourceSchema = z.strictObject({
	reference: CatalogReferenceSchema,
	shape: z.string(),
	revision: CatalogRevisionNumberSchema,
	status: z.enum(UnitStatusValues),
	visibility: z.enum(ResourceVisibilityValues),
	contentRating: z.enum(ContentRatingValues),
	moderationStatus: z.enum(ModerationStatusValues),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export const CatalogCreatedSchema = z.strictObject({
	reference: CatalogReferenceSchema,
	revision: CatalogRevisionNumberSchema,
});
export const CatalogLifecycleInputSchema = z.strictObject({
	expectedRevision: CatalogRevisionNumberSchema,
	status: z.enum(UnitStatusValues),
	visibility: z.enum(ResourceVisibilityValues),
	contentRating: z.enum(ContentRatingValues),
});
export const CatalogMutationSchema = z.strictObject({ revision: CatalogRevisionNumberSchema });
export const CatalogNameCreatedSchema = CatalogMutationSchema.extend({
	id: z.uuid(),
	nameRevision: CatalogRevisionNumberSchema,
});
export const CatalogIdentifierCreatedSchema = CatalogMutationSchema.extend({
	id: z.uuid(),
	identifierRevision: CatalogRevisionNumberSchema,
});

/** @alpha Complete named forms retain exact identity/revision while private audit attribution stays internal. */
export const CatalogNamedFormSchema = createSelectSchema(CatalogNameTables.publishing.name, {
	revision: CatalogRevisionNumberSchema,
	createdAt: z.iso.datetime(),
	recordedAt: z.iso.datetime(),
	origin: z.enum(CatalogNameOriginValues),
	translationMethod: z.enum(CatalogTranslationMethodValues),
	state: z.enum(CatalogFactStateValues),
	begin: CatalogPartialDateSchema.nullable(),
	end: CatalogPartialDateSchema.nullable(),
})
	.omit({ recordedByAuthUserId: true, languagePolicy: true })
	.strict();
export const CatalogIdentifierSchema = createSelectSchema(CatalogNameTables.publishing.identifier, {
	revision: CatalogRevisionNumberSchema,
	createdAt: z.iso.datetime(),
	recordedAt: z.iso.datetime(),
	state: z.enum(CatalogFactStateValues),
	validationStatus: z.enum(["valid", "unvalidated"]),
})
	.omit({ recordedByAuthUserId: true })
	.strict();
export const CatalogNamePageSchema = z.strictObject({
	items: z.array(CatalogNamedFormSchema).max(100),
	nextCursor: z.uuid().nullable(),
});
export const CatalogIdentifierPageSchema = z.strictObject({
	items: z.array(CatalogIdentifierSchema).max(100),
	nextCursor: z.uuid().nullable(),
});
export const CatalogNameHistoryPageSchema = z.strictObject({
	items: z.array(CatalogNamedFormSchema).max(100),
	nextCursor: CatalogRevisionNumberSchema.nullable(),
});
export const CatalogIdentifierHistoryPageSchema = z.strictObject({
	items: z.array(CatalogIdentifierSchema).max(100),
	nextCursor: CatalogRevisionNumberSchema.nullable(),
});
export const AddCatalogNameSchema = z.strictObject({
	expectedRevision: CatalogRevisionNumberSchema,
	value: CatalogNameInputSchema,
});
export const EditCatalogNameSchema = z.strictObject({
	expectedRevision: CatalogRevisionNumberSchema,
	value: CatalogNameInputSchema,
});
export const AddCatalogIdentifierSchema = z.strictObject({
	expectedRevision: CatalogRevisionNumberSchema,
	value: CatalogIdentifierValuesSchema,
});
export const EditCatalogIdentifierSchema = z.strictObject({
	expectedRevision: CatalogRevisionNumberSchema,
	value: CatalogIdentifierValuesSchema,
});
export const CatalogCursorQuerySchema = z.strictObject({
	afterId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const CatalogHistoryQuerySchema = z.strictObject({
	afterRevision: z.coerce.number().int().min(0).safe().default(0),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
