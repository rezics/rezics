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
import type { MusicBrainzRelease } from "./musicbrainz";
import { musicBrainzAliasName } from "./musicbrainz-names";
import { correlateMusicBrainzNativeAliases } from "./musicbrainz-name-plan";

type NameChange = {
	kind: "catalog-name";
	owner: CatalogReference["owner"];
	ownerId: string;
	componentKey: string;
	beforeRevision: number | null;
	afterRevision: number;
};

/** @internal Exact named-form source occurrences survive alias reorder and protect independent name edits. */
export async function applyMusicBrainzNameDelta(
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
	incoming: Pick<MusicBrainzRelease, "title" | "aliases"> & { "sort-name"?: string | null },
	primaryPath = "/title",
) {
	const { sourceRecordId, mappingKey, previousSnapshotId, snapshotId } = source;
	const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
	const previousEpoch = source.previousCorrespondenceRevision ?? scope.correspondenceRevision;
	const table = CatalogNameTables[reference.owner].sourceOccurrence;
	const rows = previousSnapshotId
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
						eq(table.namespace, "musicbrainz.name"),
					),
				)
				.limit(129)
		: [];
	if (rows.length > 128 || (incoming.aliases?.length ?? 0) > 128)
		throw new RangeError("Music name delta requires staged application");
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
		const old = previousPath ? byPath.get(previousPath) : undefined;
		if (previousPath && !old)
			throw new TypeError(`Missing exact MusicBrainz named-form occurrence: ${previousPath}`);
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
						eq(table.namespace, "musicbrainz.name"),
						eq(table.sourcePath, path),
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
					eq(table.namespace, "musicbrainz.name"),
					eq(table.localKey, localKey),
				),
			)
			.limit(1);
		if (existing && (existing.nameId !== nameId || existing.sourcePath !== path))
			throw new Error("Reapplied source name targets another native identity");
		await bindCatalogNameSourceOccurrence(tx, reference, actor, {
			sourceRecordId,
			snapshotId,
			namespace: "musicbrainz.name",
			localKey,
			nameId,
			nameRevision: existing?.nameRevision ?? nameRevision,
			sourcePath: path,
		});
	};
	if (incoming.title)
		await write(
			primaryPath,
			{ kind: "source-primary", value: incoming.title, languageTag: null },
			byPath.has(primaryPath) ? primaryPath : undefined,
		);
	if (incoming["sort-name"])
		await write(
			"/sort-name",
			{ kind: "sort", value: incoming["sort-name"], languageTag: null },
			byPath.has("/sort-name") ? "/sort-name" : undefined,
		);
	const oldAliases = rows.filter((row) => row.sourcePath.startsWith("/aliases/"));
	const aliases = (incoming.aliases ?? []).map(musicBrainzAliasName);
	const correspondence = correlateMusicBrainzNativeAliases(
		oldAliases.map((row) => ({ path: row.sourcePath, value: originalValues(row) })),
		aliases,
	);
	for (const [index, input] of aliases.entries()) {
		await write(`/aliases/${index}`, input, correspondence[index]);
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
