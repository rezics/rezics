import { unitStateRelation, unitStatesForIds } from "../../units/state-relation";
import { readProgressPage } from "./listing";
import { SearchFeatureDefinition } from "@rezics/filter";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";

import session from "../../auth/session";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { ContentStructureKindPolicies } from "../../content-structure/contracts";
import { database } from "../../database";
import {
	contentStructure,
	contentStructureNode,
	contentStructureNodeProgress,
	post,
	postProgressEntry,
	unitProgress,
	unitProgressEntry,
} from "../../database/schema";


import { ContentStructureNodeNotFound } from "../content-structure/errors";
import { NoContentResponse } from "../schema/action-response";
import {
	ChapterReadingProgressResponse,
	CompletionStateResponse,
	ProgressEntryListResponse,
	ProgressEntryResponse,
	ProgressListResponse,
	ProgressNodeListResponse,
	ProgressResponse,
	ProgressSearchResponse,
	toApiErrorResponse,
} from "../schema/response";
import {
	decodeProgressEntryCursor,
	encodeProgressEntryCursor,
	progressEntryCursorCondition,
	progressEntryOrderBy,
	resolveProgressEntrySortAt,
} from "./pagination";
import {
	CompleteProgressBody,
	CreateProgressEntryBody,
	ListProgressEntriesQuery,
	ListProgressQuery,
	ProgressEntryParams,
	ProgressLookupResponse,
	ProgressNodeParams,
	ProgressSearchBody,
	ProgressUnitParams,
	ReplaceProgressEntryBody,
	UpsertProgressBody,
	type ProgressContinuationResponse,
} from "./schema";
import {
	createProgressSearchCursor,
	getProgressSearchDefinition,
	resolveProgressSearchRequest,
} from "./search";
import {
	createProgressEntry,
	deleteProgressEntry,
	lockUnitProgress,
	recordChapterReading,
	recordMediaNodeCompletion,
	replaceProgressEntry,
	setCurrentProgressEntry,
} from "./service";

const contentState=unitStateRelation(contentStructureNode.contentUnitId,"progress_content_state");
const ownerState=unitStateRelation(sql`null::uuid`,"progress_owner_state");
async function findCompletableContentStructureNode(
	unitId: string,
	nodeId: string,
): Promise<"book" | "media" | null> {
	const [node] = await database
		.select({
			structureKind: contentStructure.kind,
			unitOwner: contentState.owner,
			postKind: post.kind,
		})
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.innerJoinLateral(contentState,sql`true`)
		.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.where(
			and(
				eq(contentStructureNode.id, nodeId),
				eq(contentStructureNode.ownerUnitId, unitId),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
				isNull(contentState.deletedAt),
			),
		)
		.limit(1);
	if (
		node?.structureKind === "book.contents" &&
		ContentStructureKindPolicies["book.contents"].contributesProgress(node.unitOwner, node.postKind)
	)
		return "book";
	if (
		node?.structureKind === "media.contents" &&
		ContentStructureKindPolicies["media.contents"].contributesProgress(node.unitOwner, node.postKind)
	)
		return "media";
	return null;
}

async function resolveProgressContinuation(unitId:string,nodeId:string|null):Promise<ProgressContinuationResponse> {
 const [candidate]=await database.select({owner:ownerState.owner,shape:ownerState.shape,nodeId:contentStructureNode.id,
  structureKind:contentStructure.kind,contentUnitId:contentState.id,contentOwner:contentState.owner,contentShape:contentState.shape,
 }).from(unitStatesForIds([unitId],"progress_owner_state"))
  .leftJoin(contentStructureNode,and(nodeId ? eq(contentStructureNode.id,nodeId) : sql`false`,eq(contentStructureNode.ownerUnitId,ownerState.id),isNull(contentStructureNode.deletedAt)))
  .leftJoin(contentStructure,and(eq(contentStructure.id,contentStructureNode.structureId),eq(contentStructure.ownerUnitId,ownerState.id),isNull(contentStructure.deletedAt)))
  .leftJoinLateral(contentState,and(eq(contentState.moderationStatus,"approved"),eq(contentState.status,"published"),inArray(contentState.visibility,["public","unlisted"])))
  .limit(1);
 if(!candidate) return {kind:"none"};
 if(candidate.owner==="publishing" && candidate.shape==="text_version") {
  return candidate.nodeId && candidate.structureKind==="book.contents" && candidate.contentOwner==="post" && candidate.contentShape==="chapter"
   ? {kind:"text-version-node",textVersionId:unitId,nodeId:candidate.nodeId}
   : {kind:"contents",ownerUnit:{id:unitId,owner:"publishing",shape:"text_version"}};
 }
 if(candidate.owner==="program") {
  return candidate.structureKind==="media.contents" && candidate.contentUnitId && (candidate.contentOwner==="video"||candidate.contentOwner==="audio")
   ? {kind:"unit",contentUnit:{id:candidate.contentUnitId,owner:candidate.contentOwner,shape:candidate.contentOwner}}
   : {kind:"contents",ownerUnit:{id:unitId,owner:"program",shape:"program"}};
 }
 return {kind:"none"};
}

