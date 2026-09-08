import { parseContentLanguageTag } from "@rezics/content-language";
import { z } from "zod";
import { CatalogValueKindValues } from "./contracts";
import { CatalogDefinitionConstraintsSchema } from "./definition-contracts";
import { CatalogRevisionNumberSchema } from "./name-contracts";

const text = (bytes: number) => z.string().min(1).refine(value => Buffer.byteLength(value, "utf8") <= bytes);
export const CatalogDefinitionKindSchema = z.enum(["class", "property", "predicate", "role", "vocabulary"]);
const namespace = z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u);
const key = z.string().min(1).max(160);
export const CatalogDefinitionLanguageSchema = z.string().min(1).max(255).refine(value => {
	try { return parseContentLanguageTag(value).kind !== "private-use"; } catch { return false; }
}, "A governed definition label requires a registered language tag");
export const CatalogDefinitionLabelSchema = z.strictObject({
	languageTag: CatalogDefinitionLanguageSchema, label: text(800), description: text(4096).nullable().default(null),
});
const meaning = {
	valueKind: z.enum(CatalogValueKindValues).nullable(), constraints: CatalogDefinitionConstraintsSchema,
	labels: z.array(CatalogDefinitionLabelSchema).min(1).max(32).refine(labels => {
		try { return new Set(labels.map(label => parseContentLanguageTag(label.languageTag).tag)).size === labels.length; }
		catch { return false; }
	}, "One preferred label per language is allowed"),
	reason: text(8192),
};
export const CreateCatalogDefinitionSchema = z.strictObject({ namespace, key, kind: CatalogDefinitionKindSchema, ...meaning });
export const ReviseCatalogDefinitionSchema = z.strictObject({ expectedVersion: CatalogRevisionNumberSchema, ...meaning });
export const CatalogDefinitionQuerySchema = z.strictObject({
	kind: CatalogDefinitionKindSchema.optional(), namespace: namespace.optional(),
	afterNamespace: namespace.optional(), afterKey: key.optional(),
	languageTag: CatalogDefinitionLanguageSchema.optional(), limit: z.coerce.number().int().min(1).max(50).default(25),
}).refine(value => Boolean(value.afterNamespace) === Boolean(value.afterKey), "Definition cursor requires both key parts");
export const CatalogDefinitionHistoryQuerySchema = z.strictObject({
	afterVersion: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
	languageTag: CatalogDefinitionLanguageSchema.optional(), limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const CatalogDefinitionRevisionSummarySchema = z.strictObject({
	id: z.uuid(), version: CatalogRevisionNumberSchema, valueKind: z.enum(CatalogValueKindValues).nullable(),
	label: z.strictObject({ languageTag: z.string(), label: z.string() }).nullable(),
});
export const CatalogDefinitionRevisionSchema = z.strictObject({
	id: z.uuid(), definitionId: z.uuid(), version: CatalogRevisionNumberSchema,
	valueKind: z.enum(CatalogValueKindValues).nullable(), constraints: CatalogDefinitionConstraintsSchema,
	labels: z.array(CatalogDefinitionLabelSchema).max(32), createdAt: z.iso.datetime(), reviewed: z.boolean(),
});
const identity = { id: z.uuid(), namespace, key, kind: CatalogDefinitionKindSchema };
export const CatalogDefinitionSchema = z.strictObject({ ...identity, current: CatalogDefinitionRevisionSchema.nullable() });
export const CatalogDefinitionPageSchema = z.strictObject({
	items: z.array(z.strictObject({ ...identity, current: CatalogDefinitionRevisionSummarySchema.nullable() })).max(50),
	after: z.strictObject({ afterNamespace: namespace, afterKey: key }).nullable(),
});
export const CatalogDefinitionHistorySchema = z.strictObject({
	items: z.array(CatalogDefinitionRevisionSummarySchema).max(50), afterVersion: CatalogRevisionNumberSchema.nullable(),
});
export const CatalogDefinitionRevisionLabelsQuerySchema = z.strictObject({
	ids: z.array(z.uuid()).min(1).max(32), languageTag: CatalogDefinitionLanguageSchema.optional(),
});
export const CatalogDefinitionRevisionLabelsSchema = z.strictObject({
	items: z.array(z.strictObject({ id: z.uuid(), definitionId: z.uuid(), kind: CatalogDefinitionKindSchema,
		version: CatalogRevisionNumberSchema, label: z.strictObject({ languageTag: z.string(), label: z.string() }).nullable(),
	})).max(32),
});
