import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { musicComponentSourceOccurrence } from "../database/schema/catalog-music";
import { readMusicComponentHead } from "./music-structure";
import {
	MusicComponentNameSchema,
	MusicComponentSchemas,
	type MusicComponentName,
} from "./music-structure-contracts";
import type { recordCatalogSourceDocument } from "./source-observations";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";

/** @internal Records exact support after a component write; duplicate source rows retain distinct paths. */
export async function recordMusicSourceComponent(
	tx: DatabaseTransaction,
	observation: Pick<Awaited<ReturnType<typeof recordCatalogSourceDocument>>, "record" | "snapshot">,
	ownerId: string,
	component: MusicComponentName,
	componentKey: string,
	sourcePath: string,
) {
	z.string()
		.startsWith("/")
		.refine((value) => Buffer.byteLength(value) <= 512)
		.parse(sourcePath);
	MusicComponentNameSchema.parse(component);
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
		sourceValue: MusicComponentSchemas[component].parse(head.value),
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
