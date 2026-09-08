import { z } from "zod";
import { CatalogFactStateValues, CatalogReferenceSchema } from "./contracts";
import { CatalogRevisionNumberSchema } from "./name-contracts";
import { CatalogValueNodeSchema } from "./value-nodes";

const revision = CatalogRevisionNumberSchema;
const spoiler = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const replacement = z.strictObject({ semanticId: z.uuid(), headVersion: revision });
const relationQualifier = z.union([
	z.strictObject({ definitionRevisionId: z.uuid(), valueFactId: z.uuid() }),
	z.strictObject({ definitionRevisionId: z.uuid(), nodes: z.array(CatalogValueNodeSchema).min(1).max(512) }),
]);
/** @alpha Bounded immutable semantic edits; replacements require both owner and semantic revisions. */
export const WriteCatalogFactSchema = z.strictObject({
	expectedRevision: revision,
	definitionRevisionId: z.uuid(),
	spoiler: spoiler.default(0),
	replaces: replacement.optional(),
	nodes: z.array(CatalogValueNodeSchema).min(1).max(512),
}).refine((value) => Buffer.byteLength(JSON.stringify(value.nodes), "utf8") <= 512_000,
	"Catalog value batch exceeds the command byte budget");
export const WriteCatalogRelationSchema = z.strictObject({
	expectedRevision: revision,
	definitionRevisionId: z.uuid(),
	spoiler: spoiler.default(0),
	replaces: replacement.optional(),
	participants: z.array(z.strictObject({
		roleRevisionId: z.uuid(), target: CatalogReferenceSchema,
		creditedAs: z.string().max(131072).optional(),
	})).min(1).max(128),
	qualifiers: z.array(relationQualifier).max(64).default([]),
}).refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= 512_000,
	"Catalog relation exceeds the command byte budget")
	.refine(value => value.qualifiers.reduce((count, qualifier) => count + ("nodes" in qualifier ? qualifier.nodes.length : 0), 0) <= 512,
		"Relation qualifier values exceed the atomic node budget");
export const CatalogSemanticMutationSchema = z.strictObject({
	revision, semanticId: z.uuid(), headVersion: revision,
});
export const CatalogSemanticCreatedSchema = CatalogSemanticMutationSchema.extend({ id: z.uuid() });
export const CatalogSemanticQuerySchema = z.strictObject({
	afterId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	definitionRevisionId: z.uuid().optional(),
	includeInactive: z.enum(["true", "false"]).default("false"),
	maxSpoiler: z.coerce.number().int().min(0).max(2).pipe(spoiler).default(0),
});
export const CatalogNodeQuerySchema = z.strictObject({
	afterPosition: z.coerce.number().int().min(-1).safe().default(-1),
	limit: z.coerce.number().int().min(1).max(128).default(100),
	maxSpoiler: z.coerce.number().int().min(0).max(2).pipe(spoiler).default(0),
	relationId: z.uuid().optional(),
	languageTag: z.string().min(1).max(255).optional(),
});
const semantic = z.strictObject({
	id: z.uuid(), semanticId: z.uuid(), definitionRevisionId: z.uuid(),
	spoiler, state: z.enum(CatalogFactStateValues), headVersion: revision,
});
export const CatalogFactSummarySchema = semantic.extend({ lastNodePosition: z.number().int().nonnegative().safe() });
export const CatalogRelationSummarySchema = semantic;
export const catalogSemanticPage = <T extends z.ZodType>(item: T) => z.strictObject({
	items: z.array(item).max(100), afterId: z.uuid().nullable(),
});
export const CatalogValuePageSchema = z.strictObject({
	items: z.array(CatalogValueNodeSchema.safeExtend({ rulePosition: z.number().int().nonnegative().safe() })).max(128), afterPosition: z.number().int().nonnegative().safe().nullable(),
});
export const CatalogParticipantSchema = z.strictObject({
	position: z.number().int().nonnegative().safe(), roleRevisionId: z.uuid(),
	target: CatalogReferenceSchema, creditedAs: z.string().nullable(),
	targetPreview: z.strictObject({ shape: z.string(), title: z.string().nullable() }).nullable(),
});
export const CatalogParticipantPageSchema = z.strictObject({
	items: z.array(CatalogParticipantSchema).max(128), afterPosition: z.number().int().nonnegative().safe().nullable(),
});
export const CatalogQualifierSchema = z.strictObject({ id: z.uuid(), definitionRevisionId: z.uuid(), valueFactId: z.uuid(), valueFactPurpose: z.enum(["assertion", "qualifier"]) });
export const CatalogSemanticHistoryQuerySchema = z.strictObject({
	afterVersion: z.coerce.number().int().nonnegative().safe().default(0),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const CatalogSemanticHistorySchema = z.strictObject({
	items: z.array(z.strictObject({
		version: revision, factId: z.uuid().nullable(), relationId: z.uuid().nullable(), definitionRevisionId: z.uuid(),
		state: z.enum(CatalogFactStateValues), createdAt: z.iso.datetime(),
	})).max(100), afterVersion: revision.nullable(),
});
export const CatalogSemanticStateSchema = z.strictObject({
	expectedRevision: revision, expectedHeadVersion: revision,
	state: z.enum(["disputed", "withdrawn", "superseded"]),
});
export const CatalogSemanticRestoreSchema = z.strictObject({
	expectedRevision: revision, expectedHeadVersion: revision, restoreVersion: revision,
});
