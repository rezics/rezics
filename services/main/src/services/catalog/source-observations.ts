import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { storage } from "../storage";
import { catalogSourceRecord, catalogSourceSnapshot } from "../database/schema/catalog-source";
import { appendOperationalOutbox } from "../events/durability";
import { createSourceObservationEvent } from "./source-events";

import { sourceKeySchema, catalogSourceRecordId, type CatalogSourceKey } from "./source-record-key";
export { catalogSourceRecordId, type CatalogSourceKey } from "./source-record-key";

/** @internal Registers and locks the source aggregate, detecting even a hash collision. */
export async function registerCatalogSourceRecord(
	tx: DatabaseTransaction,
	input: CatalogSourceKey,
) {
	const key = sourceKeySchema.parse(input);
	const id = catalogSourceRecordId(key);
	await tx
		.insert(catalogSourceRecord)
		.values({ id, ...key })
		.onConflictDoNothing();
	const [record] = await tx
		.select()
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, id))
		.limit(1)
		.for("update");
	if (
		!record ||
		record.source !== key.source ||
		record.objectType !== key.objectType ||
		record.externalId !== key.externalId
	)
		throw new Error("Source identity hash collision or missing registration");
	return record;
}

export type CatalogSourceAcquisition = Readonly<{ sourceRecordId: string; generation: number }>;

/** @internal Commit this generation BEFORE fetching: arrival order never determines authority. */
export async function beginCatalogSourceAcquisition(
	tx: DatabaseTransaction,
	key: CatalogSourceKey,
): Promise<CatalogSourceAcquisition> {
	const record = await registerCatalogSourceRecord(tx, key);
	const [updated] = await tx
		.update(catalogSourceRecord)
		.set({ acquisitionGeneration: sql`${catalogSourceRecord.acquisitionGeneration} + 1` })
		.where(eq(catalogSourceRecord.id, record.id))
		.returning();
	if (!updated) throw new Error("Source acquisition registration failed");
	return { sourceRecordId: record.id, generation: updated.acquisitionGeneration };
}
const storedReceipt = Symbol("stored-catalog-source-receipt");
const issuedReceipts = new WeakSet<object>();
export type CatalogSourceArchive = {
	put(
		input: {
			Key: string;
			Body: Uint8Array;
			ContentLength: number;
			ContentType: string;
			Metadata: Record<string, string>;
			CacheControl: string;
		},
		options?: { signal?: AbortSignal },
	): Promise<unknown>;
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
	acquisition: CatalogSourceAcquisition | null;
}>;

