import { and, desc, eq, sql } from "drizzle-orm";

import { TagApplicationNotFound, UnitTagCurationChanged } from "../api/unit-resources/errors";
import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import { currentUnitTagJudgmentStat as unitTagJudgmentStat, unitTag } from "../database/schema";
import { lockUnitHistory, recordUnitRevision } from "../units/history";
import type { RevisionContributionInput } from "../units/revision-contribution";

export type UnitTagCurationState =
	| {
			readonly pinned: true;
			readonly position: string;
	  }
	| {
			readonly pinned: false;
			readonly position: null;
	  };

export function nextUnitTagCurationUpdatedAt(
	current: Date,
	wallClockMilliseconds = Date.now(),
): Date {
	return new Date(Math.max(wallClockMilliseconds, current.getTime() + 1));
}

export function unitTagCurationStatesEqual(
	current: UnitTagCurationState,
	requested: UnitTagCurationState,
): boolean {
	return current.pinned === requested.pinned && current.position === requested.position;
}

export function unitTagCurationOrdersEqual(
	currentFeaturedTagIds: readonly string[],
	expectedFeaturedTagIds: readonly string[],
): boolean {
	return (
		currentFeaturedTagIds.length === expectedFeaturedTagIds.length &&
		currentFeaturedTagIds.every((tagId, index) => tagId === expectedFeaturedTagIds[index])
	);
}

export function readUnitTagCurationState(input: {
	readonly pinned: boolean;
	readonly position: string | null;
}): UnitTagCurationState {
	if (input.pinned) {
		if (input.position === null) throw new Error("Pinned Unit Tag is missing its position");
		return { pinned: true, position: input.position };
	}
	if (input.position !== null) throw new Error("Unpinned Unit Tag unexpectedly has a position");
	return { pinned: false, position: null };
}

export async function updateDirectUnitTagCuration(input: {
	readonly unitId: string;
	readonly tagId: string;
	readonly actorProfileId: string;
	readonly expectedUpdatedAt: Date;
	readonly expectedFeaturedTagIds: readonly string[];
	readonly state: UnitTagCurationState;
	readonly contribution?: RevisionContributionInput;
}) {
	return database.transaction(async (tx) => {
		await lockUnitHistory(tx, input.unitId);
		const applications = await tx
			.select()
			.from(unitTag)
			.where(eq(unitTag.unitId, input.unitId))
			.orderBy(
				desc(unitTag.pinned),
				sql`case when ${unitTag.pinned} then ${unitTag.position} end asc nulls last`,
				unitTag.tagId,
			)
			.for("update");
		const current = applications.find((application) => application.tagId === input.tagId);
		if (!current) throw new TagApplicationNotFound();
		const currentFeaturedTagIds = applications
			.filter((application) => application.pinned)
			.map((application) => application.tagId);
		if (
			!unitTagCurationOrdersEqual(currentFeaturedTagIds, input.expectedFeaturedTagIds) ||
			current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
		)
			throw new UnitTagCurationChanged(currentFeaturedTagIds);

		const currentState = readUnitTagCurationState(current);
		const application = unitTagCurationStatesEqual(currentState, input.state)
			? current
			: await (async () => {
					const [updated] = await tx
						.update(unitTag)
						.set({
							pinned: input.state.pinned,
							position: input.state.position,
							updatedAt: nextUnitTagCurationUpdatedAt(current.updatedAt),
						})
						.where(and(eq(unitTag.unitId, input.unitId), eq(unitTag.tagId, input.tagId)))
						.returning();
					if (!updated) throw new TagApplicationNotFound();
					await recordUnitRevision(tx, {
						unitId: input.unitId,
						actorProfileId: input.actorProfileId,
						contribution: input.contribution,
						event: "update",
					});
					return updated;
				})();
		const [totals] = await tx
			.select({
				score: unitTagJudgmentStat.score,
				voteCount: unitTagJudgmentStat.voteCount,
			})
			.from(unitTagJudgmentStat)
			.where(
				and(
					eq(unitTagJudgmentStat.unitId, input.unitId),
					eq(unitTagJudgmentStat.tagId, input.tagId),
				),
			)
			.limit(1);
		return {
			...application,
			score: toSafeInteger(totals?.score ?? 0n, "Tag vote score"),
			voteCount: toSafeInteger(totals?.voteCount ?? 0n, "Tag vote count"),
		};
	});
}
