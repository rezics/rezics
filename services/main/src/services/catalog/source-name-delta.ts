import { catalogSourcePath, catalogSourceLogicalPath } from "./source-document-scope";
import { z } from "zod";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { isDeepStrictEqual } from "node:util";
import { and, eq, or } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import type { CatalogReference } from "./contracts";
import {
	addCatalogName,
	bindCatalogNameSourceOccurrence,
	requireCatalogNameRevision,
	reviseCatalogName,
} from "./names";
import { catalogNameRevisionValues } from "./source-owned-compensation";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";
import { CatalogNameValuesSchema, type CatalogNameInput } from "./name-contracts";

/** A stable source slot or an unordered alias with only exact native-value correspondence. @internal */
export type CatalogSourceNamePlan = {
	path: string;
	value: CatalogNameInput;
	match: "path" | "value";
};

type NameChange = {
	kind: "catalog-name";
	owner: CatalogReference["owner"];
	ownerId: string;
	componentKey: string;
	beforeRevision: number | null;
	afterRevision: number;
};

/** @internal Exact named-form source occurrences survive alias reorder and protect independent name edits. */
export async function applyCatalogSourceNameDelta(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	source: {
		sourceRecordId: string;
		mappingKey: string;
		previousSnapshotId: string | null;
		snapshotId: string;
		previousCorrespondenceRevision?: number;
	},
	input: { namespace: string; names: readonly CatalogSourceNamePlan[] },
) {
	const { sourceRecordId, mappingKey, previousSnapshotId, snapshotId } = source;
	const namespace = z.string().min(1).max(128).parse(input.namespace);
	const incoming = [...input.names];
	if (new Set(incoming.map((item) => item.path)).size !== incoming.length)
		throw new TypeError("Duplicate source name paths");
	for (const item of incoming) {
		z.string().startsWith("/").max(512).parse(item.path);
		CatalogNameValuesSchema.parse(item.value);
	}
	const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
	const previousEpoch = source.previousCorrespondenceRevision ?? scope.correspondenceRevision;
	const table = CatalogNameTables[reference.owner].sourceOccurrence;
	const storedRows = previousSnapshotId
		? await tx
				.select()
				.from(table)
				.where(
					and(
						eq(table.ownerId, reference.id),
						eq(table.sourceRecordId, sourceRecordId),
						eq(table.mappingKey, scope.mappingKey),
						eq(table.correspondenceRevision, previousEpoch),
						eq(table.ownerId, reference.id),
						eq(table.snapshotId, previousSnapshotId),
						eq(table.namespace, namespace),
					),
				)
				.limit(129)
		: [];
	const rows = storedRows.map((row) => ({ ...row, sourcePath: catalogSourceLogicalPath(sourceRecordId, previousSnapshotId!, row.sourcePath) }));
	if (rows.length > 128 || incoming.length > 128)
		throw new RangeError("Name delta requires staged application");
	const byPath = new Map(rows.map((row) => [row.sourcePath, row]));
	if (byPath.size !== rows.length)
		throw new TypeError("Native source name paths require explicit correspondence");
	const history = CatalogNameTables[reference.owner].nameRevision;
	const nativeNames = rows.length
		? await tx
				.select()
				.from(history)
				.where(
					and(
						eq(history.ownerId, reference.id),
						or(
							...rows.map((row) =>
								and(eq(history.id, row.nameId), eq(history.revision, row.nameRevision)),
							),
						),
					),
				)
				.limit(rows.length)
		: [];
	const originals = new Map(nativeNames.map((row) => [`${row.id}:${row.revision}`, row]));
	const canonical = (input: CatalogNameInput) => CatalogNameValuesSchema.parse(input);
	const originalValues = (row: (typeof rows)[number]) => {
		const original = originals.get(`${row.nameId}:${row.nameRevision}`);
		if (!original)
			throw new TypeError("Source name interpretation is missing its exact native history");
		return catalogNameRevisionValues(original);
	};
	const used = new Set<string>();
	const changes: NameChange[] = [];
	const write = async (path: string, input: CatalogNameInput, previousPath?: string) => {
		const sourcePath = catalogSourcePath(sourceRecordId, snapshotId, path);
		const old = previousPath ? byPath.get(previousPath) : undefined;
		if (previousPath && !old)
			throw new TypeError(`Missing exact named-form occurrence: ${previousPath}`);
		let nameId: string, nameRevision: number, localKey: string;
		if (old) {
			used.add(old.sourcePath);
			nameId = old.nameId;
			nameRevision = old.nameRevision;
			localKey = old.localKey;
			const unchanged = isDeepStrictEqual(canonical(originalValues(old)), canonical(input));
			if (!unchanged) {
				const row = await requireCatalogNameRevision(tx, reference, actor, nameId, nameRevision);
				const currentRevision = await resolveCatalogSourceOwnedBaseline(
					tx,
					{ sourceRecordId, mappingKey, correspondenceRevision: previousEpoch },
					{
						kind: "catalog-name",
						owner: reference.owner,
						ownerId: reference.id,
						componentKey: nameId,
					},
					nameRevision,
				);
				const updated = await reviseCatalogName(tx, reference, actor, nameId, currentRevision, {
					...catalogNameRevisionValues(row),
					...input,
				});
				changes.push({
					kind: "catalog-name",
					owner: reference.owner,
					ownerId: reference.id,
					componentKey: nameId,
					beforeRevision: currentRevision,
					afterRevision: updated.revision,
				});
				nameRevision = updated.revision;
			} else if (previousEpoch !== scope.correspondenceRevision) {
				const frontier = await resolveCatalogSourceOwnedBaseline(
					tx,
					{ sourceRecordId, mappingKey, correspondenceRevision: previousEpoch },
					{
						kind: "catalog-name",
						owner: reference.owner,
						ownerId: reference.id,
						componentKey: nameId,
					},
					nameRevision,
				);
				const currentSource = await requireCatalogNameRevision(
					tx,
					reference,
					actor,
					nameId,
					frontier,
				);
				if (
					!isDeepStrictEqual(canonical(catalogNameRevisionValues(currentSource)), canonical(input))
				)
					throw new TypeError("Prior source name frontier has another canonical interpretation");
				nameRevision = frontier;
			}
		} else {
			const recovered = await tx
				.select()
				.from(table)
				.where(
					and(
						eq(table.sourceRecordId, sourceRecordId),
						eq(table.mappingKey, scope.mappingKey),
						eq(table.correspondenceRevision, scope.correspondenceRevision),
						eq(table.ownerId, reference.id),
						eq(table.snapshotId, snapshotId),
						eq(table.ownerId, reference.id),
						eq(table.namespace, namespace),
						eq(table.sourcePath, sourcePath),
					),
				)
				.limit(2);
			if (recovered.length > 1) throw new Error("Source name occurrence is ambiguous");
			if (recovered[0]) {
				const target = recovered[0];
				const original = await requireCatalogNameRevision(
					tx,
					reference,
					actor,
					target.nameId,
					target.nameRevision,
				);
				const currentRevision = await resolveCatalogSourceOwnedBaseline(
					tx,
					{ sourceRecordId, mappingKey },
					{
						kind: "catalog-name",
						owner: reference.owner,
						ownerId: reference.id,
						componentKey: target.nameId,
					},
					target.nameRevision,
				);
				const restored = await reviseCatalogName(
					tx,
					reference,
					actor,
					target.nameId,
					currentRevision,
					{ ...catalogNameRevisionValues(original), ...input, state: "active" },
				);
				nameId = target.nameId;
				nameRevision = restored.revision;
				localKey = target.localKey;
				changes.push({
					kind: "catalog-name",
					owner: reference.owner,
					ownerId: reference.id,
					componentKey: nameId,
					beforeRevision: currentRevision,
					afterRevision: nameRevision,
				});
			} else {
				const added = await addCatalogName(tx, reference, actor, revision, input);
				revision = added.revision;
				nameId = added.id;
				nameRevision = added.nameRevision;
				localKey = `${snapshotId}:${path}`;
				changes.push({
					kind: "catalog-name",
					owner: reference.owner,
					ownerId: reference.id,
					componentKey: nameId,
					beforeRevision: null,
					afterRevision: nameRevision,
				});
			}
		}
		const [existing] = await tx
			.select()
			.from(table)
			.where(
				and(
					eq(table.sourceRecordId, sourceRecordId),
					eq(table.mappingKey, scope.mappingKey),
					eq(table.correspondenceRevision, scope.correspondenceRevision),
					eq(table.ownerId, reference.id),
					eq(table.snapshotId, snapshotId),
					eq(table.namespace, namespace),
					eq(table.localKey, localKey),
				),
			)
			.limit(1);
		if (existing && (existing.nameId !== nameId || existing.sourcePath !== sourcePath))
			throw new Error("Reapplied source name targets another native identity");
		await bindCatalogNameSourceOccurrence(tx, reference, actor, {
			sourceRecordId,
			snapshotId,
			namespace: namespace,
			localKey,
			nameId,
			nameRevision: existing?.nameRevision ?? nameRevision,
			sourcePath,
		});
	};
	const reserved = new Set(
		incoming.filter((item) => item.match === "path").map((item) => item.path),
	);
	const candidates = new Map<string, string[]>();
	for (const old of [...rows].sort((left, right) =>
		left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0,
	)) {
		if (reserved.has(old.sourcePath)) continue;
		const signature = JSON.stringify(canonical(originalValues(old)));
		const bucket = candidates.get(signature) ?? [];
		bucket.push(old.sourcePath);
		candidates.set(signature, bucket);
	}
	for (const item of incoming) {
		const previousPath =
			item.match === "path"
				? byPath.has(item.path)
					? item.path
					: undefined
				: candidates.get(JSON.stringify(canonical(item.value)))?.shift();
		await write(item.path, item.value, previousPath);
	}
	for (const old of rows) {
		if (used.has(old.sourcePath)) continue;
		const value = await requireCatalogNameRevision(
			tx,
			reference,
			actor,
			old.nameId,
			old.nameRevision,
		);
		const currentRevision = await resolveCatalogSourceOwnedBaseline(
			tx,
			{ sourceRecordId, mappingKey, correspondenceRevision: previousEpoch },
			{
				kind: "catalog-name",
				owner: reference.owner,
				ownerId: reference.id,
				componentKey: old.nameId,
			},
			old.nameRevision,
		);
		const removed = await reviseCatalogName(tx, reference, actor, old.nameId, currentRevision, {
			...catalogNameRevisionValues(value),
			state: "withdrawn",
		});
		changes.push({
			kind: "catalog-name",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: old.nameId,
			beforeRevision: currentRevision,
			afterRevision: removed.revision,
		});
	}
	return { revision, changes };
}
