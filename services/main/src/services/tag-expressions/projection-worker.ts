import { and, asc, eq, gt, lte, sql } from "drizzle-orm";

import { database } from "../database";
import {
	realmUnitExpressionAssertion,
	tagExpressionProjectionRebuild,
	unitExpressionAssertion,
} from "../database/schema";

export const TagExpressionProjectionBatchSize = 500 as const;
export const TagExpressionProjectionClaimBatchSize = 4 as const;

type ProjectionJob = Readonly<{
	attemptCount: number;
	expressionId: string;
	globalComplete: boolean;
	globalCursorUnitId: string | null;
	realmComplete: boolean;
	realmCursorRealmId: string | null;
	realmCursorUnitId: string | null;
	requestedAt: Date;
}>;

export function tagExpressionProjectionRetryDelayMilliseconds(attemptCount: number): number {
	if (!Number.isSafeInteger(attemptCount) || attemptCount < 1)
		throw new RangeError("Tag Expression projection attempt count must be a positive integer");
	return Math.min(60_000, 1_000 * 2 ** Math.min(attemptCount - 1, 6));
}

function errorMessage(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

async function refreshGlobalPage(
	tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
	job: ProjectionJob,
): Promise<Readonly<{ complete: boolean; cursor: string | null }>> {
	const rows = await tx
		.select({ unitId: unitExpressionAssertion.unitId })
		.from(unitExpressionAssertion)
		.where(
			and(
				eq(unitExpressionAssertion.expressionId, job.expressionId),
				job.globalCursorUnitId
					? gt(unitExpressionAssertion.unitId, job.globalCursorUnitId)
					: undefined,
			),
		)
		.orderBy(asc(unitExpressionAssertion.unitId))
		.limit(TagExpressionProjectionBatchSize + 1);
	const page = rows.slice(0, TagExpressionProjectionBatchSize);
	if (page.length)
		await tx.execute(sql`
			select public.refresh_unit_effective_tags(target.unit_id)
			from unnest(${page.map(({ unitId }) => unitId)}::uuid[]) as target(unit_id)
			order by target.unit_id
		`);
	return {
		complete: rows.length <= TagExpressionProjectionBatchSize,
		cursor: page.at(-1)?.unitId ?? job.globalCursorUnitId,
	};
}

async function refreshRealmPage(
	tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
	job: ProjectionJob,
): Promise<Readonly<{ complete: boolean; realmCursor: string | null; unitCursor: string | null }>> {
	const rows = await tx
		.select({
			realmId: realmUnitExpressionAssertion.realmId,
			unitId: realmUnitExpressionAssertion.unitId,
		})
		.from(realmUnitExpressionAssertion)
		.where(
			and(
				eq(realmUnitExpressionAssertion.expressionId, job.expressionId),
				job.realmCursorRealmId && job.realmCursorUnitId
					? sql`(${realmUnitExpressionAssertion.realmId}, ${realmUnitExpressionAssertion.unitId})
						> (${job.realmCursorRealmId}::uuid, ${job.realmCursorUnitId}::uuid)`
					: undefined,
			),
		)
		.orderBy(asc(realmUnitExpressionAssertion.realmId), asc(realmUnitExpressionAssertion.unitId))
		.limit(TagExpressionProjectionBatchSize + 1);
	const page = rows.slice(0, TagExpressionProjectionBatchSize);
	if (page.length)
		await tx.execute(sql`
			select public.refresh_realm_unit_effective_tags(target.realm_id, target.unit_id)
			from unnest(
				${page.map(({ realmId }) => realmId)}::uuid[],
				${page.map(({ unitId }) => unitId)}::uuid[]
			) as target(realm_id, unit_id)
			order by target.realm_id, target.unit_id
		`);
	const cursor = page.at(-1);
	return {
		complete: rows.length <= TagExpressionProjectionBatchSize,
		realmCursor: cursor?.realmId ?? job.realmCursorRealmId,
		unitCursor: cursor?.unitId ?? job.realmCursorUnitId,
	};
}

async function markFailure(
	expressionId: string,
	claimedRequestedAt: Date,
	error: unknown,
): Promise<void> {
	const [job] = await database
		.select({ attemptCount: tagExpressionProjectionRebuild.attemptCount })
		.from(tagExpressionProjectionRebuild)
		.where(
			and(
				eq(tagExpressionProjectionRebuild.expressionId, expressionId),
				eq(tagExpressionProjectionRebuild.requestedAt, claimedRequestedAt),
			),
		)
		.limit(1);
	if (!job) return;
	const attemptCount = job.attemptCount + 1;
	const now = new Date();
	await database
		.update(tagExpressionProjectionRebuild)
		.set({
			attemptCount,
			availableAt: new Date(
				now.getTime() + tagExpressionProjectionRetryDelayMilliseconds(attemptCount),
			),
			lastErrorMessage: errorMessage(error),
			updatedAt: now,
		})
		.where(
			and(
				eq(tagExpressionProjectionRebuild.expressionId, expressionId),
				eq(tagExpressionProjectionRebuild.requestedAt, claimedRequestedAt),
			),
		);
}

async function advanceProjectionJob(now = new Date()): Promise<boolean> {
	let claimedExpressionId: string | undefined;
	let claimedRequestedAt: Date | undefined;
	try {
		return await database.transaction(async (tx) => {
			const [job] = await tx
				.select({
					attemptCount: tagExpressionProjectionRebuild.attemptCount,
					expressionId: tagExpressionProjectionRebuild.expressionId,
					globalComplete: tagExpressionProjectionRebuild.globalComplete,
					globalCursorUnitId: tagExpressionProjectionRebuild.globalCursorUnitId,
					realmComplete: tagExpressionProjectionRebuild.realmComplete,
					realmCursorRealmId: tagExpressionProjectionRebuild.realmCursorRealmId,
					realmCursorUnitId: tagExpressionProjectionRebuild.realmCursorUnitId,
					requestedAt: tagExpressionProjectionRebuild.requestedAt,
				})
				.from(tagExpressionProjectionRebuild)
				.where(lte(tagExpressionProjectionRebuild.availableAt, now))
				.orderBy(
					asc(tagExpressionProjectionRebuild.availableAt),
					asc(tagExpressionProjectionRebuild.requestedAt),
					asc(tagExpressionProjectionRebuild.expressionId),
				)
				.limit(1)
				.for("update", { skipLocked: true });
			if (!job) return false;
			claimedExpressionId = job.expressionId;
			claimedRequestedAt = job.requestedAt;
			if (!job.globalComplete) {
				const page = await refreshGlobalPage(tx, job);
				await tx
					.update(tagExpressionProjectionRebuild)
					.set({
						attemptCount: 0,
						availableAt: now,
						globalComplete: page.complete,
						globalCursorUnitId: page.cursor,
						lastErrorMessage: null,
						updatedAt: now,
					})
					.where(eq(tagExpressionProjectionRebuild.expressionId, job.expressionId));
				return true;
			}
			const page = await refreshRealmPage(tx, job);
			if (page.complete) {
				await tx
					.delete(tagExpressionProjectionRebuild)
					.where(eq(tagExpressionProjectionRebuild.expressionId, job.expressionId));
				return true;
			}
			await tx
				.update(tagExpressionProjectionRebuild)
				.set({
					attemptCount: 0,
					availableAt: now,
					lastErrorMessage: null,
					realmCursorRealmId: page.realmCursor,
					realmCursorUnitId: page.unitCursor,
					updatedAt: now,
				})
				.where(eq(tagExpressionProjectionRebuild.expressionId, job.expressionId));
			return true;
		});
	} catch (error) {
		if (!claimedExpressionId || !claimedRequestedAt) throw error;
		await markFailure(claimedExpressionId, claimedRequestedAt, error);
		return true;
	}
}

/** Enqueues every currently asserted Expression for an explicit maintenance rebuild. */
export async function enqueueAllTagExpressionProjectionRebuilds(): Promise<number> {
	const result = await database.execute<{ readonly expressionId: string }>(sql`
		insert into public.tag_expression_projection_rebuild(
			expression_id, global_cursor_unit_id, global_complete,
			realm_cursor_realm_id, realm_cursor_unit_id, realm_complete,
			attempt_count, available_at, last_error_message, requested_at, updated_at
		)
		select asserted.expression_id, null, false, null, null, false,
			0, clock_timestamp(), null, clock_timestamp(), clock_timestamp()
		from (
			select expression_id from public.unit_expression_assertion
			union
			select expression_id from public.realm_unit_expression_assertion
		) as asserted
		on conflict (expression_id) do update set
			global_cursor_unit_id = null,
			global_complete = false,
			realm_cursor_realm_id = null,
			realm_cursor_unit_id = null,
			realm_complete = false,
			attempt_count = 0,
			available_at = excluded.available_at,
			last_error_message = null,
			requested_at = excluded.requested_at,
			updated_at = excluded.updated_at
		returning expression_id as "expressionId"
	`);
	return result.rows.length;
}

/** Claims and advances a bounded number of definition-change projection pages. */
export async function dispatchTagExpressionProjectionRebuilds(
	limit: number = TagExpressionProjectionClaimBatchSize,
): Promise<number> {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32)
		throw new RangeError("Tag Expression projection claim limit must be between 1 and 32");
	let advanced = 0;
	while (advanced < limit && (await advanceProjectionJob())) advanced += 1;
	return advanced;
}
