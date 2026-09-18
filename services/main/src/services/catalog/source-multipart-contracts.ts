import { SOURCE_DOCUMENT_BYTE_LIMIT, SOURCE_MULTIPART_BYTE_LIMIT, SOURCE_MULTIPART_PART_LIMIT } from "@rezics/schema/postgres/ingestion/source-limits";
import { z } from "zod";
import { sourceKeySchema } from "./source-record-key";

export const CatalogSourcePartKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u);
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
export const CatalogSourcePartSchema = z.strictObject({
	key: CatalogSourcePartKeySchema, profile: z.string().min(1).max(128), kind: z.enum(["upstream_response", "derived_view"]),
	contentSha256: hash, payloadRef: z.string().min(1).max(2048), byteLength: z.number().int().min(1).max(SOURCE_DOCUMENT_BYTE_LIMIT),
	requestUrl: z.url().max(2048).nullable(),
});
/** The checksum covers stable content and recipes; fresh check timestamps live in receipt rows. */
export const CatalogSourceManifestSchema = z.strictObject({
	format: z.literal("rezics.source.multipart-json.1"), key: sourceKeySchema, profile: z.string().min(1).max(128),
	derivationContractSha256: hash, consistency: z.literal("overlaps_validated"), nativePart: z.literal("native_view"),
	parts: z.array(CatalogSourcePartSchema).min(2).max(SOURCE_MULTIPART_PART_LIMIT),
}).superRefine((value, context) => {
	if (new Set(value.parts.map((part) => part.key)).size !== value.parts.length || value.parts.reduce((sum, part) => sum + part.byteLength, 0) > SOURCE_MULTIPART_BYTE_LIMIT)
		context.addIssue({ code: "custom", message: "Multipart identities or total size exceed the admission contract" });
	if (value.parts.filter((part) => part.kind === "derived_view" && part.key === "native_view" && part.requestUrl === null).length !== 1 ||
		value.parts.some((part) => part.kind === "derived_view" ? part.key !== "native_view" : part.requestUrl === null || part.key === "native_view"))
		context.addIssue({ code: "custom", message: "Multipart input requires exact raw responses and one declared derived view" });
});
export const CatalogSourceMultipartReceiptSchema = z.strictObject({
	manifest: CatalogSourceManifestSchema,
	observations: z.array(z.strictObject({ key: CatalogSourcePartKeySchema, observedAt: z.iso.datetime({ offset: true }) })).min(2).max(SOURCE_MULTIPART_PART_LIMIT),
}).superRefine((value, context) => {
	if (value.observations.length !== value.manifest.parts.length || new Set(value.observations.map((part) => part.key)).size !== value.manifest.parts.length ||
		value.observations.some((observation) => !value.manifest.parts.some((part) => part.key === observation.key)))
		context.addIssue({ code: "custom", message: "Multipart observation receipts do not cover its exact parts" });
});
export type CatalogSourceMultipartReceipt = z.infer<typeof CatalogSourceMultipartReceiptSchema>;
