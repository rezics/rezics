import { SOURCE_DOCUMENT_BYTE_LIMIT, SOURCE_MULTIPART_BYTE_LIMIT, SOURCE_MULTIPART_PART_LIMIT, SOURCE_MANIFEST_BYTE_LIMIT } from "../database/schema/catalog-source-limits";
import { withSourceDocumentPaths } from "./source-document-scope";
export { catalogSourcePath, catalogSourceLogicalPath } from "./source-document-scope";
import { isDeepStrictEqual } from "node:util";
import { catalogSourceSnapshotBundle, catalogSourceSnapshotPart } from "../database/schema/catalog-source-multipart";
import { CatalogSourceManifestSchema, CatalogSourceMultipartReceiptSchema, type CatalogSourceMultipartReceipt } from "./source-multipart-contracts";
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
const receiptSnapshots = new WeakMap<object, { sourceRecordId: string; snapshotId: string }>();
export type CatalogSourceReceipt = Readonly<{
	[storedReceipt]: true;
	key: CatalogSourceKey;
	contentSha256: string;
	contractSha256: string;
	payloadRef: string;
	sourceRevision: string | null;
	acquisition: CatalogSourceAcquisition | null;
	bundle?: CatalogSourceMultipartReceipt;
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
	if (bytes.byteLength > SOURCE_DOCUMENT_BYTE_LIMIT)
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

function freezeBundle(bundle: CatalogSourceMultipartReceipt) {
	Object.freeze(bundle.manifest.key);
	for (const part of bundle.manifest.parts) Object.freeze(part);
	Object.freeze(bundle.manifest.parts); Object.freeze(bundle.manifest);
	for (const observation of bundle.observations) Object.freeze(observation);
	Object.freeze(bundle.observations);
	return Object.freeze(bundle);
}

/** @internal Stable raw part hashes and the derivation recipe determine content identity; observation times are separate receipt metadata. */
export async function storeCatalogSourceMultipartPayload(input: CatalogSourceKey, profile: string, derivationContractSha256: string,
	parts: readonly { key: string; profile: string; kind: "upstream_response" | "derived_view"; bytes: Uint8Array; requestUrl: string | null; observedAt: string }[],
	contractSha256: string, archive: CatalogSourceArchive = storage, acquisition: CatalogSourceAcquisition | null = null, signal?: AbortSignal,
): Promise<CatalogSourceReceipt> {
	if (parts.length < 2 || parts.length > SOURCE_MULTIPART_PART_LIMIT || parts.reduce((sum, part) => sum + part.bytes.byteLength, 0) > SOURCE_MULTIPART_BYTE_LIMIT)
		throw new RangeError("Multipart source exceeds its part or total byte budget");
	const key = sourceKeySchema.parse(input);
	const stored = [];
	// Profile ordering is not observation content; normalize it before hashing the manifest.
	const orderedParts = [...parts].sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
	for (const part of orderedParts) {
		const receipt = await storeCatalogSourcePayload(key, part.bytes, contractSha256, null, archive, null, signal);
		stored.push({ key: part.key, profile: part.profile, kind: part.kind, contentSha256: receipt.contentSha256,
			payloadRef: receipt.payloadRef, byteLength: part.bytes.byteLength, requestUrl: part.requestUrl });
	}
	const bundle = CatalogSourceMultipartReceiptSchema.parse({ manifest: { format: "rezics.source.multipart-json.1", key, profile,
		derivationContractSha256, consistency: "overlaps_validated", nativePart: "native_view", parts: stored },
		observations: orderedParts.map((part) => ({ key: part.key, observedAt: part.observedAt })) });
	const bytes = new TextEncoder().encode(JSON.stringify(bundle.manifest));
	if (bytes.byteLength > SOURCE_MANIFEST_BYTE_LIMIT) throw new RangeError("Multipart manifest exceeds 64 KiB");
	const raw = await storeCatalogSourcePayload(key, bytes, contractSha256, null, archive, acquisition, signal);
	const receipt: CatalogSourceReceipt = Object.freeze({ ...raw, bundle: freezeBundle(bundle) });
	issuedReceipts.add(receipt); receiptArchives.set(receipt, archive);
	return receipt;
}

function requireIssuedReceipt(receipt: CatalogSourceReceipt) {
	if (!issuedReceipts.has(receipt) || receipt[storedReceipt] !== true) throw new TypeError("Source receipt was not produced by the archive writer");
}

/** @internal A native input is a real archived derived part for multipart snapshots, or the original single JSON response. */
export function catalogSourceDocumentSha256(receipt: CatalogSourceReceipt) {
	requireIssuedReceipt(receipt);
	const part = receipt.bundle?.manifest.parts.find((part) => part.key === "native_view");
	if (receipt.bundle && !part) throw new TypeError("Multipart source has no derived native input");
	return part?.contentSha256 ?? receipt.contentSha256;
}

/** @alpha Profile identities and capture times are inspectable without loading source bodies. */
export function listCatalogSourceProfiles(receipt: CatalogSourceReceipt) {
	requireIssuedReceipt(receipt);
	return receipt.bundle ? receipt.bundle.manifest.parts.map((part) => ({ ...part,
		observedAt: receipt.bundle!.observations.find((observation) => observation.key === part.key)!.observedAt,
		derivedFrom: part.kind === "derived_view" ? receipt.bundle!.manifest.parts.filter((source) => source.kind === "upstream_response").map((source) => ({ key: source.key, contentSha256: source.contentSha256 })) : [],
	})) : [];
}

/** @alpha Read one exact raw or derived profile, independently bounded to 8 MB. Stored URLs are never followed. */
export async function readCatalogSourceProfileBytes(receipt: CatalogSourceReceipt, profileKey?: string): Promise<Uint8Array> {
	requireIssuedReceipt(receipt);
	if (!receipt.bundle) {
		if (profileKey !== undefined && profileKey !== "document") throw new TypeError("Single-document source has no selected multipart profile");
		return readCatalogSourceBytes(receipt);
	}
	const manifestBytes = await readCatalogSourceBytes(receipt);
	const manifest = CatalogSourceManifestSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)));
	if (!isDeepStrictEqual(manifest, receipt.bundle.manifest)) throw new TypeError("Multipart source manifest differs from its persisted receipt");
	const part = manifest.parts.find((part) => part.key === (profileKey ?? manifest.nativePart));
	if (!part) throw new TypeError("Unknown source profile");
	return readSourcePayload(receipt, part.payloadRef, part.contentSha256, part.byteLength);
}

