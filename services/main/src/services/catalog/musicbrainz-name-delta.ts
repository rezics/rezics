import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
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
import type { CatalogNameInput } from "./name-contracts";
import type { MusicBrainzRelease } from "./musicbrainz";
import { musicBrainzAliasName } from "./musicbrainz-names";

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
	sourceRecordId: string,
	mappingKey: string,
	previousSnapshotId: string | null,
	snapshotId: string,
	previous:
		| (Pick<MusicBrainzRelease, "title" | "aliases"> & { "sort-name"?: string | null })
		| null,
	incoming: Pick<MusicBrainzRelease, "title" | "aliases"> & { "sort-name"?: string | null },
	primaryPath = "/title",
) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
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
						eq(table.correspondenceRevision, scope.correspondenceRevision),
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
	const used = new Set<string>();
	const changes: NameChange[] = [];
	const write = async (
		path: string,
		input: CatalogNameInput,
		previousPath?: string,
		unchanged = false,
	) => {
		const old = previousPath ? byPath.get(previousPath) : undefined;
		if (previousPath && !old)
			throw new TypeError(`Missing exact MusicBrainz named-form occurrence: ${previousPath}`);
		let nameId: string, nameRevision: number, localKey: string;
		if (old) {
			used.add(old.sourcePath);
			nameId = old.nameId;
			nameRevision = old.nameRevision;
			localKey = old.localKey;
			if (!unchanged) {
				const row = await requireCatalogNameRevision(tx, reference, actor, nameId, nameRevision);
				const currentRevision = await resolveCatalogSourceOwnedBaseline(
					tx,
					{ sourceRecordId, mappingKey },
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
			previous?.title ? primaryPath : undefined,
			previous?.title === incoming.title,
		);
	if (incoming["sort-name"])
		await write(
			"/sort-name",
			{ kind: "sort", value: incoming["sort-name"], languageTag: null },
			previous?.["sort-name"] ? "/sort-name" : undefined,
			previous?.["sort-name"] === incoming["sort-name"],
		);
	const oldAliases = previous?.aliases ?? [];
	const aliasesUsed = new Set<number>();
	for (const [index, alias] of (incoming.aliases ?? []).entries()) {
		let oldIndex = oldAliases.findIndex(
			(candidate, position) => !aliasesUsed.has(position) && isDeepStrictEqual(candidate, alias),
		);
		if (oldIndex === -1 && oldAliases[index] && !aliasesUsed.has(index)) oldIndex = index;
		if (oldIndex !== -1) aliasesUsed.add(oldIndex);
		await write(
			`/aliases/${index}`,
			musicBrainzAliasName(alias),
			oldIndex === -1 ? undefined : `/aliases/${oldIndex}`,
			oldIndex !== -1 && isDeepStrictEqual(oldAliases[oldIndex], alias),
		);
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
			{ sourceRecordId, mappingKey },
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
