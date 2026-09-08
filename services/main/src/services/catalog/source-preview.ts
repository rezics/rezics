import { createHash } from "node:crypto";
import { z } from "zod";
import { CatalogReferenceSchema } from "./contracts";
import { CatalogSourceProposalSchema } from "./source-api-contracts";
import { SOURCE_DOCUMENT_BYTE_LIMIT } from "../database/schema/catalog-source-limits";
import { CatalogSourcePartKeySchema } from "./source-multipart-contracts";

const scalarKind = z.enum(["null", "string", "number", "boolean", "object", "array"]);
// The observed 223-disc release has 293,352 raw nodes and 284,018 native nodes.
// A diff can visit the disjoint union of two individually bounded documents.
export const SourcePreviewNodeLimit = 500_000;
const SourcePreviewDiffNodeLimit = SourcePreviewNodeLimit * 2;
export const CatalogSourcePreviewQuerySchema = z.strictObject({
	action: z.enum(["apply", "withdraw"]).default("apply"),
	profileKey: CatalogSourcePartKeySchema.optional(),
	afterPosition: z.coerce.number().int().min(-1).max(SourcePreviewDiffNodeLimit).default(-1),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const CatalogSourcePreviewValueQuerySchema = z.strictObject({
	action: z.enum(["apply", "withdraw"]).default("apply"), side: z.enum(["before", "after"]),
	profileKey: CatalogSourcePartKeySchema.optional(),
	path: z.string().max(4096), offset: z.coerce.number().int().min(0).max(SOURCE_DOCUMENT_BYTE_LIMIT).default(0),
	limit: z.coerce.number().int().min(1).max(16_384).default(8192),
});
const previewValue = z.strictObject({ kind: scalarKind, text: z.string().max(2048), sha256: z.string().regex(/^[0-9a-f]{64}$/u), complete: z.boolean() });
export const CatalogSourcePreviewProfileSchema = z.strictObject({
	key: CatalogSourcePartKeySchema, profile: z.string().max(128), kind: z.enum(["upstream_response", "derived_view"]),
	contentSha256: z.string().regex(/^[0-9a-f]{64}$/u), byteLength: z.number().int().positive().max(SOURCE_DOCUMENT_BYTE_LIMIT),
	requestUrl: z.url().max(2048).nullable(), observedAt: z.iso.datetime({ offset: true }),
	derivedFrom: z.array(z.strictObject({ key: CatalogSourcePartKeySchema, contentSha256: z.string().regex(/^[0-9a-f]{64}$/u) })).max(3),
});
export const CatalogSourcePreviewSchema = z.strictObject({
	proposal: CatalogSourceProposalSchema, reference: CatalogReferenceSchema,
	beforeSnapshotId: z.uuid().nullable(), afterSnapshotId: z.uuid(), beforeSha256: z.string().nullable(), afterSha256: z.string().nullable(),
	beforeArchiveSha256: z.string().nullable(), afterArchiveSha256: z.string(), profileKey: CatalogSourcePartKeySchema.nullable(),
	profiles: z.strictObject({ before: z.array(CatalogSourcePreviewProfileSchema).max(4), after: z.array(CatalogSourcePreviewProfileSchema).max(4) }),
	changes: z.array(z.strictObject({ position: z.number().int().nonnegative(), path: z.string().max(4096), before: previewValue.nullable(), after: previewValue.nullable() })).max(100),
	afterPosition: z.number().int().nonnegative().nullable(),
});
export const CatalogSourcePreviewValueSchema = z.strictObject({ kind: scalarKind, text: z.string().max(16_384), sha256: z.string(), afterOffset: z.number().int().nonnegative().nullable() });

const Missing = Symbol("missing-source-value");
function kind(value: unknown) {
	if (value === null) return "null" as const;
	if (Array.isArray(value)) return "array" as const;
	if (typeof value === "object") return "object" as const;
	if (typeof value === "string") return "string" as const;
	if (typeof value === "number" && Number.isFinite(value)) return "number" as const;
	if (typeof value === "boolean") return "boolean" as const;
	throw new TypeError("Source preview contains a non-JSON value");
}
function document(bytes: Uint8Array) {
	if (bytes.byteLength > SOURCE_DOCUMENT_BYTE_LIMIT) throw new RangeError("Source preview document exceeds its archive budget");
	const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const pending = [{ value, depth: 0 }];
	let nodes = 0;
	while (pending.length) {
		const item = pending.pop();
		if (!item) break;
		if (++nodes > SourcePreviewNodeLimit || item.depth > 64) throw new RangeError("Source preview document exceeds its structural budget");
		kind(item.value);
		if (item.value !== null && typeof item.value === "object")
			for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 });
	}
	return value;
}
function describe(value: unknown) {
	if (value === Missing) return null;
	const text = JSON.stringify(value);
	if (text === undefined) throw new TypeError("Source preview value cannot be serialized");
	return { kind: kind(value), text: text.slice(0, 2048), sha256: createHash("sha256").update(text).digest("hex"), complete: text.length <= 2048 };
}
function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function pointerKey(value: string) { return value.replaceAll("~", "~0").replaceAll("/", "~1"); }