/** @internal Existing single-document providers retain the same read contract. */
export function readCatalogSourceNativeBytes(receipt: CatalogSourceReceipt) { return readCatalogSourceProfileBytes(receipt); }

/** @internal Only issued archive metadata can select a native view's physical evidence path. */
export function withCatalogSourceReceipts<T>(receipts: readonly CatalogSourceReceipt[], work: () => T): T {
	if (receipts.length > 8) throw new RangeError("Source evidence scope exceeds eight receipts");
	const paths = receipts.flatMap((receipt) => {
		requireIssuedReceipt(receipt);
		const snapshot = receiptSnapshots.get(receipt);
		if (receipt.bundle && !snapshot) throw new TypeError("Multipart native input requires a committed receipt");
		return snapshot ? [{ ...snapshot, prefix: receipt.bundle ? "/parts/native_view" as const : "" as const }] : [];
	});
	return withSourceDocumentPaths(paths, work);
}

/** The immutable archive is verified on read; external URLs never become fetch instructions. */
export async function readCatalogSourceBytes(receipt: CatalogSourceReceipt): Promise<Uint8Array> {
	if (!issuedReceipts.has(receipt) || receipt[storedReceipt] !== true)
		throw new TypeError("Source receipt was not produced by the archive writer");
	return readSourcePayload(receipt, receipt.payloadRef, receipt.contentSha256, undefined, receipt.bundle ? SOURCE_MANIFEST_BYTE_LIMIT : SOURCE_DOCUMENT_BYTE_LIMIT);
}

