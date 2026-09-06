import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { storage } from "../storage";
import { catalogSourceRecord, catalogSourceSnapshot } from "../database/schema/catalog-source";

const sourceKeySchema = z.strictObject({
	source: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
	objectType: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
	externalId: z
		.string()
		.min(1)
		.refine((value) => Buffer.byteLength(value, "utf8") <= 512),
});
export type CatalogSourceKey = z.infer<typeof sourceKeySchema>;
const storedReceipt = Symbol("stored-catalog-source-receipt");
const issuedReceipts = new WeakSet<object>();
export type CatalogSourceArchive = {
	put(input: {
		Key: string;
		Body: Uint8Array;
		ContentLength: number;
		ContentType: string;
		Metadata: Record<string, string>;
		CacheControl: string;
	}): Promise<unknown>;
	get(input: { Key: string }): Promise<{ Body?: unknown }>;
};
const receiptArchives = new WeakMap<object, CatalogSourceArchive>();
export type CatalogSourceReceipt = Readonly<{
	[storedReceipt]: true;
	key: CatalogSourceKey;
	contentSha256: string;
	contractSha256: string;
	payloadRef: string;
	sourceRevision: string | null;
}>;

/** Archive before opening a database transaction; only object keys are persisted. */
export async function storeCatalogSourcePayload(
	input: CatalogSourceKey,
	bytes: Uint8Array,
	contractSha256: string,
	sourceRevision: string | null = null,
	archive: CatalogSourceArchive = storage,
): Promise<CatalogSourceReceipt> {
	const key = sourceKeySchema.parse(input);
	z.string()
		.regex(/^[a-f0-9]{64}$/u)
		.parse(contractSha256);
	if (bytes.byteLength > 8_000_000)
		throw new RangeError("Source record exceeds the admitted 8 MB archive budget");
	// Upload and checksum must observe the same bytes even if the caller reuses its buffer.
	const payload = new Uint8Array(bytes);
	const contentSha256 = createHash("sha256").update(payload).digest("hex");
	const keyHash = createHash("sha256").update(JSON.stringify(key)).digest("hex");
	const payloadRef = `catalog-sources/${key.source}/${keyHash}/${contentSha256}.json`;
	await archive.put({
		Key: payloadRef,
		Body: payload,
		ContentLength: payload.byteLength,
		ContentType: "application/json",
		Metadata: { content_sha256: contentSha256 },
		CacheControl: "private, no-store",
	});
	const receipt: CatalogSourceReceipt = Object.freeze({
		[storedReceipt]: true as const,
		key: Object.freeze(key),
		contentSha256,
		contractSha256,
		payloadRef,
		sourceRevision,
	});
	issuedReceipts.add(receipt);
	receiptArchives.set(receipt, archive);
	return receipt;
}

/** The immutable archive is verified on read; external URLs never become fetch instructions. */
export async function readCatalogSourceBytes(receipt: CatalogSourceReceipt): Promise<Uint8Array> {
	if (!issuedReceipts.has(receipt) || receipt[storedReceipt] !== true)
		throw new TypeError("Source receipt was not produced by the archive writer");
	const archive = receiptArchives.get(receipt);
	if (!archive) throw new TypeError("Source receipt has no archive owner");
	const result = await archive.get({ Key: receipt.payloadRef });
	if (!result.Body) throw new Error("Archived source payload is missing");
	if (!(result.Body instanceof Readable) && !(result.Body instanceof ReadableStream))
		throw new TypeError("Source archive returned an unsupported byte stream");
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const chunk of result.Body) {
		if (!(chunk instanceof Uint8Array))
			throw new TypeError("Source archive stream did not contain bytes");
		length += chunk.byteLength;
		if (length > 8_000_000) throw new RangeError("Archived source payload exceeds its read budget");
		chunks.push(chunk);
	}
	const bytes = Buffer.concat(chunks);
	if (createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256)
		throw new Error("Archived source checksum differs");
	return bytes;
}

