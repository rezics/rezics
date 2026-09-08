import { catalogSourcePath } from "./source-document-scope";
import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { MUSIC_SOURCE_COMPONENT_LIMIT, MUSIC_SOURCE_OCCURRENCE_LIMIT } from "../database/schema/catalog-source-limits";
import { musicComponentSourceBaseline } from "../database/schema/catalog-music-source";
import type { DatabaseTransaction } from "../database";
import {
	musicComponentRevision,
	musicComponentSourceOccurrence,
} from "../database/schema/catalog-music";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	musicComponentKey,
	MusicComponentNameSchema,
	MusicComponentSchemas,
	musicComponentOwner,
	type MusicComponentName,
	type MusicComponentMutation,
} from "./music-structure-contracts";
import { mutateMusicSourceComponents, readMusicComponentHeads } from "./music-structure";
import { CatalogRevisionConflict, recordCatalogChange } from "./storage";
import { resolveCatalogSourceChildCorrespondence } from "./source-child-correspondence";

export type MusicSourceComponentBaseline = {
	component: MusicComponentName;
	componentKey: string;
	sourcePath: string;
	historyId: string;
	currentHistoryId: string;
	absent: boolean;
	value: Record<string, unknown>;
};

/** @internal Reconcile native fields against pure source values without overwriting independent edits. */
export function mergeMusicSourceValue(
	component: MusicComponentName,
	previous: unknown,
	incoming: unknown,
	current: unknown,
) {
	const before: Record<string, unknown> = MusicComponentSchemas[component].parse(previous),
		after: Record<string, unknown> = MusicComponentSchemas[component].parse(incoming),
		native: Record<string, unknown> = MusicComponentSchemas[component].parse(current);
	const desired = { ...native };
	for (const [field, value] of Object.entries(after)) {
		if (isDeepStrictEqual(before[field], value)) continue;
		if (
			!isDeepStrictEqual(native[field], before[field]) &&
			!isDeepStrictEqual(native[field], value)
		)
			throw new CatalogRevisionConflict(
				`Music source ${component}.${field} conflicts with an independent native edit`,
			);
		desired[field] = value;
	}
	return MusicComponentSchemas[component].parse(desired);
}

