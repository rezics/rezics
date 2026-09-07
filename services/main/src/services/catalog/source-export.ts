import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { BangumiSubjectSchema } from "./bangumi";
import { OpenLibraryWorkSchema, OpenLibraryEditionSchema } from "./openlibrary";
import { VndbVnSchema } from "./vndb";
import { softwareParticipationSourceOccurrence } from "../database/schema/catalog-software";
import { MusicBrainzReleaseSchema } from "./musicbrainz";
import { loadCatalogIdentity } from "./storage";
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

/** Reconstruct from native typed rows, not from the archived payload. */
async function readNativeSourceFields(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	sourceRecordId: string,
	snapshotId: string,
	maximumFields: number,
) {
	await loadCatalogIdentity(tx, reference, actor, false);
	z.uuid().parse(sourceRecordId);
	z.uuid().parse(snapshotId);
	const tables = CatalogFactTables[reference.owner];
	const fields = await tx
		.select({ factId: tables.support.factId, path: tables.support.sourcePath })
		.from(tables.support)
		.innerJoin(
			tables.fact,
			and(
				eq(tables.fact.ownerId, tables.support.ownerId),
				eq(tables.fact.id, tables.support.factId),
			),
		)
		.where(
			and(
				eq(tables.support.ownerId, reference.id),
				eq(tables.support.sourceRecordId, sourceRecordId),
				eq(tables.support.snapshotId, snapshotId),
				isNotNull(tables.support.factId),
				isNotNull(tables.fact.sealedAt),
				eq(tables.fact.state, "active"),
			),
		)
		.orderBy(tables.support.id)
		.limit(maximumFields + 1);
	if (fields.length > maximumFields) throw new Error("Source field support set is ambiguous");
	const byFact = new Map<string, { path: string; nodes: CatalogValueNode[] }>();
	const paths = new Set<string>();
	for (const field of fields) {
		if (!field.factId || paths.has(field.path))
			throw new Error("Source field support set is ambiguous");
		paths.add(field.path);
		byFact.set(field.factId, { path: field.path, nodes: [] });
	}
	if (!byFact.size) throw new Error("Source snapshot has no adopted native fields");
	let cursor: { factId: string; position: number } | undefined;
	let nodeCount = 0;
	let bytes = 0;
	for (;;) {
		const node = tables.valueNode;
		const page = await tx
			.select()
			.from(node)
			.where(
				and(
					eq(node.ownerId, reference.id),
					inArray(node.factId, [...byFact.keys()]),
					cursor
						? or(
								gt(node.factId, cursor.factId),
								and(eq(node.factId, cursor.factId), gt(node.position, cursor.position)),
							)
						: undefined,
				),
			)
			.orderBy(node.factId, node.position)
			.limit(512);
		for (const value of page) {
			nodeCount++;
			bytes +=
				Buffer.byteLength(value.textValue ?? "", "utf8") +
				Buffer.byteLength(value.memberKey ?? "", "utf8") +
				64;
			if (nodeCount > 200_000 || bytes > 32_000_000)
				throw new RangeError("Source native export exceeds its admitted record budget");
			const field = byFact.get(value.factId);
			if (!field) throw new Error("Unexpected source fact page");
			field.nodes.push(value);
		}
		const last = page.at(-1);
		if (page.length < 512 || !last) break;
		cursor = { factId: last.factId, position: last.position };
	}
	const output: Record<string, JsonValue> = {};
	for (const field of byFact.values())
		Object.defineProperty(output, field.path.slice(1).replaceAll("~1", "/").replaceAll("~0", "~"), {
			value: sourceValueFromNodes(field.nodes),
			enumerable: true,
		});
	return output;
}

export async function exportBangumiSubject(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	sourceRecordId: string,
	snapshotId: string,
) {
	return BangumiSubjectSchema.parse(
		await readNativeSourceFields(
			tx,
			reference,
			actor,
			sourceRecordId,
			snapshotId,
			Object.keys(BangumiSubjectSchema.shape).length,
		),
	);
}

export async function exportOpenLibraryRecord(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	sourceRecordId: string,
	snapshotId: string,
	objectType: "work" | "edition",
) {
	const fields = await readNativeSourceFields(
		tx,
		reference,
		actor,
		sourceRecordId,
		snapshotId,
		512,
	);
	const data: Record<string, unknown> = {};
	for (const [field, envelope] of Object.entries(fields)) {
		const value = z.strictObject({ value: z.json() }).parse(envelope).value;
		Object.defineProperty(data, field, { value, enumerable: true });
	}
	return objectType === "work"
		? OpenLibraryWorkSchema.parse(data)
		: OpenLibraryEditionSchema.parse(data);
}

export async function exportVndbVn(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	sourceRecordId: string,
	snapshotId: string,
) {
	const fields = await readNativeSourceFields(
		tx,
		reference,
		actor,
		sourceRecordId,
		snapshotId,
		512,
	);
	const data: Record<string, unknown> = {};
	for (const [field, envelope] of Object.entries(fields))
		Object.defineProperty(data, field, {
			value: z.strictObject({ value: z.json() }).parse(envelope).value,
			enumerable: true,
		});
	const record = VndbVnSchema.parse(data);
	const mapping = softwareParticipationSourceOccurrence;
	const occurrences = await tx
		.select()
		.from(mapping)
		.where(
			and(
				eq(mapping.sourceRecordId, sourceRecordId),
				eq(mapping.snapshotId, snapshotId),
				eq(mapping.namespace, "editions"),
				eq(mapping.contentId, reference.id),
			),
		)
		.limit(129);
	if (reference.owner !== "software" || occurrences.length !== (record.editions ?? []).length)
		throw new Error("VNDB participation observation set differs from the selected snapshot");
	const byLocalKey = new Map(occurrences.map((row) => [row.localKey, row]));
	if (record.editions)
		record.editions = record.editions.map((edition, position) => {
			const occurrence = byLocalKey.get(String(edition.eid));
			if (!occurrence || occurrence.sourcePointer !== `/editions/${position}`)
				throw new Error("VNDB participation occurrence does not match its snapshot position");
			return {
				...edition,
				name: occurrence.sourceLabel,
				lang: occurrence.sourceLanguage,
				official: occurrence.sourceClaimedOfficial,
			};
		});
	return record;
}

export async function exportMusicBrainzRelease(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	sourceRecordId: string,
	snapshotId: string,
) {
	const fields = await readNativeSourceFields(
		tx,
		reference,
		actor,
		sourceRecordId,
		snapshotId,
		512,
	);
	const data: Record<string, unknown> = {};
	for (const [field, envelope] of Object.entries(fields))
		Object.defineProperty(data, field, {
			value: z.strictObject({ value: z.json() }).parse(envelope).value,
			enumerable: true,
		});
	return MusicBrainzReleaseSchema.parse(data);
}