/** Actual source values, not a claimed native mutation plan. Work is bounded by two archive documents. */
export function previewCatalogSourceChanges(beforeBytes: Uint8Array | null, afterBytes: Uint8Array | null,
	input: Pick<z.input<typeof CatalogSourcePreviewQuerySchema>, "afterPosition" | "limit">) {
	const query = CatalogSourcePreviewQuerySchema.parse(input);
	const stack: { before: unknown; after: unknown; path: string; depth: number }[] = [
		{ before: beforeBytes ? document(beforeBytes) : Missing, after: afterBytes ? document(afterBytes) : Missing, path: "", depth: 0 },
	];
	const changes: z.infer<typeof CatalogSourcePreviewSchema>["changes"] = [];
	let visited = 0, position = -1;
	while (stack.length) {
		const item = stack.pop();
		if (!item) break;
		if (++visited > SourcePreviewDiffNodeLimit || item.depth > 64 || item.path.length > 4096)
			throw new RangeError("Source review exceeds the bounded structural preview grammar");
		if (Object.is(item.before, item.after)) continue;
		if ((object(item.before) && object(item.after)) || (Array.isArray(item.before) && Array.isArray(item.after))) {
			const before = item.before, after = item.after;
			const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
			if (keys.length) {
				for (const key of keys.reverse()) stack.push({
					before: Object.hasOwn(before, key) ? Reflect.get(before, key) : Missing,
					after: Object.hasOwn(after, key) ? Reflect.get(after, key) : Missing,
					path: `${item.path}/${pointerKey(key)}`, depth: item.depth + 1,
				});
				continue;
			}
			continue;
		}
		position++;
		if (position <= query.afterPosition) continue;
		if (changes.length === query.limit) return { changes, afterPosition: changes.at(-1)?.position ?? null };
		changes.push({ position, path: item.path, before: describe(item.before), after: describe(item.after) });
	}
	return { changes, afterPosition: null };
}

/** Long source values remain inspectable as text chunks; JSON is never executed or inserted as markup. */
export function previewCatalogSourceValue(bytes: Uint8Array, input: z.input<typeof CatalogSourcePreviewValueQuerySchema>) {
	const query = CatalogSourcePreviewValueQuerySchema.parse(input);
	let value = document(bytes);
	if (query.path && !query.path.startsWith("/")) throw new TypeError("Source value path must be a JSON pointer");
	const path = query.path ? query.path.slice(1).split("/") : [];
	if (path.length > 64) throw new RangeError("Source value path is too deep");
	for (const part of path) {
		if (/~(?:[^01]|$)/u.test(part)) throw new TypeError("Source value pointer escape is invalid");
		const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
		if ((!object(value) && !Array.isArray(value)) || !Object.hasOwn(value, key)) throw new TypeError("Source value path is missing");
		value = Reflect.get(value, key);
	}
	const text = JSON.stringify(value);
	if (text === undefined) throw new TypeError("Source value cannot be serialized");
	if (query.offset > text.length) throw new TypeError("Source value offset exceeds its length");
	const end = Math.min(text.length, query.offset + query.limit);
	return { kind: kind(value), text: text.slice(query.offset, end), sha256: createHash("sha256").update(text).digest("hex"), afterOffset: end < text.length ? end : null };
}