async function readSourcePayload(receipt: CatalogSourceReceipt, payloadRef: string, contentSha256: string, expectedLength?: number, maximumLength = SOURCE_DOCUMENT_BYTE_LIMIT): Promise<Uint8Array> {
	const archive = receiptArchives.get(receipt);
	if (!archive) throw new TypeError("Source receipt has no archive owner");
	const result = await archive.get({ Key: payloadRef });
	if (!result.Body) throw new Error("Archived source payload is missing");
	if (!(result.Body instanceof Readable) && !(result.Body instanceof ReadableStream))
		throw new TypeError("Source archive returned an unsupported byte stream");
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const chunk of result.Body) {
		if (!(chunk instanceof Uint8Array))
			throw new TypeError("Source archive stream did not contain bytes");
		length += chunk.byteLength;
		if (length > maximumLength) throw new RangeError("Archived source payload exceeds its read budget");
		chunks.push(chunk);
	}
	const bytes = Buffer.concat(chunks);
	if (createHash("sha256").update(bytes).digest("hex") !== contentSha256)
		throw new Error("Archived source checksum differs");
	if (expectedLength !== undefined && bytes.byteLength !== expectedLength) throw new TypeError("Source part length differs from its receipt");
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
	const [bundleRow] = await tx.select().from(catalogSourceSnapshotBundle).where(and(eq(catalogSourceSnapshotBundle.sourceRecordId, sourceRecordId), eq(catalogSourceSnapshotBundle.snapshotId, snapshotId))).limit(1);
	let bundle: CatalogSourceMultipartReceipt | undefined;
	if (bundleRow) {
		const rows = await tx.select().from(catalogSourceSnapshotPart).where(and(eq(catalogSourceSnapshotPart.sourceRecordId, sourceRecordId), eq(catalogSourceSnapshotPart.snapshotId, snapshotId))).orderBy(catalogSourceSnapshotPart.position).limit(SOURCE_MULTIPART_PART_LIMIT + 1);
		if (rows.length !== bundleRow.partCount || rows.some((row, index) => row.position !== index) || rows.reduce((sum, row) => sum + row.byteLength, 0) !== bundleRow.totalBytes)
			throw new TypeError("Committed multipart source receipt is incomplete");
		bundle = CatalogSourceMultipartReceiptSchema.parse({ manifest: { format: "rezics.source.multipart-json.1", key, profile: bundleRow.profile,
			derivationContractSha256: bundleRow.derivationContractSha256, consistency: bundleRow.consistency, nativePart: "native_view",
			parts: rows.map(({ key, profile, kind, contentSha256, payloadRef, byteLength, requestUrl }) => ({ key, profile, kind, contentSha256, payloadRef, byteLength, requestUrl })) },
			observations: rows.map((row) => ({ key: row.key, observedAt: row.observedAt.toISOString() })) });
	}
	const receipt: CatalogSourceReceipt = Object.freeze({
		[storedReceipt]: true as const,
		key: Object.freeze(key),
		contentSha256: snapshot.contentSha256,
		contractSha256: snapshot.contractSha256,
		payloadRef: snapshot.payloadRef,
		sourceRevision: snapshot.sourceRevision,
		acquisition: null,
		...(bundle ? { bundle: freezeBundle(bundle) } : {}),
	});
	issuedReceipts.add(receipt);
	receiptArchives.set(receipt, archive);
	receiptSnapshots.set(receipt, { sourceRecordId, snapshotId });
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
		if (receipt.bundle) {
			const bundle = CatalogSourceMultipartReceiptSchema.parse(receipt.bundle), manifest = bundle.manifest;
			await tx.insert(catalogSourceSnapshotBundle).values({ sourceRecordId: record.id, snapshotId: snapshot.id,
				profile: manifest.profile, derivationContractSha256: manifest.derivationContractSha256, consistency: manifest.consistency,
				partCount: manifest.parts.length, totalBytes: manifest.parts.reduce((sum, part) => sum + part.byteLength, 0) });
			await tx.insert(catalogSourceSnapshotPart).values(manifest.parts.map((part, position) => ({ ...part, position,
				sourceRecordId: record.id, snapshotId: snapshot.id, observedAt: new Date(bundle.observations.find((observation) => observation.key === part.key)!.observedAt) })));
		}
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
	const committed = receiptSnapshots.get(receipt);
	if (receipt.bundle && !committed) throw new TypeError("Multipart native input requires reopening its committed receipt");
	if (committed)
		return loadCatalogSourceDocument(
			tx,
			committed.sourceRecordId,
			committed.snapshotId,
			receipt,
			bytes,
		);
	const document = parseSourceDocument(receipt, bytes);
	const observation = await recordCatalogSourceObservation(tx, receipt);
	return sourceDocumentEvidence(receipt, document, observation);
}

function parseSourceDocument(receipt: CatalogSourceReceipt, bytes: Uint8Array): unknown {
	if (
		!issuedReceipts.has(receipt) ||
		bytes.byteLength > SOURCE_DOCUMENT_BYTE_LIMIT ||
		createHash("sha256").update(bytes).digest("hex") !== catalogSourceDocumentSha256(receipt)
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
			const prefix = receipt.bundle ? "/parts/native_view" : "";
			const logicalPath = prefix && (path === prefix || path.startsWith(`${prefix}/`)) ? path.slice(prefix.length) || "/" : path;
			const physicalPath = prefix ? `${prefix}${logicalPath === "/" ? "" : logicalPath}` : logicalPath;
			if (Buffer.byteLength(physicalPath) > 512) throw new TypeError("Source part pointer exceeds its path budget");
			const evidence = Object.freeze({
				source: receipt.key.source,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				path: physicalPath,
				externalId: sourceReferenceAt(document, logicalPath),
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