function toProgressResponse<
	T extends {
		currentBasis?: string | null;
		deletedAt?: Date | null;
		status: string;
		totalTimeMs: bigint;
	},
>(row: T) {
	const { currentBasis: _currentBasis, deletedAt, ...rest } = row;
	return {
		...rest,
		status: row.status,
		totalTimeMs: Number(row.totalTimeMs),
		isDeleted: deletedAt !== undefined && deletedAt !== null,
		lastReadAnchor: null,
	};
}

function toProgressEntryResponse<
	T extends {
		affectsCurrent?: boolean;
		completionDelta: number;
		contentStructureNodeId: string | null;
		contentStructureRevisionId: string | null;
		createdAt: Date;
		datePrecision: string;
		deletedAt?: Date | null;
		entryKind: string;
		id: string;
		occurredAt: Date | null;
		authUserId: string;
		progress: number;
		reviewId?: string | null;
		status: string;
		totalTimeMs: bigint;
		unitId: string;
		updatedAt: Date;
	},
>(row: T) {
	const {
		affectsCurrent: _affectsCurrent,
		contentStructureNodeId,
		deletedAt: _deletedAt,
		...rest
	} = row;
	return {
		...rest,
		lastContentStructureNodeId: contentStructureNodeId,
		reviewId: row.reviewId ?? null,
		totalTimeMs: Number(row.totalTimeMs),
	};
}

async function selectProgressSnapshot(authUserId: string, unitId: string) {
	const [progress] = await database
		.select()
		.from(unitProgress)
		.where(
			and(
				eq(unitProgress.authUserId, authUserId),
				eq(unitProgress.unitId, unitId),
				isNull(unitProgress.deletedAt),
			),
		)
		.limit(1);
	if (!progress) throw new Error("Progress entry write did not produce a current snapshot");
	return toProgressResponse(progress);
}

