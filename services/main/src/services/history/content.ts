import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type { JsonValue } from "@rezics/portable-text";

import type { DatabaseTransaction } from "../database";
import { revisionContent, type RevisionContentEncoding } from "../database/schema";

export type RevisionContentDocument = {
	readonly model: string;
	readonly payload: unknown;
};

export type StoredRevisionContent = {
	readonly id: string;
	readonly byteSize: number;
	readonly encoding: RevisionContentEncoding;
	readonly baseContentId: string | null;
	readonly deltaDepth: number;
};

export type MaterializedRevisionContent = {
	readonly model: string;
	readonly payload: unknown;
	readonly deltaDepth: number;
};

export function normalizeRevisionJson(value: unknown): JsonValue {
	const serialized = JSON.stringify(value);
	if (serialized === undefined) throw new TypeError("Revision content must be valid JSON");
	return JSON.parse(serialized) as JsonValue;
}

export function canonicalRevisionJson(value: unknown): string {
	if (value === null || typeof value !== "object") {
		const serialized = JSON.stringify(value);
		if (serialized === undefined) throw new TypeError("Revision content must be valid JSON");
		return serialized;
	}
	if (Array.isArray(value)) return `[${value.map(canonicalRevisionJson).join(",")}]`;
	return `{${Object.entries(value)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, item]) => `${JSON.stringify(key)}:${canonicalRevisionJson(item)}`)
		.join(",")}}`;
}

export function revisionPayloadByteSize(payload: unknown): number {
	return Buffer.byteLength(canonicalRevisionJson(normalizeRevisionJson(payload)));
}

export async function findOrCreateRevisionContent(
	tx: DatabaseTransaction,
	document: RevisionContentDocument,
	storage: {
		readonly encoding: RevisionContentEncoding;
		readonly baseContentId: string | null;
		readonly deltaDepth: number;
	} = { encoding: "full", baseContentId: null, deltaDepth: 0 },
): Promise<StoredRevisionContent> {
	const payload = normalizeRevisionJson(document.payload);
	const canonical =
		storage.encoding === "full"
			? canonicalRevisionJson(payload)
			: canonicalRevisionJson({
					encoding: storage.encoding,
					baseContentId: storage.baseContentId,
					payload,
				});
	const sha256 = createHash("sha256").update(canonical).digest("hex");
	const byteSize = Buffer.byteLength(canonicalRevisionJson(payload));
	await tx
		.insert(revisionContent)
		.values({
			model: document.model,
			sha256,
			byteSize,
			encoding: storage.encoding,
			baseContentId: storage.baseContentId,
			deltaDepth: storage.deltaDepth,
			payload,
		})
		.onConflictDoNothing({
			target: [revisionContent.model, revisionContent.sha256],
		});
	const [content] = await tx
		.select({
			id: revisionContent.id,
			byteSize: revisionContent.byteSize,
			encoding: revisionContent.encoding,
			baseContentId: revisionContent.baseContentId,
			deltaDepth: revisionContent.deltaDepth,
			payload: revisionContent.payload,
		})
		.from(revisionContent)
		.where(and(eq(revisionContent.model, document.model), eq(revisionContent.sha256, sha256)))
		.limit(1);
	if (!content) throw new Error("Revision content hash collision");
	const storedCanonical =
		content.encoding === "full"
			? canonicalRevisionJson(content.payload)
			: canonicalRevisionJson({
					encoding: content.encoding,
					baseContentId: content.baseContentId,
					payload: content.payload,
				});
	if (storedCanonical !== canonical) throw new Error("Revision content hash collision");
	return content;
}

export async function materializeStoredRevisionContent(
	tx: DatabaseTransaction,
	contentId: string,
	options: {
		readonly maxDeltaDepth: number;
		readonly applyDelta: (model: string, base: unknown, delta: unknown) => unknown;
	},
	cache = new Map<string, MaterializedRevisionContent>(),
	visiting = new Set<string>(),
): Promise<MaterializedRevisionContent> {
	const cached = cache.get(contentId);
	if (cached) return cached;
	if (visiting.has(contentId)) throw new Error(`Revision content delta cycle at ${contentId}`);
	visiting.add(contentId);
	const [content] = await tx
		.select({
			model: revisionContent.model,
			encoding: revisionContent.encoding,
			baseContentId: revisionContent.baseContentId,
			deltaDepth: revisionContent.deltaDepth,
			payload: revisionContent.payload,
		})
		.from(revisionContent)
		.where(eq(revisionContent.id, contentId))
		.limit(1);
	if (!content) throw new Error(`Missing revision content ${contentId}`);
	if (content.encoding === "full") {
		const materialized = {
			model: content.model,
			payload: content.payload,
			deltaDepth: content.deltaDepth,
		};
		cache.set(contentId, materialized);
		visiting.delete(contentId);
		return materialized;
	}
	if (
		!content.baseContentId ||
		content.deltaDepth < 1 ||
		content.deltaDepth > options.maxDeltaDepth
	)
		throw new Error(`Invalid delta chain at revision content ${contentId}`);
	const base = await materializeStoredRevisionContent(
		tx,
		content.baseContentId,
		options,
		cache,
		visiting,
	);
	if (base.model !== content.model || base.deltaDepth !== content.deltaDepth - 1)
		throw new Error(`Invalid delta base at revision content ${contentId}`);
	const materialized = {
		model: content.model,
		payload: options.applyDelta(content.model, base.payload, content.payload),
		deltaDepth: content.deltaDepth,
	};
	cache.set(contentId, materialized);
	visiting.delete(contentId);
	return materialized;
}
