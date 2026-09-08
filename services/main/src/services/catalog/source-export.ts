import { z } from "zod";
import { BangumiSubjectSchema } from "./bangumi";
import { OpenLibraryWorkSchema, OpenLibraryEditionSchema } from "./openlibrary";
import { VndbVnSchema } from "./vndb";
import { MusicBrainzReleaseSchema } from "./musicbrainz";
import { readCatalogSourceProfileBytes, type CatalogSourceReceipt } from "./source-observations";
import type { CatalogValueNode } from "./value-nodes";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Materialization is for admitted source records, never an unbounded owner export. */
export function sourceValueFromNodes(nodes: readonly CatalogValueNode[]): JsonValue {
	if (!nodes.length || nodes.length > 200_000)
		throw new RangeError("Source value node count is outside its admitted budget");
	const values = new Map<number, JsonValue>();
	let root: JsonValue | undefined;
	for (const node of nodes) {
		if (values.has(node.position)) throw new TypeError("Duplicate source value position");
		let value: JsonValue;
		switch (node.kind) {
			case "null":
				value = null;
				break;
			case "string":
				value = z.string().parse(node.textValue);
				break;
			case "number":
				value = z
					.number()
					.finite()
					.parse(Number(z.string().parse(node.numberValue)));
				break;
			case "boolean":
				value = z.boolean().parse(node.booleanValue);
				break;
			case "array":
				value = [];
				break;
			case "object":
				value = {};
				break;
		}
		values.set(node.position, value);
		if (node.position === 0) {
			root = value;
			continue;
		}
		const parent = node.parentPosition === null ? undefined : values.get(node.parentPosition);
		if (Array.isArray(parent) && node.parentKind === "array") parent.push(value);
		else if (
			parent !== null &&
			typeof parent === "object" &&
			!Array.isArray(parent) &&
			node.parentKind === "object" &&
			node.memberKey !== null
		) {
			if (Object.hasOwn(parent, node.memberKey))
				throw new TypeError("Duplicate object keys require the ordered-node export contract");
			Object.defineProperty(parent, node.memberKey, {
				value,
				enumerable: true,
				writable: true,
				configurable: true,
			});
		} else throw new TypeError("Source node parent was not a preceding matching container");
	}
	if (root === undefined) throw new TypeError("Source value has no root");
	return root;
}

/** Read exact archived source evidence outside a database transaction; this is not a native catalog export. */
async function readSourceArchive(
	receipt: CatalogSourceReceipt,
	source: string,
	objectType: string,
	profileKey?: string,
) {
	const bytes = await readCatalogSourceProfileBytes(receipt, profileKey);
	if (receipt.key.source !== source || receipt.key.objectType !== objectType)
		throw new TypeError("Archive receipt has another source object contract");
	const document: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	return document;
}

/** Immutable source evidence; canonical edits are read through the native domain commands. @internal */
export async function exportBangumiSubject(receipt: CatalogSourceReceipt) {
	return BangumiSubjectSchema.parse(await readSourceArchive(receipt, "bangumi", "subject"));
}

/** Immutable source evidence; catalog fields are not reconstructed from source-shaped fact wrappers. @internal */
export async function exportOpenLibraryRecord(
	receipt: CatalogSourceReceipt,
	objectType: "work" | "edition",
) {
	const document = await readSourceArchive(receipt, "openlibrary", objectType);
	return objectType === "work"
		? OpenLibraryWorkSchema.parse(document)
		: OpenLibraryEditionSchema.parse(document);
}

/** Exact source participation claims remain unchanged when a native context is edited. @internal */
export async function exportVndbVn(receipt: CatalogSourceReceipt) {
	return VndbVnSchema.parse(await readSourceArchive(receipt, "vndb", "vn"));
}

/** Physical release and recording exports use native music readers; this exports source evidence. @internal */
export async function exportMusicBrainzRelease(receipt: CatalogSourceReceipt, profileKey?: string) {
	const document = await readSourceArchive(receipt, "musicbrainz", "release", profileKey);
	// Metadata-only raw profiles deliberately omit media; returning a fabricated merged response would lose provenance.
	return profileKey === "metadata" ? MusicBrainzReleaseSchema.omit({ media: true }).parse(document) : MusicBrainzReleaseSchema.parse(document);
}
