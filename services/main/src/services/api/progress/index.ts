import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Elysia from "elysia";

import { getUnitReadCondition } from "../../authorization/unit/query";
import session from "../../auth/session";
import { database } from "../../database";
import { isPrimaryUnitLocalization } from "../../units/localization";
import {
	contentStructure,
	contentStructureNodeProgress,
	contentStructureNode,
	unitLocalization,
	unit,
	unitProgress,
} from "../../database/schema";
import { ContentStructureNodeNotFound } from "../content-structure/errors";
import { ProgressNotFound } from "./errors";
import {
	CompleteProgressBody,
	ListProgressQuery,
	ProgressNodeParams,
	ProgressUnitParams,
	UpsertProgressBody,
} from "./schema";
import {
	CompletionStateResponse,
	ProgressListResponse,
	ProgressNodeListResponse,
	ProgressResponse,
} from "../schema/response";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";

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
					lastContentStructureNodeId: unitProgress.lastContentStructureNodeId,
					deletedAt: unitProgress.deletedAt,
					type: unit.kind,
					title: unitLocalization.title,
				})
				.from(unitProgress)
				.innerJoin(unit, eq(unit.id, unitProgress.unitId))
				.leftJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						isPrimaryUnitLocalization(unitLocalization.unitId),
					),
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
			access: "interaction:read",
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
			access: "interaction:read",
			params: ProgressUnitParams,
			response: {
				[StatusCodes.OK]: ProgressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProgressNotFound"]),
			},
			detail: { summary: "Get progress", tags: ["Progress"] },
		},
	)
	.get(
		"/:unitId/nodes",
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const items = await database
				.select({
					nodeId: contentStructureNodeProgress.nodeId,
					completedAt: contentStructureNodeProgress.completedAt,
				})
				.from(contentStructureNodeProgress)
				.innerJoin(
					contentStructureNode,
					eq(contentStructureNode.id, contentStructureNodeProgress.nodeId),
				)
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
				.where(
					and(
						eq(contentStructureNodeProgress.profileId, profile.unitId),
						eq(contentStructureNode.ownerUnitId, params.unitId),
						eq(contentStructure.kind, "book.contents"),
						isNull(contentStructureNode.deletedAt),
						isNull(contentStructure.deletedAt),
					),
				)
				.orderBy(desc(contentStructureNodeProgress.completedAt));
			return { items };
		},
		{
			access: "interaction:read",
			params: ProgressUnitParams,
			response: {
				[StatusCodes.OK]: ProgressNodeListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "List completed Content Structure nodes", tags: ["Progress"] },
		},
	)
	.put(
		"/:unitId",
		async ({ profile, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			if (body.lastContentStructureNodeId) {
				const [node] = await database
					.select({ id: contentStructureNode.id })
					.from(contentStructureNode)
					.innerJoin(
						contentStructure,
						eq(contentStructure.id, contentStructureNode.structureId),
					)
					.where(
						and(
							eq(contentStructureNode.id, body.lastContentStructureNodeId),
							eq(contentStructureNode.ownerUnitId, params.unitId),
							eq(contentStructure.kind, "book.contents"),
							isNull(contentStructureNode.deletedAt),
							isNull(contentStructure.deletedAt),
						),
					)
					.limit(1);
				if (!node) throw new ContentStructureNodeNotFound();
			}
			const now = new Date();
			const progress = (
				await database
					.insert(unitProgress)
					.values({
						profileId: profile.unitId,
						unitId: params.unitId,
						status: body.status,
						progress: body.progress,
						totalTimeMs:
							body.totalTimeMs === undefined ? undefined : BigInt(body.totalTimeMs),
						lastContentStructureNodeId: body.lastContentStructureNodeId,
						deletedAt: null,
						lastSeenAt: now,
					})
					.onConflictDoUpdate({
						target: [unitProgress.profileId, unitProgress.unitId],
						set: {
							status: body.status,
							progress:
								body.progress ??
								sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.progress} else 0 end`,
							completedCount: sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.completedCount} else 0 end`,
							totalTimeMs:
								body.totalTimeMs === undefined
									? sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.totalTimeMs} else 0 end`
									: BigInt(body.totalTimeMs),
							firstSeenAt: sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.firstSeenAt} else ${now} end`,
							lastContentStructureNodeId:
								body.lastContentStructureNodeId === undefined
									? sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.lastContentStructureNodeId} else null end`
									: body.lastContentStructureNodeId,
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
			access: "write:interaction:write",
			params: ProgressUnitParams,
			body: UpsertProgressBody,
			response: {
				[StatusCodes.OK]: ProgressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
			},
			detail: { summary: "Create or replace progress", tags: ["Progress"] },
		},
	)
	.post(
		"/:unitId/complete",
		async ({ profile, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const now = new Date();
			const progress = (
				await database
					.insert(unitProgress)
					.values({
						profileId: profile.unitId,
						unitId: params.unitId,
						status: "completed",
						progress: 1,
						completedCount: 1,
						totalTimeMs:
							body.totalTimeMs === undefined ? undefined : BigInt(body.totalTimeMs),
						lastContentStructureNodeId: null,
						lastSeenAt: now,
					})
					.onConflictDoUpdate({
						target: [unitProgress.profileId, unitProgress.unitId],
						set: {
							status: "completed",
							progress: 1,
							completedCount: sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.completedCount} + 1 else 1 end`,
							totalTimeMs:
								body.totalTimeMs === undefined
									? sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.totalTimeMs} else 0 end`
									: BigInt(body.totalTimeMs),
							firstSeenAt: sql`case when ${unitProgress.deletedAt} is null then ${unitProgress.firstSeenAt} else ${now} end`,
							lastContentStructureNodeId: null,
							deletedAt: null,
							lastSeenAt: now,
						},
					})
					.returning()
			)[0];
			if (!progress) throw new Error("Progress completion did not return a row");
			return toProgressResponse(progress);
		},
		{
			access: "write:interaction:write",
			params: ProgressUnitParams,
			body: CompleteProgressBody,
			response: {
				[StatusCodes.OK]: ProgressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Complete current progress", tags: ["Progress"] },
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
			access: "write:interaction:write",
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
				.select({ id: contentStructureNode.id })
				.from(contentStructureNode)
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
				.where(
					and(
						eq(contentStructureNode.id, params.nodeId),
						eq(contentStructureNode.ownerUnitId, params.unitId),
						eq(contentStructure.kind, "book.contents"),
						isNull(contentStructureNode.deletedAt),
						isNull(contentStructure.deletedAt),
					),
				)
				.limit(1);
			if (!node) throw new ContentStructureNodeNotFound();
			await database
				.insert(contentStructureNodeProgress)
				.values({ profileId: profile.unitId, nodeId: params.nodeId })
				.onConflictDoNothing();
			return { completed: true };
		},
		{
			access: "write:interaction:write",
			params: ProgressNodeParams,
			response: {
				[StatusCodes.OK]: CompletionStateResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
			},
			detail: { summary: "Complete Content Structure node", tags: ["Progress"] },
		},
	)
	.delete(
		"/:unitId/nodes/:nodeId",
		async ({ profile, params }) => {
			await database
				.delete(contentStructureNodeProgress)
				.where(
					and(
						eq(contentStructureNodeProgress.profileId, profile.unitId),
						eq(contentStructureNodeProgress.nodeId, params.nodeId),
					),
				);
			return { completed: false };
		},
		{
			access: "write:interaction:write",
			params: ProgressNodeParams,
			response: { [StatusCodes.OK]: CompletionStateResponse },
			detail: { summary: "Uncomplete Content Structure node", tags: ["Progress"] },
		},
	);
