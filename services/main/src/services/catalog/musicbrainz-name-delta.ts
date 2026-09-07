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
import type { CatalogNameInput } from "./name-contracts";
import type { MusicBrainzRelease } from "./musicbrainz";
import { musicBrainzAliasName } from "./musicbrainz-names";

type NameChange = {
	kind: "catalog-name";
	owner: "music";
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
	previousSnapshotId: string,
	snapshotId: string,
	previous: MusicBrainzRelease,
	incoming: MusicBrainzRelease,
) {
	if (reference.owner !== "music") throw new TypeError("Expected music owner");
	const table = CatalogNameTables.music.sourceOccurrence;
	const rows = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.sourceRecordId, sourceRecordId),
				eq(table.snapshotId, previousSnapshotId),
				eq(table.namespace, "musicbrainz.name"),
			),
		)
		.limit(129);
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
				const updated = await reviseCatalogName(tx, reference, actor, nameId, nameRevision, {
					...catalogNameRevisionValues(row),
					...input,
				});
				changes.push({
					kind: "catalog-name",
					owner: "music",
					ownerId: reference.id,
					componentKey: nameId,
					beforeRevision: nameRevision,
					afterRevision: updated.revision,
				});
				nameRevision = updated.revision;
			}
		} else {
			const added = await addCatalogName(tx, reference, actor, revision, input);
			revision = added.revision;
			nameId = added.id;
			nameRevision = added.nameRevision;
			localKey = `${snapshotId}:${path}`;
			changes.push({
				kind: "catalog-name",
				owner: "music",
				ownerId: reference.id,
				componentKey: nameId,
				beforeRevision: null,
				afterRevision: nameRevision,
			});
		}
		await bindCatalogNameSourceOccurrence(tx, reference, actor, {
			sourceRecordId,
			snapshotId,
			namespace: "musicbrainz.name",
			localKey,
			nameId,
			nameRevision,
			sourcePath: path,
		});
	};
	if (incoming.title)
		await write(
			"/title",
			{ kind: "source-primary", value: incoming.title, languageTag: null },
			previous.title ? "/title" : undefined,
			previous.title === incoming.title,
		);
	const oldAliases = previous.aliases ?? [];
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
		const removed = await reviseCatalogName(tx, reference, actor, old.nameId, old.nameRevision, {
			...catalogNameRevisionValues(value),
			state: "withdrawn",
		});
		changes.push({
			kind: "catalog-name",
			owner: "music",
			ownerId: reference.id,
			componentKey: old.nameId,
			beforeRevision: old.nameRevision,
			afterRevision: removed.revision,
		});
	}
	return { revision, changes };
}