export default new Elysia({ prefix: "/progress" })
	.use(session)
	.get(
		"",
		{
			access: "interaction:read",
			query: ListProgressQuery,
			response: { [StatusCodes.OK]: ProgressListResponse },
			detail: { summary: "List current profile progress", tags: ["Progress"] },
		},
        async ({user,authorization,query}) => {
         const request=resolveProgressSearchRequest({state:{sort:"progressLastSeenAt:desc",pageSize:query.limit??50,cursor:query.cursor}},JSON.stringify({surface:"list",status:query.status,languages:query.localizationLanguages}));
         const page=await readProgressPage({authUserId:user.id,profileId:authorization.profileId,languages:query.localizationLanguages??[],request,...(query.status ? {status:query.status} : {})});
         return {items:page.items,nextCursor:page.boundary ? createProgressSearchCursor(request,{boundary:page.boundary,consumed:page.consumed,total:page.total}) : null};
        },
	)
	.get(
		"/search/filter",
		{
			access: "interaction:read",
			response: { [StatusCodes.OK]: SearchFeatureDefinition },
			detail: {
				summary: "Get the Progress Filter definition",
				tags: ["Progress", "Search"],
			},
		},
		() => getProgressSearchDefinition(),
	)
	.post(
		"/search",
		{
			access: "interaction:read",
			body: ProgressSearchBody,
			response: {
				[StatusCodes.OK]: ProgressSearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidSearch"]),
			},
			detail: {
				summary: "Search current profile progress with a Search Feature state",
				tags: ["Progress", "Search"],
			},
		},
        async ({user,authorization,body}) => {
         const request=resolveProgressSearchRequest(body,JSON.stringify({surface:"search",languages:body.localizationLanguages}));
         const page=await readProgressPage({authUserId:user.id,profileId:authorization.profileId,languages:body.localizationLanguages??[],request});
         return {items:page.items,total:page.total,...(page.boundary ? {nextCursor:createProgressSearchCursor(request,{boundary:page.boundary,consumed:page.consumed,total:page.total})} : {})};
        },
	)
	.get(
		"/:unitId",
		{
			access: "interaction:read",
			params: ProgressUnitParams,
			response: {
				[StatusCodes.OK]: ProgressLookupResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Get progress state", tags: ["Progress"] },
		},
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const [result] = await database
				.select()
				.from(unitProgress)
				.where(
					and(
						eq(unitProgress.authUserId, user.id),
						eq(unitProgress.unitId, params.unitId),
						isNull(unitProgress.deletedAt),
					),
				)
				.limit(1);
			if (!result) return { state: "untracked" } satisfies ProgressLookupResponse;
			return {
				state: "tracked",
				record: toProgressResponse(result),
				continuation: await resolveProgressContinuation(
					params.unitId,
					result.lastContentStructureNodeId,
				),
			} satisfies ProgressLookupResponse;
		},
	)
	.get(
		"/:unitId/entries",
		{
			access: "interaction:read",
			params: ProgressUnitParams,
			query: ListProgressEntriesQuery,
			response: {
				[StatusCodes.OK]: ProgressEntryListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "List Progress journal entries", tags: ["Progress"] },
		},
		async ({ user, authorization, params, query }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const cursorScope = { unitId: params.unitId, status: query.status };
			const cursor = decodeProgressEntryCursor(query.cursor, cursorScope);
			const limit = query.limit ?? 30;
			const rows = await database
				.select({
					id: unitProgressEntry.id,
					authUserId: unitProgressEntry.authUserId,
					unitId: unitProgressEntry.unitId,
					entryKind: unitProgressEntry.entryKind,
					status: unitProgressEntry.status,
					progress: unitProgressEntry.progress,
					completionDelta: unitProgressEntry.completionDelta,
					totalTimeMs: unitProgressEntry.totalTimeMs,
					contentStructureNodeId: unitProgressEntry.contentStructureNodeId,
					contentStructureRevisionId: unitProgressEntry.contentStructureRevisionId,
					occurredAt: unitProgressEntry.occurredAt,
					datePrecision: unitProgressEntry.datePrecision,
					reviewId: postProgressEntry.postId,
					createdAt: unitProgressEntry.createdAt,
					updatedAt: unitProgressEntry.updatedAt,
				})
				.from(unitProgressEntry)
				.leftJoin(postProgressEntry, eq(postProgressEntry.progressEntryId, unitProgressEntry.id))
				.where(
					and(
						eq(unitProgressEntry.authUserId, user.id),
						eq(unitProgressEntry.unitId, params.unitId),
						isNull(unitProgressEntry.deletedAt),
						query.status ? eq(unitProgressEntry.status, query.status) : undefined,
						progressEntryCursorCondition(cursor),
					),
				)
				.orderBy(...progressEntryOrderBy)
				.limit(limit + 1);
			const page = rows.slice(0, limit);
			const last = page.at(-1);
			return {
				items: page.map(toProgressEntryResponse),
				nextCursor:
					rows.length > limit && last
						? encodeProgressEntryCursor(cursorScope, {
								sortAt: resolveProgressEntrySortAt(last),
								createdAt: last.createdAt,
								id: last.id,
							})
						: null,
			};
		},
	)
	.post(
		"/:unitId/entries",
		{
			access: "write:interaction:write",
			params: ProgressUnitParams,
			body: CreateProgressEntryBody,
			response: {
				[StatusCodes.OK]: ProgressEntryResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
			},
			detail: { summary: "Create a Progress journal entry", tags: ["Progress"] },
		},
		async ({ user, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const entry = await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				return createProgressEntry(tx, user.id, params.unitId, {
					entryKind: body.entryKind,
					status: body.status,
					progress: body.progress,
					totalTimeMs: body.totalTimeMs,
					lastContentStructureNodeId: body.lastContentStructureNodeId,
					occurredAt: body.occurredAt,
					datePrecision: body.datePrecision,
					affectsCurrent: false,
				});
			});
			return toProgressEntryResponse({ ...entry, reviewId: null });
		},
	)
	.put(
		"/:unitId/entries/:entryId",
		{
			access: "write:interaction:write",
			params: ProgressEntryParams,
			body: ReplaceProgressEntryBody,
			response: {
				[StatusCodes.OK]: ProgressEntryResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ProgressEntryNotFound",
					"ContentStructureNodeNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
			},
			detail: { summary: "Replace a Progress journal entry", tags: ["Progress"] },
		},
		async ({ user, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const entry = await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				return replaceProgressEntry(tx, user.id, params.unitId, params.entryId, {
					entryKind: body.entryKind,
					status: body.status,
					progress: body.progress,
					totalTimeMs: body.totalTimeMs,
					lastContentStructureNodeId: body.lastContentStructureNodeId,
					occurredAt: body.occurredAt,
					datePrecision: body.datePrecision,
				});
			});
			const [binding] = await database
				.select({ reviewId: postProgressEntry.postId })
				.from(postProgressEntry)
				.where(eq(postProgressEntry.progressEntryId, entry.id))
				.limit(1);
			return toProgressEntryResponse({
				...entry,
				reviewId: binding?.reviewId ?? null,
			});
		},
	)
	.put(
		"/:unitId/entries/:entryId/current",
		{
			access: "write:interaction:write",
			params: ProgressEntryParams,
			response: {
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProgressEntryNotFound"]),
			},
			detail: {
				summary: "Set a Progress journal entry as current",
				tags: ["Progress"],
				responses: NoContentResponse,
			},
		},
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				await setCurrentProgressEntry(tx, user.id, params.unitId, params.entryId);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	)
	.delete(
		"/:unitId/entries/:entryId",
		{
			access: "write:interaction:write",
			params: ProgressEntryParams,
			response: {
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProgressEntryNotFound"]),
			},
			detail: {
				summary: "Delete a Progress journal entry",
				tags: ["Progress"],
				responses: NoContentResponse,
			},
		},
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				await deleteProgressEntry(tx, user.id, params.unitId, params.entryId);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	)
	.get(
		"/:unitId/nodes",
		{
			access: "interaction:read",
			params: ProgressUnitParams,
			response: {
				[StatusCodes.OK]: ProgressNodeListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "List completed Content Structure nodes", tags: ["Progress"] },
		},
		async ({ user, authorization, params }) => {
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
				.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
				.innerJoinLateral(contentState,sql`true`)
				.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNodeProgress.authUserId, user.id),
						eq(contentStructureNode.ownerUnitId, params.unitId),
						or(
							and(
								eq(contentStructure.kind, "book.contents"),
								eq(contentState.owner, "post"),
								eq(post.kind, "chapter"),
							),
							and(
								eq(contentStructure.kind, "media.contents"),
								inArray(contentState.owner, ["video", "audio"]),
							),
						),
						isNull(contentStructureNode.deletedAt),
						isNull(contentStructure.deletedAt),
						isNull(contentState.deletedAt),
                        getUnitReadCondition(authorization.profileId,{},contentState),
					),
				)
				.orderBy(desc(contentStructureNodeProgress.completedAt));
			return { items };
		},
	)
	.post(
		"/:unitId/nodes/:nodeId/read",
		{
			access: "write:interaction:write",
			params: ProgressNodeParams,
			response: {
				[StatusCodes.OK]: ChapterReadingProgressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
			},
			detail: { summary: "Record a Book chapter read", tags: ["Progress"] },
		},
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const canReadUnpublished = await authorization.unit.canUpdate(params.unitId);
			const result = await database.transaction((tx) =>
				recordChapterReading(tx, {
					canReadUnpublished,
					nodeId: params.nodeId,
					now: new Date(),
					authUserId: user.id,
					unitId: params.unitId,
				}),
			);
			return {
				completed: true as const,
				journalEntryCreated: result.journalEntryCreated,
				record: toProgressResponse(result.record),
			};
		},
	)
	.put(
		"/:unitId",
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
		async ({ user, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const now = new Date();
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				await createProgressEntry(tx, user.id, params.unitId, {
					entryKind: "update",
					status: body.status,
					progress: body.progress,
					totalTimeMs: body.totalTimeMs,
					lastContentStructureNodeId: body.lastContentStructureNodeId,
					occurredAt: now,
					datePrecision: "instant",
					affectsCurrent: true,
				});
				if (body.visibility !== undefined)
					await tx
						.update(unitProgress)
						.set({ visibility: body.visibility, updatedAt: new Date() })
						.where(
							and(
								eq(unitProgress.authUserId, user.id),
								eq(unitProgress.unitId, params.unitId),
								isNull(unitProgress.deletedAt),
							),
						);
			});
			return selectProgressSnapshot(user.id, params.unitId);
		},
	)
	.post(
		"/:unitId/complete",
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
		async ({ user, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const now = new Date();
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				await createProgressEntry(tx, user.id, params.unitId, {
					entryKind: "completion",
					status: "completed",
					totalTimeMs: body.totalTimeMs,
					lastContentStructureNodeId: null,
					occurredAt: now,
					datePrecision: "instant",
					affectsCurrent: true,
				});
				if (body.visibility !== undefined)
					await tx
						.update(unitProgress)
						.set({ visibility: body.visibility, updatedAt: new Date() })
						.where(
							and(
								eq(unitProgress.authUserId, user.id),
								eq(unitProgress.unitId, params.unitId),
								isNull(unitProgress.deletedAt),
							),
						);
			});
			return selectProgressSnapshot(user.id, params.unitId);
		},
	)
	.delete(
		"/:unitId",
		{
			access: "write:interaction:write",
			params: ProgressUnitParams,
			detail: {
				summary: "Delete progress",
				tags: ["Progress"],
				responses: NoContentResponse,
			},
		},
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, user.id, params.unitId);
				const now = new Date();
				const entries = await tx
					.select({ id: unitProgressEntry.id })
					.from(unitProgressEntry)
					.where(
						and(
							eq(unitProgressEntry.authUserId, user.id),
							eq(unitProgressEntry.unitId, params.unitId),
							isNull(unitProgressEntry.deletedAt),
						),
					)
					.for("update");
				if (entries.length)
					await tx.delete(postProgressEntry).where(
						inArray(
							postProgressEntry.progressEntryId,
							entries.map(({ id }) => id),
						),
					);
				await tx
					.update(unitProgress)
					.set({
						currentEntryId: null,
						currentBasis: null,
						deletedAt: now,
						lastSeenAt: now,
					})
					.where(and(eq(unitProgress.authUserId, user.id), eq(unitProgress.unitId, params.unitId)));
				await tx
					.update(unitProgressEntry)
					.set({ deletedAt: now, updatedAt: now })
					.where(
						and(
							eq(unitProgressEntry.authUserId, user.id),
							eq(unitProgressEntry.unitId, params.unitId),
							isNull(unitProgressEntry.deletedAt),
						),
					);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	)
	.put(
		"/:unitId/nodes/:nodeId",
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
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const nodeKind = await findCompletableContentStructureNode(params.unitId, params.nodeId);
			if (!nodeKind) throw new ContentStructureNodeNotFound();
			if (nodeKind === "media") {
				const canReadUnpublished = await authorization.unit.canUpdate(params.unitId);
				await database.transaction((tx) =>
					recordMediaNodeCompletion(tx, {
						canReadUnpublished,
						completed: true,
						nodeId: params.nodeId,
						now: new Date(),
						authUserId: user.id,
						unitId: params.unitId,
					}),
				);
				return { completed: true };
			}
			await database
				.insert(contentStructureNodeProgress)
				.values({ authUserId: user.id, nodeId: params.nodeId })
				.onConflictDoNothing();
			return { completed: true };
		},
	)
	.delete(
		"/:unitId/nodes/:nodeId",
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
			detail: { summary: "Uncomplete Content Structure node", tags: ["Progress"] },
		},
		async ({ user, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const nodeKind = await findCompletableContentStructureNode(params.unitId, params.nodeId);
			if (!nodeKind) throw new ContentStructureNodeNotFound();
			if (nodeKind === "media") {
				const canReadUnpublished = await authorization.unit.canUpdate(params.unitId);
				await database.transaction((tx) =>
					recordMediaNodeCompletion(tx, {
						canReadUnpublished,
						completed: false,
						nodeId: params.nodeId,
						now: new Date(),
						authUserId: user.id,
						unitId: params.unitId,
					}),
				);
				return { completed: false };
			}
			await database
				.delete(contentStructureNodeProgress)
				.where(
					and(
						eq(contentStructureNodeProgress.authUserId, user.id),
						eq(contentStructureNodeProgress.nodeId, params.nodeId),
					),
				);
			return { completed: false };
		},
	);
