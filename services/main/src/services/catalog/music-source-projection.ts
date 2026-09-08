import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	musicComponentRevision,
	musicComponentSourceOccurrence,
} from "../database/schema/catalog-music";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import { resolveMusicSourceComponentBaseline } from "./music-source-baselines";
import {
	musicComponentKey,
	MusicComponentNameSchema,
	MusicComponentSchemas,
	musicComponentOwner,
	type MusicComponentName,
	type MusicComponentMutation,
} from "./music-structure-contracts";
import { mutateMusicComponents } from "./music-structure";
import { recordCatalogChange } from "./storage";
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

/** @internal Snapshot-local source support and the journal-proved current frontier jointly authorize native deltas. */
export async function prepareMusicSourceProjection(
	tx: DatabaseTransaction,
	context: Parameters<CatalogSourceNativeWriter>[1] & { previousSnapshotId: string },
) {
	const occurrence = musicComponentSourceOccurrence;
	const history = musicComponentRevision;
	const scope = await resolveCatalogSourceChildCorrespondence(tx, context.sourceRecordId);
	const load = async (snapshotId: string) => {
		const rows = await tx
			.select({
				component: occurrence.component,
				componentKey: occurrence.componentKey,
				sourcePath: occurrence.sourcePath,
				historyId: occurrence.historyId,
				value: occurrence.sourceValue,
			})
			.from(occurrence)
			.innerJoin(
				history,
				and(eq(history.ownerId, occurrence.ownerId), eq(history.id, occurrence.historyId)),
			)
			.where(
				and(
					eq(occurrence.sourceRecordId, context.sourceRecordId),
					eq(occurrence.mappingKey, scope.mappingKey),
					eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
					eq(occurrence.snapshotId, snapshotId),
					eq(occurrence.ownerId, context.reference.id),
				),
			)
			.limit(129);
		if (rows.length > 128)
			throw new RangeError("Music source occurrence scope requires staged application");
		const result = new Map<string, MusicSourceComponentBaseline>();
		for (const row of rows) {
			const component = MusicComponentNameSchema.parse(row.component);
			const value = MusicComponentSchemas[component].parse(row.value);
			const currentHistoryId = await resolveMusicSourceComponentBaseline(tx, {
				sourceRecordId: context.sourceRecordId,
				mappingKey: context.mappingKey,
				correspondenceRevision: scope.correspondenceRevision,
				ownerId: context.reference.id,
				component,
				componentKey: row.componentKey,
				sourceHistoryId: row.historyId,
			});
			const [current] = await tx
				.select({ operation: history.operation })
				.from(history)
				.where(and(eq(history.ownerId, context.reference.id), eq(history.id, currentHistoryId)))
				.limit(1);
			if (!current) throw new Error("Source baseline current history is missing");
			result.set(`${component}:${row.sourcePath}`, {
				...row,
				value,
				component,
				currentHistoryId,
				absent: current.operation === "DELETE",
			});
		}
		return result;
	};
	const before = await load(context.previousSnapshotId);
	const alreadyObserved = await load(context.snapshotId);
	const used = new Set<string>();
	const operations: MusicComponentMutation[] = [];
	const pending: {
		component: MusicComponentName;
		componentKey: string;
		path: string;
		historyId?: string;
		sourceValue: Record<string, unknown>;
	}[] = [];
	const oldAt = (component: MusicComponentName, path: string) => {
		const old = before.get(`${component}:${path}`);
		if (!old) throw new TypeError(`Missing exact native source occurrence: ${component} ${path}`);
		return old;
	};
	const recoverAt = (component: MusicComponentName, path: string) =>
		alreadyObserved.get(`${component}:${path}`);
	const oldByKey = (component: MusicComponentName, key: string) =>
		[...before.values()].find((row) => row.component === component && row.componentKey === key);
	const put = (
		component: MusicComponentName,
		path: string,
		value: unknown,
		old?: MusicSourceComponentBaseline,
	) => {
		const row: Record<string, unknown> = MusicComponentSchemas[component].parse(value);
		const componentKey = musicComponentKey(component, row);
		if (old) used.add(`${component}:${old.componentKey}`);
		if (old && !old.absent && isDeepStrictEqual(old.value, row))
			pending.push({ component, componentKey, path, historyId: old.historyId, sourceValue: row });
		else {
			operations.push({
				action: "put",
				component,
				componentKey,
				expectedRevisionId: old?.currentHistoryId ?? null,
				value: row,
			});
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
		const plan = [...removals, ...operations];
		if (plan.length > 128)
			throw new RangeError("Music source delta requires staged native activation");
		const result = plan.length
			? await mutateMusicComponents(
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
		for (const row of pending) {
			const historyId = row.historyId ?? changed.get(`${row.component}:${row.componentKey}`);
			if (!historyId) throw new Error("Projected source occurrence has no exact native history");
			await tx
				.insert(occurrence)
				.values({
					...scope,
					sourceRecordId: context.sourceRecordId,
					snapshotId: context.snapshotId,
					ownerId: context.reference.id,
					component: row.component,
					componentKey: row.componentKey,
					sourcePath: row.path,
					historyId,
					sourceValue: row.sourceValue,
				})
				.onConflictDoNothing();
			const [existing] = await tx
				.select()
				.from(occurrence)
				.where(
					and(
						eq(occurrence.sourceRecordId, context.sourceRecordId),
						eq(occurrence.mappingKey, scope.mappingKey),
						eq(occurrence.correspondenceRevision, scope.correspondenceRevision),
						eq(occurrence.snapshotId, context.snapshotId),
						eq(occurrence.ownerId, context.reference.id),
						eq(occurrence.component, row.component),
						eq(occurrence.sourcePath, row.path),
					),
				)
				.limit(1);
			if (
				!existing ||
				existing.componentKey !== row.componentKey ||
				!isDeepStrictEqual(
					MusicComponentSchemas[row.component].parse(existing.sourceValue),
					row.sourceValue,
				)
			)
				throw new Error("Reapplied source occurrence targets another native identity");
		}
		return result;
	};
	return { oldAt, oldByKey, recoverAt, put, finish };
}
