import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
	MaximumAdaptedAudioRelationsPerVideo,
	unit,
	unitRelation,
	type UnitKind,
	type UnitRelationKind,
	UnitRelationSignatures,
} from "../database/schema";
import { type DatabaseExecutor, type DatabaseTransaction, database } from "../database";
import { UnitRelationInvalid } from "./errors";

const UnitRelationPath = "/details/adaptedAudioUnitIds";
const AdaptedAudioUnitIdsSchema = z
	.array(
		z
			.string()
			.uuid()
			.transform((value) => value.toLowerCase()),
	)
	.max(MaximumAdaptedAudioRelationsPerVideo)
	.superRefine((values, context) => {
		const seen = new Set<string>();
		for (const [index, value] of values.entries()) {
			if (seen.has(value))
				context.addIssue({
					code: "custom",
					path: [index],
					message: "must not contain duplicate Unit IDs",
				});
			seen.add(value);
		}
	});

export type UnitRelationState = {
	readonly sourceUnitId: string;
	readonly sourceUnitKind: UnitKind;
	readonly kind: UnitRelationKind;
	readonly targetUnitId: string;
	readonly targetUnitKind: UnitKind;
};
/** Minimal semantic form stored inside one source Unit's history document. */
export type UnitRelationSnapshot = {
	readonly kind: UnitRelationKind;
	readonly targetUnitId: string;
};

function compareCodePoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeAdaptedAudioUnitIds(value: unknown): readonly string[] {
	const result = AdaptedAudioUnitIdsSchema.safeParse(value ?? []);
	if (!result.success) {
		const issue = result.error.issues[0];
		const suffix = issue?.path.length ? `/${issue.path.join("/")}` : "";
		throw new UnitRelationInvalid(`${UnitRelationPath}${suffix}`, issue?.message ?? "is invalid");
	}
	return Object.freeze([...result.data].sort(compareCodePoints));
}

export function relationStateMatchesRegistry(state: UnitRelationState): boolean {
	const signature = UnitRelationSignatures[state.kind];
	return (
		state.sourceUnitKind === signature.sourceKind &&
		state.targetUnitKind === signature.targetKind &&
		state.sourceUnitId !== state.targetUnitId
	);
}

export function adaptedAudioRelationStates(
	videoUnitId: string,
	targetUnitIds: readonly string[],
): readonly UnitRelationState[] {
	return targetUnitIds.map((targetUnitId) => ({
		sourceUnitId: videoUnitId,
		sourceUnitKind: "video",
		kind: "adapted_audio",
		targetUnitId,
		targetUnitKind: "audio",
	}));
}

/** Reads the complete, application-bounded adapted-Audio set in stable order. */
export async function listAdaptedAudioUnitIds(
	videoUnitId: string,
	executor: DatabaseExecutor = database,
): Promise<readonly string[]> {
	const rows = await executor
		.select({ targetUnitId: unitRelation.targetUnitId })
		.from(unitRelation)
		.where(
			and(
				eq(unitRelation.sourceUnitId, videoUnitId),
				eq(unitRelation.sourceUnitKind, "video"),
				eq(unitRelation.kind, "adapted_audio"),
				eq(unitRelation.targetUnitKind, "audio"),
			),
		)
		.orderBy(asc(unitRelation.targetUnitId))
		.limit(MaximumAdaptedAudioRelationsPerVideo + 1);
	if (rows.length > MaximumAdaptedAudioRelationsPerVideo)
		throw new Error(`Video ${videoUnitId} exceeds the adapted Audio relation bound`);
	return rows.map(({ targetUnitId }) => targetUnitId);
}

