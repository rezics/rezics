import { SearchFeatureDefinition } from "@rezics/filter";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
	unit,
	unitLocalization,
	unitProgress,
	unitProgressEntry,
} from "../../database/schema";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
} from "../../units/localization";
import { presentImageAsset } from "../../units/service";
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

const continuationContentUnit = alias(unit, "progress_continuation_content_unit");

function toProgressUnitType(value: string): "book" | "media" | "software" {
	if (value === "book" || value === "media" || value === "software") return value;
	throw new TypeError("Progress Search returned an unsupported Unit kind");
}

async function findCompletableContentStructureNode(
	unitId: string,
	nodeId: string,
): Promise<"book" | "media" | null> {
	const [node] = await database
		.select({
			structureKind: contentStructure.kind,
			unitKind: unit.kind,
			postKind: post.kind,
		})
		.from(contentStructureNode)
		.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.where(
			and(
				eq(contentStructureNode.id, nodeId),
				eq(contentStructureNode.ownerUnitId, unitId),
				isNull(contentStructureNode.deletedAt),
				isNull(contentStructure.deletedAt),
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (
		node?.structureKind === "book.contents" &&
		ContentStructureKindPolicies["book.contents"].contributesProgress(node.unitKind, node.postKind)
	)
		return "book";
	if (
		node?.structureKind === "media.contents" &&
		ContentStructureKindPolicies["media.contents"].contributesProgress(node.unitKind, node.postKind)
	)
		return "media";
	return null;
}

async function resolveProgressContinuation(
	unitId: string,
	nodeId: string | null,
): Promise<ProgressContinuationResponse> {
	const [candidate] = await database
		.select({
			ownerKind: unit.kind,
			nodeId: contentStructureNode.id,
			structureKind: contentStructure.kind,
			contentUnitId: continuationContentUnit.id,
			contentUnitKind: continuationContentUnit.kind,
			postKind: post.kind,
		})
		.from(unit)
		.leftJoin(
			contentStructureNode,
			and(
				nodeId ? eq(contentStructureNode.id, nodeId) : sql`false`,
				eq(contentStructureNode.ownerUnitId, unit.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.leftJoin(
			contentStructure,
			and(
				eq(contentStructure.id, contentStructureNode.structureId),
				eq(contentStructure.ownerUnitId, unit.id),
				isNull(contentStructure.deletedAt),
			),
		)
		.leftJoin(
			continuationContentUnit,
			and(
				eq(continuationContentUnit.id, contentStructureNode.contentUnitId),
				isNull(continuationContentUnit.deletedAt),
				eq(continuationContentUnit.moderationStatus, "approved"),
			),
		)
		.leftJoin(post, eq(post.id, continuationContentUnit.id))
		.where(and(eq(unit.id, unitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!candidate || candidate.ownerKind === "software") return { kind: "none" };
	if (
		candidate.ownerKind === "book" &&
		candidate.nodeId &&
		candidate.structureKind === "book.contents" &&
		candidate.contentUnitKind === "post" &&
		candidate.postKind === "chapter"
	)
		return { kind: "book-node", bookId: unitId, nodeId: candidate.nodeId };
	if (
		candidate.ownerKind === "media" &&
		candidate.structureKind === "media.contents" &&
		candidate.contentUnitId &&
		(candidate.contentUnitKind === "video" || candidate.contentUnitKind === "audio")
	)
		return {
			kind: "unit",
			contentUnit: { id: candidate.contentUnitId, type: candidate.contentUnitKind },
		};
	if (candidate.ownerKind === "book" || candidate.ownerKind === "media")
		return { kind: "contents", ownerUnit: { id: unitId, type: candidate.ownerKind } };
	return { kind: "none" };
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
		async ({ user, authorization, query }) => {
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
					visibility: unitProgress.visibility,
					deletedAt: unitProgress.deletedAt,
					type: unit.kind,
					language: unitLocalization.language,
					title: unitLocalization.title,
				})
				.from(unitProgress)
				.innerJoin(unit, eq(unit.id, unitProgress.unitId))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(unit.id, query.localizationLanguages),
						),
					),
				)
				.where(
					and(
						eq(unitProgress.authUserId, user.id),
						isNull(unitProgress.deletedAt),
						getUnitReadCondition(authorization.profileId),
						query.status ? eq(unitProgress.status, query.status) : undefined,
					),
				)
				.orderBy(desc(unitProgress.lastSeenAt))
				.limit(query.limit ?? 50);
			return { items: items.map(toProgressResponse) };
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
		async ({ user, authorization, body }) => {
			const request = resolveProgressSearchRequest(body);
			const textCondition = request.query
				? (() => {
						const escaped = request.query.replace(/[!%_]/g, "!$&");
						const pattern = `%${escaped}%`;
						return or(
							sql`coalesce(${unitLocalization.title}, '') ilike ${pattern} escape '!'`,
							sql`coalesce(${unitLocalization.summary}, '') ilike ${pattern} escape '!'`,
						);
					})()
				: undefined;
			const baseCondition = and(
				eq(unitProgress.authUserId, user.id),
				isNull(unitProgress.deletedAt),
				getUnitReadCondition(authorization.profileId),
				inArray(unit.kind, ["book", "media", "software"]),
				textCondition,
			);
			const sortExpression = request.sort.startsWith("title:")
				? sql`lower(${unitLocalization.title})`
				: sql`${unitProgress.lastSeenAt}`;
			const boundaryCondition = request.boundary
				? (() => {
						const value = request.sort.startsWith("title:")
							? request.boundary.sortValue
							: new Date(request.boundary.sortValue!);
						if (value === null)
							return sql`(${sortExpression} is null and ${unitProgress.unitId} > ${request.boundary.unitId}::uuid)`;
						const comparison = request.sort.endsWith(":asc")
							? sql`${sortExpression} > ${value}`
							: sql`${sortExpression} < ${value}`;
						return sql`(
							(${sortExpression} is not null and (
								${comparison}
								or (${sortExpression} = ${value} and ${unitProgress.unitId} > ${request.boundary.unitId}::uuid)
							))
							or ${sortExpression} is null
						)`;
					})()
				: undefined;
			const condition = and(baseCondition, boundaryCondition);
			const orderBy =
				request.sort === "title:asc"
					? [sql`lower(${unitLocalization.title}) asc nulls last`, asc(unitProgress.unitId)]
					: request.sort === "title:desc"
						? [sql`lower(${unitLocalization.title}) desc nulls last`, asc(unitProgress.unitId)]
						: request.sort === "progressLastSeenAt:asc"
							? [asc(unitProgress.lastSeenAt), asc(unitProgress.unitId)]
							: [desc(unitProgress.lastSeenAt), asc(unitProgress.unitId)];
			const baseQuery = database
				.select({
					unitId: unitProgress.unitId,
					status: unitProgress.status,
					progress: unitProgress.progress,
					completedCount: unitProgress.completedCount,
					totalTimeMs: unitProgress.totalTimeMs,
					firstSeenAt: unitProgress.firstSeenAt,
					lastSeenAt: unitProgress.lastSeenAt,
					lastContentStructureNodeId: unitProgress.lastContentStructureNodeId,
					visibility: unitProgress.visibility,
					type: unit.kind,
					language: unitLocalization.language,
					title: unitLocalization.title,
					sortTitle: sql<string | null>`lower(${unitLocalization.title})`,
					summary: unitLocalization.summary,
					coverAssetId: resolvedUnitLocalizationImageAssetId(
						unit.id,
						"cover",
						body.localizationLanguages,
					),
				})
				.from(unitProgress)
				.innerJoin(unit, eq(unit.id, unitProgress.unitId))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(unit.id, body.localizationLanguages),
						),
					),
				)
				.where(condition);
			const rows = await baseQuery.orderBy(...orderBy).limit(request.pageSize + 1);
			const pageRows = rows.slice(0, request.pageSize);
			const consumed = request.consumed + pageRows.length;
			const total =
				rows.length <= request.pageSize
					? ({ kind: "exact", value: consumed } as const)
					: ({
							kind: "lower-bound",
							value: Math.max(request.total?.value ?? 0, consumed + 1),
						} as const);
			const items = pageRows.map(({ coverAssetId, sortTitle: _sortTitle, ...row }) => ({
				...row,
				type: toProgressUnitType(row.type),
				totalTimeMs: Number(row.totalTimeMs),
				lastReadAnchor: null,
				cover: presentImageAsset(coverAssetId, "cover"),
			}));
			const lastRow = pageRows.at(-1);
			return {
				items,
				total,
				...(rows.length > request.pageSize && lastRow
					? {
							nextCursor: createProgressSearchCursor(request, {
								boundary: {
									sortValue: request.sort.startsWith("title:")
										? lastRow.sortTitle
										: lastRow.lastSeenAt.toISOString(),
									unitId: lastRow.unitId,
								},
								consumed,
								total,
							}),
						}
					: {}),
			};
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
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNodeProgress.authUserId, user.id),
						eq(contentStructureNode.ownerUnitId, params.unitId),
						or(
							and(
								eq(contentStructure.kind, "book.contents"),
								eq(unit.kind, "post"),
								eq(post.kind, "chapter"),
							),
							and(
								eq(contentStructure.kind, "media.contents"),
								inArray(unit.kind, ["video", "audio"]),
							),
						),
						isNull(contentStructureNode.deletedAt),
						isNull(contentStructure.deletedAt),
						isNull(unit.deletedAt),
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
