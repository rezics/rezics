import { StatusCodes } from "http-status-codes";
import { FilterSchemaModels, SearchFeatureDefinition } from "@rezics/filter";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia from "elysia";

import { getUnitReadCondition } from "../../authorization/unit/query";
import session from "../../auth/session";
import { database } from "../../database";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
} from "../../units/localization";
import {
	contentStructure,
	contentStructureNodeProgress,
	contentStructureNode,
	postProgressEntry,
	post,
	unitLocalization,
	unit,
	unitProgress,
	unitProgressEntry,
} from "../../database/schema";
import { ContentStructureNodeNotFound } from "../content-structure/errors";
import { ContentStructureKindPolicies } from "../../content-structure/contracts";
import {
	CompleteProgressBody,
	CreateProgressEntryBody,
	ListProgressQuery,
	ListProgressEntriesQuery,
	ProgressEntryParams,
	ProgressLookupResponse,
	type ProgressContinuationResponse,
	ProgressNodeParams,
	ProgressSearchBody,
	ProgressUnitParams,
	ReplaceProgressEntryBody,
	UpsertProgressBody,
} from "./schema";
import {
	CompletionStateResponse,
	ChapterReadingProgressResponse,
	ProgressEntryListResponse,
	ProgressEntryResponse,
	ProgressListResponse,
	ProgressNodeListResponse,
	ProgressResponse,
	ProgressSearchResponse,
} from "../schema/response";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	createProgressEntry,
	deleteProgressEntry,
	lockUnitProgress,
	recordMediaNodeCompletion,
	recordChapterReading,
	replaceProgressEntry,
	setCurrentProgressEntry,
} from "./service";
import { presentImageAsset } from "../../units/service";
import {
	decodeProgressEntryCursor,
	encodeProgressEntryCursor,
	progressEntryCursorCondition,
	progressEntryOrderBy,
	resolveProgressEntrySortAt,
} from "./pagination";
import {
	createProgressSearchCursor,
	getProgressSearchDefinition,
	resolveProgressSearchRequest,
} from "./search";

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
		profileId: string;
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

async function selectProgressSnapshot(profileId: string, unitId: string) {
	const [progress] = await database
		.select()
		.from(unitProgress)
		.where(
			and(
				eq(unitProgress.profileId, profileId),
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
	.model(FilterSchemaModels)
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
	.get("/search/filter", () => getProgressSearchDefinition(), {
		access: "interaction:read",
		response: { [StatusCodes.OK]: SearchFeatureDefinition },
		detail: {
			summary: "Get the Progress Filter definition",
			tags: ["Progress", "Search"],
		},
	})
	.post(
		"/search",
		async ({ profile, body }) => {
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
				eq(unitProgress.profileId, profile.unitId),
				isNull(unitProgress.deletedAt),
				getUnitReadCondition(profile.unitId),
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
		{
			access: "interaction:read",
			params: ProgressUnitParams,
			response: {
				[StatusCodes.OK]: ProgressLookupResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Get progress state", tags: ["Progress"] },
		},
	)
	.get(
		"/:unitId/entries",
		async ({ profile, authorization, params, query }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const cursorScope = { unitId: params.unitId, status: query.status };
			const cursor = decodeProgressEntryCursor(query.cursor, cursorScope);
			const limit = query.limit ?? 30;
			const rows = await database
				.select({
					id: unitProgressEntry.id,
					profileId: unitProgressEntry.profileId,
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
						eq(unitProgressEntry.profileId, profile.unitId),
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
	)
	.post(
		"/:unitId/entries",
		async ({ profile, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const entry = await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				return createProgressEntry(tx, profile.unitId, params.unitId, {
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
	)
	.put(
		"/:unitId/entries/:entryId",
		async ({ profile, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const entry = await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				return replaceProgressEntry(tx, profile.unitId, params.unitId, params.entryId, {
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
	)
	.put(
		"/:unitId/entries/:entryId/current",
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				await setCurrentProgressEntry(tx, profile.unitId, params.unitId, params.entryId);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
	)
	.delete(
		"/:unitId/entries/:entryId",
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				await deleteProgressEntry(tx, profile.unitId, params.unitId, params.entryId);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
				.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNodeProgress.profileId, profile.unitId),
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
	.post(
		"/:unitId/nodes/:nodeId/read",
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const canReadUnpublished = await authorization.unit.canUpdate(params.unitId);
			const result = await database.transaction((tx) =>
				recordChapterReading(tx, {
					canReadUnpublished,
					nodeId: params.nodeId,
					now: new Date(),
					profileId: profile.unitId,
					unitId: params.unitId,
				}),
			);
			return {
				completed: true as const,
				journalEntryCreated: result.journalEntryCreated,
				record: toProgressResponse(result.record),
			};
		},
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
	)
	.put(
		"/:unitId",
		async ({ profile, authorization, params, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			const now = new Date();
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				await createProgressEntry(tx, profile.unitId, params.unitId, {
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
								eq(unitProgress.profileId, profile.unitId),
								eq(unitProgress.unitId, params.unitId),
								isNull(unitProgress.deletedAt),
							),
						);
			});
			return selectProgressSnapshot(profile.unitId, params.unitId);
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
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				await createProgressEntry(tx, profile.unitId, params.unitId, {
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
								eq(unitProgress.profileId, profile.unitId),
								eq(unitProgress.unitId, params.unitId),
								isNull(unitProgress.deletedAt),
							),
						);
			});
			return selectProgressSnapshot(profile.unitId, params.unitId);
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
		async ({ profile, authorization, params }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database.transaction(async (tx) => {
				await lockUnitProgress(tx, profile.unitId, params.unitId);
				const now = new Date();
				const entries = await tx
					.select({ id: unitProgressEntry.id })
					.from(unitProgressEntry)
					.where(
						and(
							eq(unitProgressEntry.profileId, profile.unitId),
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
					.where(
						and(eq(unitProgress.profileId, profile.unitId), eq(unitProgress.unitId, params.unitId)),
					);
				await tx
					.update(unitProgressEntry)
					.set({ deletedAt: now, updatedAt: now })
					.where(
						and(
							eq(unitProgressEntry.profileId, profile.unitId),
							eq(unitProgressEntry.unitId, params.unitId),
							isNull(unitProgressEntry.deletedAt),
						),
					);
			});
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
						profileId: profile.unitId,
						unitId: params.unitId,
					}),
				);
				return { completed: true };
			}
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
		async ({ profile, authorization, params }) => {
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
						profileId: profile.unitId,
						unitId: params.unitId,
					}),
				);
				return { completed: false };
			}
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
			response: {
				[StatusCodes.OK]: CompletionStateResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
			},
			detail: { summary: "Uncomplete Content Structure node", tags: ["Progress"] },
		},
	);