async function assertLiveRelationTargets(
	tx: DatabaseTransaction,
	states: readonly UnitRelationState[],
): Promise<void> {
	const targetIds = states.map(({ targetUnitId }) => targetUnitId);
	if (!targetIds.length) return;
	const rows = await tx
		.select({ id: unit.id, kind: unit.kind })
		.from(unit)
		.where(and(inArray(unit.id, targetIds), eq(unit.kind, "audio"), isNull(unit.deletedAt)));
	if (
		rows.length !== targetIds.length ||
		rows.some(({ kind }) => kind !== UnitRelationSignatures.adapted_audio.targetKind)
	)
		throw new UnitRelationInvalid(UnitRelationPath, "contains an unavailable Audio Unit");
}

/**
 * Replaces one Video-owned relation set.
 *
 * The caller must already hold the Video aggregate's CAS transaction. Target
 * proof and the delete/insert happen within that same short transaction.
 */
export async function replaceAdaptedAudioUnitRelations(
	tx: DatabaseTransaction,
	videoUnitId: string,
	value: unknown,
): Promise<readonly string[]> {
	const targetUnitIds = normalizeAdaptedAudioUnitIds(value);
	const states = adaptedAudioRelationStates(videoUnitId, targetUnitIds);
	await assertLiveRelationTargets(tx, states);
	const currentRows = await tx
		.select({ targetUnitId: unitRelation.targetUnitId })
		.from(unitRelation)
		.where(and(eq(unitRelation.sourceUnitId, videoUnitId), eq(unitRelation.kind, "adapted_audio")))
		.orderBy(unitRelation.targetUnitId)
		.limit(MaximumAdaptedAudioRelationsPerVideo + 1);
	if (currentRows.length > MaximumAdaptedAudioRelationsPerVideo)
		throw new Error(`Video ${videoUnitId} exceeds the adapted Audio relation bound`);
	const currentIds = new Set(currentRows.map(({ targetUnitId }) => targetUnitId));
	const desiredIds = new Set(targetUnitIds);
	const removedIds = currentRows
		.map(({ targetUnitId }) => targetUnitId)
		.filter((targetUnitId) => !desiredIds.has(targetUnitId));
	if (removedIds.length)
		await tx
			.delete(unitRelation)
			.where(
				and(
					eq(unitRelation.sourceUnitId, videoUnitId),
					eq(unitRelation.kind, "adapted_audio"),
					inArray(unitRelation.targetUnitId, removedIds),
				),
			);
	const addedStates = states.filter(({ targetUnitId }) => !currentIds.has(targetUnitId));
	if (addedStates.length) await tx.insert(unitRelation).values(addedStates);
	return targetUnitIds;
}

/**
 * Restores all current relation kinds owned by one Unit.
 *
 * Historical targets need only retain their composite-FK identity; soft
 * deletion does not rewrite history. Unknown signatures fail before mutation.
 */
export async function restoreOwnedUnitRelations(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	sourceUnitKind: UnitKind,
	snapshots: readonly UnitRelationSnapshot[],
): Promise<void> {
	const identities = new Set<string>();
	const states = snapshots.map((snapshot): UnitRelationState => {
		const signature = UnitRelationSignatures[snapshot.kind];
		if (signature.sourceKind !== sourceUnitKind || sourceUnitId === snapshot.targetUnitId)
			throw new Error("Invalid Unit relation history state");
		const state: UnitRelationState = {
			sourceUnitId,
			sourceUnitKind,
			kind: snapshot.kind,
			targetUnitId: snapshot.targetUnitId,
			targetUnitKind: signature.targetKind,
		};
		if (!relationStateMatchesRegistry(state))
			throw new Error("Invalid Unit relation history state");
		const identity = `${snapshot.kind}\u0000${snapshot.targetUnitId}`;
		if (identities.has(identity)) throw new Error("Duplicate Unit relation history state");
		identities.add(identity);
		return state;
	});
	if (states.length > MaximumAdaptedAudioRelationsPerVideo)
		throw new Error("Adapted Audio relation history exceeds the per-Video bound");
	await tx.delete(unitRelation).where(eq(unitRelation.sourceUnitId, sourceUnitId));
	if (states.length) await tx.insert(unitRelation).values(states);
}
