import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull } from "drizzle-orm";
import Elysia from "elysia";

import { getUnitReadCondition } from "../../authorization/unit/query";
import session from "../../auth/session";
import { database } from "../../database";
import {
	contentNodeProgress,
	contentNode,
	unitLocalization,
	unit,
	unitProgress,
} from "../../database/schema";
import { ContentNodeNotFound } from "../content/errors";
import { ProgressNotFound } from "./errors";
import {
	ListProgressQuery,
	ProgressNodeParams,
	ProgressUnitParams,
	UpsertProgressBody,
} from "./schema";
import {
	CompletionStateResponse,
	ProgressListResponse,
	ProgressResponse,
} from "../schema/response";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function toProgressResponse<
	T extends { status: string; totalTimeMs: bigint; deletedAt?: Date | null },
>(row: T) {
	const { deletedAt, ...rest } = row;
	return {
		...rest,
		status: row.status,
		totalTimeMs: Number(row.totalTimeMs),
		isDeleted: deletedAt !== undefined && deletedAt !== null,
		lastReadAnchor: null,
	};
}

export default new Elysia({ prefix: "/progress" })
	.use(session)
	.get(
		"",
		async ({ profile, query }) => {
			const items = await database
				.select({
					unitId: unitProgress.unitId,
					status: unitProgress.status,
					progress: unitProgress.progress,
					completedCount: unitProgress.completedCount,
					totalTimeMs: unitProgress.totalTimeMs,
					firstSeenAt: unitProgress.firstSeenAt,
					lastSeenAt: unitProgress.lastSeenAt,
					lastReadNodeId: unitProgress.lastReadNodeId,
					deletedAt: unitProgress.deletedAt,
					type: unit.kind,
					slug: unit.slug,
					title: unitLocalization.title,
				})
				.from(unitProgress)
				.innerJoin(unit, eq(unit.id, unitProgress.unitId))
				.leftJoin(
					unitLocalization,
					and(eq(unitLocalization.unitId, unit.id), eq(unitLocalization.isDefault, true)),
				)
				.where(
					and(
						eq(unitProgress.profileId, profile.unitId),
						isNull(unitProgress.deletedAt),
						getUnitReadCondition(profile.unitId),
						query.status ? eq(unitProgress.status, query.status) : undefined,
					),
				)
				.orderBy(desc(unitProgress.lastSeenAt))
				.limit(query.limit ?? 50);
			return { items: items.map(toProgressResponse) };
		},
		{
			auth: true,
			query: ListProgressQuery,
			response: { [StatusCodes.OK]: ProgressListResponse },
			detail: { summary: "List current profile progress", tags: ["Progress"] },
		},
	)
	.get(
		"/:unitId",
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const [result] = await database
				.select()
				.from(unitProgress)
				.where(
					and(
						eq(unitProgress.profileId, profile.unitId),
						eq(unitProgress.unitId, params.unitId),
						isNull(unitProgress.deletedAt),
					),
				)
				.limit(1);
			if (!result) throw new ProgressNotFound();
			return toProgressResponse(result);
		},
		{
			auth: true,
			params: ProgressUnitParams,
			response: {
				[StatusCodes.OK]: ProgressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProgressNotFound"]),
			},
			detail: { summary: "Get progress", tags: ["Progress"] },
		},
	)
	.put(
		"/:unitId",
		async ({ profile, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const now = new Date();
			const progress = (
				await database
					.insert(unitProgress)
					.values({
						profileId: profile.unitId,
						unitId: params.unitId,
						status: body.status,
						progress: body.progress,
						completedCount: body.completedCount,
						totalTimeMs:
							body.totalTimeMs === undefined ? undefined : BigInt(body.totalTimeMs),
						lastReadNodeId: body.lastReadNodeId,
						deletedAt: null,
						lastSeenAt: now,
					})
					.onConflictDoUpdate({
						target: [unitProgress.profileId, unitProgress.unitId],
						set: {
							status: body.status,
							progress: body.progress,
							completedCount: body.completedCount,
							totalTimeMs:
								body.totalTimeMs === undefined
									? undefined
									: BigInt(body.totalTimeMs),
							lastReadNodeId: body.lastReadNodeId,
							deletedAt: null,
							lastSeenAt: now,
						},
					})
					.returning()
			)[0];
			if (!progress) throw new Error("Progress upsert did not return a row");
			return toProgressResponse(progress);
		},
		{
			write: true,
			params: ProgressUnitParams,
			body: UpsertProgressBody,
			response: {
				[StatusCodes.OK]: ProgressResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Create or replace progress", tags: ["Progress"] },
		},
	)
	.delete(
		"/:unitId",
		async ({ profile, params }) => {
			await database
				.update(unitProgress)
				.set({ deletedAt: new Date(), lastSeenAt: new Date() })
				.where(
					and(
						eq(unitProgress.profileId, profile.unitId),
						eq(unitProgress.unitId, params.unitId),
					),
				);
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
			params: ProgressUnitParams,
			detail: {
				summary: "Delete progress",
				tags: ["Progress"],
				responses: NoContentResponse,
			},
		},
	)
	.put(
		"/:unitId/nodes/:nodeId",
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const [node] = await database
				.select({ id: contentNode.id })
				.from(contentNode)
				.where(
					and(eq(contentNode.id, params.nodeId), eq(contentNode.bookId, params.unitId)),
				)
				.limit(1);
			if (!node) throw new ContentNodeNotFound();
			await database
				.insert(contentNodeProgress)
				.values({ profileId: profile.unitId, nodeId: params.nodeId })
				.onConflictDoNothing();
			return { completed: true };
		},
		{
			write: true,
			params: ProgressNodeParams,
			response: {
				[StatusCodes.OK]: CompletionStateResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentNodeNotFound",
				]),
			},
			detail: { summary: "Complete content node", tags: ["Progress"] },
		},
	)
	.delete(
		"/:unitId/nodes/:nodeId",
		async ({ profile, params }) => {
			await database
				.delete(contentNodeProgress)
				.where(
					and(
						eq(contentNodeProgress.profileId, profile.unitId),
						eq(contentNodeProgress.nodeId, params.nodeId),
					),
				);
			return { completed: false };
		},
		{
			write: true,
			params: ProgressNodeParams,
			response: { [StatusCodes.OK]: CompletionStateResponse },
			detail: { summary: "Uncomplete content node", tags: ["Progress"] },
		},
	);