/** Identical repeat observations reuse the head; new observations never overwrite it. */
export async function recordCatalogSourceObservation(
	tx: DatabaseTransaction,
	receipt: CatalogSourceReceipt,
) {
	if (!issuedReceipts.has(receipt) || receipt[storedReceipt] !== true)
		throw new TypeError("Source receipt was not produced by the archive writer");
	await tx.insert(catalogSourceRecord).values(receipt.key).onConflictDoNothing();
	const [record] = await tx
		.select()
		.from(catalogSourceRecord)
		.where(
			and(
				eq(catalogSourceRecord.source, receipt.key.source),
				eq(catalogSourceRecord.objectType, receipt.key.objectType),
				eq(catalogSourceRecord.externalId, receipt.key.externalId),
			),
		)
		.limit(1)
		.for("update");
	if (!record) throw new Error("Source identity registration returned no row");
	const [head] = await tx
		.select()
		.from(catalogSourceSnapshot)
		.where(eq(catalogSourceSnapshot.sourceRecordId, record.id))
		.orderBy(desc(catalogSourceSnapshot.observedAt), desc(catalogSourceSnapshot.id))
		.limit(1);
	if (
		head &&
		head.contentSha256 === receipt.contentSha256 &&
		head.contractSha256 === receipt.contractSha256 &&
		head.sourceRevision === receipt.sourceRevision
	)
		return { record, snapshot: head, repeated: true };
	const [snapshot] = await tx
		.insert(catalogSourceSnapshot)
		.values({
			sourceRecordId: record.id,
			contentSha256: receipt.contentSha256,
			contractSha256: receipt.contractSha256,
			payloadRef: receipt.payloadRef,
			sourceRevision: receipt.sourceRevision,
		})
		.returning();
	if (!snapshot) throw new Error("Source snapshot insertion returned no row");
	return { record, snapshot, repeated: false };
}

const issuedReferenceEvidence = new WeakSet<object>();
export type CatalogSourceReferenceEvidence = Readonly<{
	source: string;
	sourceRecordId: string;
	snapshotId: string;
	path: string;
	externalId: string;
}>;

/** Resolve exact JSON Pointer tokens without prototype lookup or array-index coercion. */
export function sourceReferenceAt(document: unknown, path: string): string {
	if (!path.startsWith("/") || Buffer.byteLength(path, "utf8") > 512 || /~(?![01])/u.test(path))
		throw new TypeError("Source reference requires a bounded JSON pointer");
	let value = document;
	for (const encoded of path.slice(1).split("/")) {
		const token = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
		if (Array.isArray(value)) {
			if (!/^(0|[1-9][0-9]*)$/u.test(token) || !Object.hasOwn(value, token))
				throw new TypeError("Source reference array position is missing or invalid");
			value = value[Number(token)];
		} else if (value !== null && typeof value === "object" && Object.hasOwn(value, token)) {
			value = Reflect.get(value, token);
		} else throw new TypeError("Source reference path is missing");
	}
	if (typeof value === "string" && value.length > 0) return value;
	if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
	throw new TypeError("Source reference is not an exact string or integer identity");
}

/** Evidence capabilities are issued only for the bytes of the recorded immutable snapshot. */
export async function recordCatalogSourceDocument(
	tx: DatabaseTransaction,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		!issuedReceipts.has(receipt) ||
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("Source reference document differs from its archive receipt");
	const document: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const observation = await recordCatalogSourceObservation(tx, receipt);
	return {
		...observation,
		referenceAt(path: string): CatalogSourceReferenceEvidence {
			const evidence = Object.freeze({
				source: receipt.key.source,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				path,
				externalId: sourceReferenceAt(document, path),
			});
			issuedReferenceEvidence.add(evidence);
			return evidence;
		},
	};
}

export function requireCatalogSourceReferenceEvidence(evidence: CatalogSourceReferenceEvidence) {
	if (!issuedReferenceEvidence.has(evidence))
		throw new TypeError("Source reference evidence was not issued by the recorded document");
	return evidence;
}
