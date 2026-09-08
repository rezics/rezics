import { catalogSourcePath } from "./source-document-scope";
import { AsyncLocalStorage } from "node:async_hooks";
import { MUSIC_SOURCE_OCCURRENCE_LIMIT } from "../database/schema/catalog-source-limits";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { musicComponentSourceOccurrence } from "../database/schema/catalog-music";
import { readMusicComponentHead, readMusicComponentHeads } from "./music-structure";
import {
	MusicComponentNameSchema,
	MusicComponentSchemas,
	type MusicComponentName,
} from "./music-structure-contracts";
import type { recordCatalogSourceDocument } from "./source-observations";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";

type PendingOccurrence = { sourceRecordId: string; snapshotId: string; ownerId: string; component: MusicComponentName; componentKey: string; sourcePath: string; sourceValue?: unknown };
const pendingOccurrences = new AsyncLocalStorage<{ tx: DatabaseTransaction; rows: PendingOccurrence[] }>();

/** @internal Initial source publication flushes exact component history support in 128-row pages in the same transaction. */
export async function withMusicSourceOccurrenceBatch<T>(tx: DatabaseTransaction, work: () => Promise<T>): Promise<T> {
	const rows: PendingOccurrence[] = [];
	return pendingOccurrences.run({ tx, rows }, async () => {
		const result = await work();
		const groups = new Map<string, PendingOccurrence[]>();
		for (const row of rows) { const key = `${row.sourceRecordId}:${row.snapshotId}:${row.ownerId}`; const group = groups.get(key) ?? []; group.push(row); groups.set(key, group); }
		for (const group of groups.values()) {
			const first = group[0]!;
			const scope = await resolveCatalogSourceChildCorrespondence(tx, first.sourceRecordId);
			for (let offset = 0; offset < group.length; offset += 128) {
				const page = group.slice(offset, offset + 128);
				const heads = new Map((await readMusicComponentHeads(tx, first.ownerId, page)).map((head) => [`${head.component}:${head.componentKey}`, head]));
				const values = page.map((row) => {
					const head = heads.get(`${row.component}:${row.componentKey}`);
					if (!head || head.operation === "DELETE") throw new Error("No live native component history exists for source support");
					return { ...scope, sourceRecordId: row.sourceRecordId, snapshotId: row.snapshotId, ownerId: row.ownerId, component: row.component,
						componentKey: row.componentKey, sourcePath: row.sourcePath, historyId: head.id,
						sourceValue: MusicComponentSchemas[row.component].parse(row.sourceValue === undefined ? head.value : row.sourceValue) };
				});
				await tx.insert(musicComponentSourceOccurrence).values(values);
			}
		}
		return result;
	});
}

/** @internal Records exact support after a component write; duplicate source rows retain distinct paths. */
export async function recordMusicSourceComponent(
	tx: DatabaseTransaction,
	observation: Pick<Awaited<ReturnType<typeof recordCatalogSourceDocument>>, "record" | "snapshot">,
	ownerId: string,
	component: MusicComponentName,
	componentKey: string,
	sourcePath: string,
	sourceValue?: unknown,
) {
	z.string()
		.startsWith("/")
		.refine((value) => Buffer.byteLength(value) <= 512)
		.parse(sourcePath);
	MusicComponentNameSchema.parse(component);
	sourcePath = catalogSourcePath(observation.record.id, observation.snapshot.id, sourcePath);
	const pending = pendingOccurrences.getStore();
	if (pending?.tx === tx) {
		if (pending.rows.length >= MUSIC_SOURCE_OCCURRENCE_LIMIT) throw new RangeError("Initial music source support exceeds its publication capacity");
		pending.rows.push({ sourceRecordId: observation.record.id, snapshotId: observation.snapshot.id, ownerId, component, componentKey, sourcePath, sourceValue });
		return;
	}
	const scope = await resolveCatalogSourceChildCorrespondence(tx, observation.record.id);
	const head = await readMusicComponentHead(tx, ownerId, component, componentKey);
	if (!head || head.operation === "DELETE")
		throw new Error("No live native component history exists for source support");
	await tx.insert(musicComponentSourceOccurrence).values({
		...scope,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		ownerId,
		component,
		componentKey,
		sourcePath,
		historyId: head.id,
		sourceValue: MusicComponentSchemas[component].parse(
			sourceValue === undefined ? head.value : sourceValue,
		),
	});
}

/** @internal Source/owner-scoped keyset page never loads the owner's full lifetime history. */
export async function listMusicSourceComponents(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	snapshotId: string,
	ownerId: string,
	component: MusicComponentName,
	afterPath?: string,
) {
	const table = musicComponentSourceOccurrence;
	const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
	const rows = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.sourceRecordId, sourceRecordId),
				eq(table.mappingKey, scope.mappingKey),
				eq(table.correspondenceRevision, scope.correspondenceRevision),
				eq(table.snapshotId, snapshotId),
				eq(table.ownerId, ownerId),
				eq(table.component, component),
				afterPath ? gt(table.sourcePath, afterPath) : undefined,
			),
		)
		.orderBy(table.sourcePath)
		.limit(128);
	return rows.map((row) => ({
		...row,
		sourceValue: MusicComponentSchemas[component].parse(row.sourceValue),
	}));
}