/** @internal Snapshot-local source support and the journal-proved current frontier jointly authorize native deltas. */
export async function prepareMusicSourceProjection(
	tx: DatabaseTransaction,
	context: Parameters<CatalogSourceNativeWriter>[1] & { previousSnapshotId: string },
) {
	const occurrence = musicComponentSourceOccurrence;
	const history = musicComponentRevision;
	const scope = await resolveCatalogSourceChildCorrespondence(tx, context.sourceRecordId);
	const load = async (snapshotId: string) => {
		const baseline = musicComponentSourceBaseline;
		const current = alias(history, "source_current");
		const currentId = sql<string>`case when ${baseline.sourceHistoryId} = ${occurrence.historyId} then ${baseline.currentHistoryId} else ${occurrence.historyId} end`;
		const rows = await tx.select({
			component: occurrence.component, componentKey: occurrence.componentKey,
			sourcePath: occurrence.sourcePath, historyId: occurrence.historyId, value: occurrence.sourceValue,
			currentHistoryId: current.id, currentOperation: current.operation,
		}).from(occurrence)
			.leftJoin(baseline, and(eq(baseline.sourceRecordId, occurrence.sourceRecordId),
				eq(baseline.mappingKey, occurrence.mappingKey), eq(baseline.correspondenceRevision, occurrence.correspondenceRevision),
				eq(baseline.ownerId, occurrence.ownerId), eq(baseline.component, occurrence.component), eq(baseline.componentKey, occurrence.componentKey)))
			.leftJoin(current, and(eq(current.ownerId, occurrence.ownerId), eq(current.id, currentId)))
			.where(and(eq(occurrence.sourceRecordId, context.sourceRecordId), eq(occurrence.mappingKey, scope.mappingKey),
				eq(occurrence.correspondenceRevision, scope.correspondenceRevision), eq(occurrence.snapshotId, snapshotId),
				eq(occurrence.ownerId, context.reference.id)))
			.limit(MUSIC_SOURCE_OCCURRENCE_LIMIT + 1);
		if (rows.length > MUSIC_SOURCE_OCCURRENCE_LIMIT)
			throw new RangeError("Music source support exceeds the staged publication capacity");
		const result = new Map<string, MusicSourceComponentBaseline>();
		for (const row of rows) {
			if (!row.currentHistoryId || !row.currentOperation)
				throw new Error("Music source component is missing its exact native history");
			const component = MusicComponentNameSchema.parse(row.component);
			result.set(`${component}:${row.sourcePath}`, {
				component, componentKey: row.componentKey, sourcePath: row.sourcePath, historyId: row.historyId,
				value: MusicComponentSchemas[component].parse(row.value), currentHistoryId: row.currentHistoryId,
				absent: row.currentOperation === "DELETE",
			});
		}
		return result;
	};
	const before = await load(context.previousSnapshotId);
	const alreadyObserved = await load(context.snapshotId);
	const used = new Set<string>();
	const desiredRows: { component: MusicComponentName; componentKey: string; value: Record<string, unknown>; old?: MusicSourceComponentBaseline }[] = [];
	const pending: {
		component: MusicComponentName;
		componentKey: string;
		path: string;
		historyId?: string;
		sourceValue: Record<string, unknown>;
	}[] = [];
	const oldAt = (component: MusicComponentName, path: string) => {
		const old = before.get(`${component}:${catalogSourcePath(context.sourceRecordId, context.previousSnapshotId, path)}`);
		if (!old) throw new TypeError(`Missing exact native source occurrence: ${component} ${path}`);
		return old;
	};
	const recoverAt = (component: MusicComponentName, path: string) =>
		alreadyObserved.get(`${component}:${catalogSourcePath(context.sourceRecordId, context.snapshotId, path)}`);
	const oldByKey = (component: MusicComponentName, key: string) =>
		[...before.values()].find((row) => row.component === component && row.componentKey === key);
	const put = (
		component: MusicComponentName,
		path: string,
		value: unknown,
		old?: MusicSourceComponentBaseline,
	) => {
		path = catalogSourcePath(context.sourceRecordId, context.snapshotId, path);
		const row: Record<string, unknown> = MusicComponentSchemas[component].parse(value);
		const componentKey = musicComponentKey(component, row);
		if (old) used.add(`${component}:${old.componentKey}`);
		if (old && !old.absent && isDeepStrictEqual(old.value, row))
			pending.push({ component, componentKey, path, historyId: old.historyId, sourceValue: row });
		else {
			desiredRows.push({ component, componentKey, value: row, old });
			pending.push({ component, componentKey, path, sourceValue: row });
		}
	};
	const finish = async () => {
		const removals = [...before.values()]
			.filter((row) => !used.has(`${row.component}:${row.componentKey}`))
			.map((row) => ({
				action: "remove" as const,
				component: row.component,
				componentKey: row.componentKey,
				expectedRevisionId: row.currentHistoryId,
			}));
		const rank = (component: MusicComponentName) =>
			musicComponentOwner(component).column === "id"
				? 9
				: component === "music_medium"
					? 8
					: component === "music_release_presentation"
						? 7
						: component === "music_track_occurrence"
							? 6
							: component === "music_medium_presentation"
								? 5
								: 0;
		removals.sort((left, right) => rank(left.component) - rank(right.component));
		if (removals.length + desiredRows.length > MUSIC_SOURCE_COMPONENT_LIMIT)
			throw new RangeError("Music source delta exceeds the atomic publication capacity");
		const operations: MusicComponentMutation[] = [];
		let nativeBytes = 0;
		const actualByKey = new Map<string, Awaited<ReturnType<typeof readMusicComponentHeads>>[number]>();
		const existing = desiredRows.filter((item) => item.old);
		for (let offset = 0; offset < existing.length; offset += 128)
			for (const head of await readMusicComponentHeads(tx, context.reference.id, existing.slice(offset, offset + 128))) {
				nativeBytes += Buffer.byteLength(JSON.stringify(head.value));
				if (nativeBytes > 32_000_000) throw new RangeError("Music publication native comparison exceeds its byte budget");
				actualByKey.set(`${head.component}:${head.componentKey}`, head);
			}
		for (const desired of desiredRows) {
			const old = desired.old;
			const actual = old ? actualByKey.get(`${desired.component}:${desired.componentKey}`) ?? null : null;
			if (old && !actual) throw new Error("Music source component is missing its current native head");
			if (old && actual?.operation === "DELETE" && actual.id !== old.currentHistoryId)
				throw new CatalogRevisionConflict("Music source component was independently removed");
			operations.push({ action: "put", component: desired.component, componentKey: desired.componentKey,
				expectedRevisionId: actual?.id ?? null,
				value: old && actual && actual.operation !== "DELETE" ? mergeMusicSourceValue(desired.component, old.value, desired.value, actual.value) : desired.value });
		}
		const plan = [...removals, ...operations];
		const result = plan.length
			? await mutateMusicSourceComponents(
					tx,
					context.reference,
					context.actor,
					context.expectedRevision,
					plan,
				)
			: {
					revision: await recordCatalogChange(
						tx,
						context.reference,
						context.actor,
						context.expectedRevision,
						"music.source.observed",
					),
					changes: [],
				};
		const changed = new Map(
			result.changes.map((change) => [
				`${change.component}:${change.componentKey}`,
				change.afterRevisionId,
			]),
		);
		if (pending.length > MUSIC_SOURCE_OCCURRENCE_LIMIT)
			throw new RangeError("Music source support exceeds the staged publication capacity");
		const values = pending.map((row) => {
			const historyId = row.historyId ?? changed.get(`${row.component}:${row.componentKey}`);
			if (!historyId) throw new Error("Projected source occurrence has no exact native history");
			return { ...scope, sourceRecordId: context.sourceRecordId, snapshotId: context.snapshotId,
				ownerId: context.reference.id, component: row.component, componentKey: row.componentKey,
				sourcePath: row.path, historyId, sourceValue: row.sourceValue };
		});
		for (let offset = 0; offset < values.length; offset += 128)
			await tx.insert(occurrence).values(values.slice(offset, offset + 128)).onConflictDoNothing();
		const stored = await tx.select({ component: occurrence.component, path: occurrence.sourcePath,
			componentKey: occurrence.componentKey, value: occurrence.sourceValue }).from(occurrence)
			.where(and(eq(occurrence.sourceRecordId, context.sourceRecordId), eq(occurrence.mappingKey, scope.mappingKey),
				eq(occurrence.correspondenceRevision, scope.correspondenceRevision), eq(occurrence.snapshotId, context.snapshotId),
				eq(occurrence.ownerId, context.reference.id))).limit(MUSIC_SOURCE_OCCURRENCE_LIMIT + 1);
		if (stored.length !== pending.length) throw new Error("Source occurrence count differs from its exact projection");
		const storedByPath = new Map(stored.map((row) => [`${row.component}:${row.path}`, row]));
		for (const row of pending) {
			const existing = storedByPath.get(`${row.component}:${row.path}`);
			if (!existing || existing.componentKey !== row.componentKey ||
				!isDeepStrictEqual(MusicComponentSchemas[row.component].parse(existing.value), row.sourceValue))
				throw new Error("Reapplied source occurrence targets another native identity");
		}
		return result;
	};
	return { oldAt, oldByKey, recoverAt, put, finish };
}
