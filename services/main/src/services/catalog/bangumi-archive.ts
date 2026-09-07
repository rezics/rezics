import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { openPromise } from "yauzl";
import { z } from "zod";
import {
	BangumiArchiveSubjectSchema,
	BangumiArchivePersonSchema,
	BangumiArchiveCharacterSchema,
	BangumiArchiveEpisodeSchema,
	BangumiArchiveRelationSchema,
	bangumiRelationKey,
} from "./bangumi-records";

/** Source families are an explicit Archive contract; an unknown entry requires a new review. @internal */
export const BangumiArchiveFamilies = [
	"subject",
	"person",
	"character",
	"episode",
	"subject-relations",
	"subject-persons",
	"subject-characters",
	"person-characters",
	"person-relations",
] as const;
export type BangumiArchiveFamily = (typeof BangumiArchiveFamilies)[number];
const familySchema = z.enum(BangumiArchiveFamilies);

/** A bounded record iterator preserves exact line bytes and applies consumer backpressure. @internal */
export async function* catalogJsonLines(stream: AsyncIterable<Uint8Array>, signal?: AbortSignal) {
	let pending = Buffer.alloc(0);
	let line = 0;
	for await (const chunk of stream) {
		signal?.throwIfAborted();
		if (!(chunk instanceof Uint8Array)) throw new TypeError("Archive stream must contain bytes");
		let start = 0;
		for (let end = 0; end < chunk.length; end++) {
			if (chunk[end] !== 10) continue;
			if (pending.byteLength + end - start > 8_000_000)
				throw new RangeError("Source JSON line exceeds the admitted record budget");
			let bytes = pending.length
				? Buffer.concat([pending, chunk.subarray(start, end)])
				: Buffer.from(chunk.subarray(start, end));
			if (bytes.at(-1) === 13) bytes = bytes.subarray(0, -1);
			pending = Buffer.alloc(0);
			start = end + 1;
			line++;
			if (!bytes.length) throw new TypeError(`Archive has an empty JSON record at line ${line}`);
			yield { line, bytes };
		}
		if (start < chunk.length) {
			if (pending.byteLength + chunk.length - start > 8_000_000)
				throw new RangeError("Source JSON line exceeds the admitted record budget");
			pending = Buffer.concat([pending, chunk.subarray(start)]);
		}
	}
	if (pending.length) {
		if (pending.at(-1) === 13) pending = pending.subarray(0, -1);
		yield { line: line + 1, bytes: pending };
	}
}

/** Shape validation is separate from native semantic qualification. @internal */
export function parseBangumiArchiveRecord(family: BangumiArchiveFamily, bytes: Uint8Array) {
	const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	if (family === "subject") {
		const record = BangumiArchiveSubjectSchema.parse(raw);
		return { family, externalId: String(record.id), record } as const;
	}
	if (family === "person") {
		const record = BangumiArchivePersonSchema.parse(raw);
		return { family, externalId: String(record.id), record } as const;
	}
	if (family === "character") {
		const record = BangumiArchiveCharacterSchema.parse(raw);
		return { family, externalId: String(record.id), record } as const;
	}
	if (family === "episode") {
		const record = BangumiArchiveEpisodeSchema.parse(raw);
		return { family, externalId: String(record.id), record } as const;
	}
	const object = z.record(z.string(), z.unknown()).parse(raw);
	const record = BangumiArchiveRelationSchema.parse({ ...object, kind: family });
	return { family, externalId: bangumiRelationKey(record), record } as const;
}

/**
 * Reads a verified local public Archive with bounded memory and no corpus materialization.
 * @alpha
 * @remarks The caller persists its processing frontier after each bounded transaction.
 * ZIP resume within one compressed family replays its compressed prefix; bulk staging
 * should split records into independently routed immutable batches for later workers.
 */
export async function* readBangumiArchive(
	path: string,
	input: {
		sha256: string;
		family?: BangumiArchiveFamily;
		afterLine?: number;
		signal?: AbortSignal;
	},
) {
	z.string()
		.regex(/^[a-f0-9]{64}$/u)
		.parse(input.sha256);
	if (input.family) familySchema.parse(input.family);
	if (
		input.afterLine !== undefined &&
		(!input.family || !Number.isSafeInteger(input.afterLine) || input.afterLine < 0)
	)
		throw new TypeError(
			"An Archive line frontier requires an explicit family and nonnegative integer",
		);
	const hash = createHash("sha256");
	for await (const bytes of createReadStream(path, { signal: input.signal })) hash.update(bytes);
	if (hash.digest("hex") !== input.sha256)
		throw new Error("Archive digest differs from its pinned manifest");
	const archive = await openPromise(path, {
		lazyEntries: true,
		autoClose: false,
		strictFileNames: true,
		validateEntrySizes: true,
	});
	const seen = new Set<string>();
	try {
		if (archive.entryCount !== BangumiArchiveFamilies.length)
			throw new TypeError("Archive entry families differ from the reviewed contract");
		for await (const entry of archive.eachEntry()) {
			input.signal?.throwIfAborted();
			const family = familySchema.parse(entry.fileName.replace(/\.jsonlines$/u, ""));
			if (entry.fileName !== `${family}.jsonlines` || seen.has(family))
				throw new TypeError("Archive contains a duplicate or unexpected family path");
			seen.add(family);
			if (input.family && family !== input.family) continue;
			const stream = await archive.openReadStreamPromise(entry);
			for await (const row of catalogJsonLines(stream, input.signal)) {
				if (row.line <= (input.afterLine ?? 0)) continue;
				yield { family, ...row };
			}
		}
		if (seen.size !== BangumiArchiveFamilies.length)
			throw new TypeError("Archive is missing a required family");
	} finally {
		archive.close();
	}
}