/** Archive before opening a database transaction; only object keys are persisted. */
export async function storeCatalogSourcePayload(
	input: CatalogSourceKey,
	bytes: Uint8Array,
	contractSha256: string,
	sourceRevision: string | null = null,
	archive: CatalogSourceArchive = storage,
	acquisition: CatalogSourceAcquisition | null = null,
	signal?: AbortSignal,
): Promise<CatalogSourceReceipt> {
	const key = sourceKeySchema.parse(input);
	if (sourceRevision !== null) z.string().max(512).parse(sourceRevision);
	if (
		acquisition &&
		(acquisition.sourceRecordId !== catalogSourceRecordId(key) ||
			!Number.isSafeInteger(acquisition.generation) ||
			acquisition.generation < 1)
	)
		throw new TypeError("Source acquisition does not match its receipt");
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
	await archive.put(
		{
			Key: payloadRef,
			Body: payload,
			ContentLength: payload.byteLength,
			ContentType: "application/json",
			Metadata: { content_sha256: contentSha256 },
			CacheControl: "private, no-store",
		},
		{ signal },
	);
	const receipt: CatalogSourceReceipt = Object.freeze({
		[storedReceipt]: true as const,
		key: Object.freeze(key),
		contentSha256,
		contractSha256,
		payloadRef,
		sourceRevision,
		acquisition: acquisition === null ? null : Object.freeze({ ...acquisition }),
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

/** @internal Reopen committed immutable evidence after restart; the caller already checked source-use authority. */
export async function loadCatalogSourceReceipt(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	snapshotId: string,
	archive: CatalogSourceArchive = storage,
): Promise<CatalogSourceReceipt> {
	z.uuid().parse(sourceRecordId);
	z.uuid().parse(snapshotId);
	const [record] = await tx
		.select()
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, sourceRecordId))
		.limit(1);
	const [snapshot] = await tx
		.select()
		.from(catalogSourceSnapshot)
		.where(
			and(
				eq(catalogSourceSnapshot.sourceRecordId, sourceRecordId),
				eq(catalogSourceSnapshot.id, snapshotId),
			),
		)
		.limit(1);
	if (!record || !snapshot) throw new Error("Committed source evidence is missing");
	const key = sourceKeySchema.parse({
		source: record.source,
		objectType: record.objectType,
		externalId: record.externalId,
	});
	const receipt: CatalogSourceReceipt = Object.freeze({
		[storedReceipt]: true as const,
		key: Object.freeze(key),
		contentSha256: snapshot.contentSha256,
		contractSha256: snapshot.contractSha256,
		payloadRef: snapshot.payloadRef,
		sourceRevision: snapshot.sourceRevision,
		acquisition: null,
	});
	issuedReceipts.add(receipt);
	receiptArchives.set(receipt, archive);
	return receipt;
}

/** Identical repeat observations reuse the head; new observations never overwrite it. */
export async function recordCatalogSourceObservation(
	tx: DatabaseTransaction,
	receipt: CatalogSourceReceipt,
) {
	if (!issuedReceipts.has(receipt) || receipt[storedReceipt] !== true)
		throw new TypeError("Source receipt was not produced by the archive writer");
	return tx.transaction(async (tx) => {
		const record = await registerCatalogSourceRecord(tx, receipt.key);
		const generation = receipt.acquisition?.generation;
		if (generation === undefined && record.acquisitionGeneration > 0)
			throw new Error("An actively acquired source requires its before-fetch generation");
		if (
			generation !== undefined &&
			(generation !== record.acquisitionGeneration || generation < record.acceptedGeneration)
		)
			throw new Error("Source acquisition generation is stale");
		const [head] =
			record.headSnapshotId === null
				? []
				: await tx
						.select()
						.from(catalogSourceSnapshot)
						.where(
							and(
								eq(catalogSourceSnapshot.sourceRecordId, record.id),
								eq(catalogSourceSnapshot.id, record.headSnapshotId),
							),
						)
						.limit(1);
		if (
			head &&
			head.contentSha256 === receipt.contentSha256 &&
			head.contractSha256 === receipt.contractSha256 &&
			head.sourceRevision === receipt.sourceRevision
		) {
			await tx
				.update(catalogSourceRecord)
				.set({
					lastCheckedAt: new Date(),
					lastCheckOutcome: "unchanged",
					...(generation === undefined ? {} : { acceptedGeneration: generation }),
				})
				.where(eq(catalogSourceRecord.id, record.id));
			return { record, snapshot: head, repeated: true };
		}
		if (generation !== undefined && generation === record.acceptedGeneration)
			throw new Error("A completed source acquisition cannot publish different content");
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
		await tx
			.update(catalogSourceRecord)
			.set({
				headSnapshotId: snapshot.id,
				lastCheckedAt: new Date(),
				lastCheckOutcome: "changed",
				...(generation === undefined ? {} : { acceptedGeneration: generation }),
			})
			.where(eq(catalogSourceRecord.id, record.id));
		await appendOperationalOutbox(tx, [createSourceObservationEvent(snapshot)]);
		return { record, snapshot, repeated: false };
	});
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
	const document = parseSourceDocument(receipt, bytes);
	const observation = await recordCatalogSourceObservation(tx, receipt);
	return sourceDocumentEvidence(receipt, document, observation);
}

function parseSourceDocument(receipt: CatalogSourceReceipt, bytes: Uint8Array): unknown {
	if (
		!issuedReceipts.has(receipt) ||
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("Source reference document differs from its archive receipt");
	return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function sourceDocumentEvidence(
	receipt: CatalogSourceReceipt,
	document: unknown,
	observation: Awaited<ReturnType<typeof recordCatalogSourceObservation>>,
) {
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

/** Reopen exact archived evidence without observing again, changing acquisition generations or regressing the head. @internal */
export async function loadCatalogSourceDocument(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	snapshotId: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	z.uuid().parse(sourceRecordId);
	z.uuid().parse(snapshotId);
	const document = parseSourceDocument(receipt, bytes);
	if (catalogSourceRecordId(receipt.key) !== sourceRecordId)
		throw new TypeError("Source document belongs to another record");
	const [record] = await tx
		.select()
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, sourceRecordId))
		.limit(1);
	const [snapshot] = await tx
		.select()
		.from(catalogSourceSnapshot)
		.where(
			and(
				eq(catalogSourceSnapshot.sourceRecordId, sourceRecordId),
				eq(catalogSourceSnapshot.id, snapshotId),
			),
		)
		.limit(1);
	if (
		!record ||
		!snapshot ||
		snapshot.contentSha256 !== receipt.contentSha256 ||
		snapshot.contractSha256 !== receipt.contractSha256 ||
		snapshot.payloadRef !== receipt.payloadRef ||
		snapshot.sourceRevision !== receipt.sourceRevision
	)
		throw new TypeError("Source document differs from the exact committed snapshot");
	return sourceDocumentEvidence(receipt, document, { record, snapshot, repeated: true });
}

export function requireCatalogSourceReferenceEvidence(evidence: CatalogSourceReferenceEvidence) {
	if (!issuedReferenceEvidence.has(evidence))
		throw new TypeError("Source reference evidence was not issued by the recorded document");
	return evidence;
}
