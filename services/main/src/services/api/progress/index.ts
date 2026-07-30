import { StatusCodes } from "http-status-codes";
import { FilterSchemaModels } from "@rezics/filter";
import { and, asc, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

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
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import {
	CompleteProgressBody,
	CreateProgressEntryBody,
	ListProgressQuery,
	ListProgressEntriesQuery,
	ProgressEntryParams,
	ProgressLookupResponse,
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
import { Uuid } from "../schema";
import {
	createProgressEntry,
	deleteProgressEntry,
	lockUnitProgress,
	recordMediaNodeCompletion,
	recordChapterReading,
	replaceProgressEntry,
} from "./service";
import { presentImageAsset } from "../../units/service";
import { createProgressSearchCursor, resolveProgressSearchRequest } from "./search";

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
		node.unitKind === "post" &&
		node.postKind === "chapter"
	)
		return "book";
	if (
		node?.structureKind === "media.contents" &&
		(node.unitKind === "video" || node.unitKind === "audio")
	)
		return "media";
	return null;
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
		affectsCurrent: boolean;
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
	const { contentStructureNodeId, deletedAt: _deletedAt, ...rest } = row;
	return {
		...rest,
		lastContentStructureNodeId: contentStructureNodeId,
		reviewId: row.reviewId ?? null,
		totalTimeMs: Number(row.totalTimeMs),
	};
}

const ProgressEntryCursor = t.Object(
	{
		v: t.Literal(1),
		occurredAt: t.Nullable(t.String({ format: "date-time" })),
		createdAt: t.String({ format: "date-time" }),
		id: Uuid,
	},
	{ additionalProperties: false },
);
type ProgressEntryCursor = typeof ProgressEntryCursor.static;

function decodeProgressEntryCursor(value?: string): ProgressEntryCursor | undefined {
	if (!value) return undefined;
	try {
		return parseJsonCursor(value, ProgressEntryCursor);
	} catch {
		throw new InvalidPaginationCursor();
	}
}

function encodeProgressEntryCursor(value: ProgressEntryCursor): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function progressEntryCursorCondition(cursor: ProgressEntryCursor | undefined) {
	if (!cursor) return undefined;
	const createdAt = new Date(cursor.createdAt);
	if (cursor.occurredAt === null)
		return and(
			isNull(unitProgressEntry.occurredAt),
			or(
				lt(unitProgressEntry.createdAt, createdAt),
				and(
					eq(unitProgressEntry.createdAt, createdAt),
					lt(unitProgressEntry.id, cursor.id),
				),
			),
		);
	const occurredAt = new Date(cursor.occurredAt);
	return or(
		lt(unitProgressEntry.occurredAt, occurredAt),
		and(
			eq(unitProgressEntry.occurredAt, occurredAt),
			or(
				lt(unitProgressEntry.createdAt, createdAt),
				and(
					eq(unitProgressEntry.createdAt, createdAt),
					lt(unitProgressEntry.id, cursor.id),
				),
			),
		),
		isNull(unitProgressEntry.occurredAt),
	);
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
			const condition = and(
				eq(unitProgress.profileId, profile.unitId),
				isNull(unitProgress.deletedAt),
				getUnitReadCondition(profile.unitId),
				inArray(unit.kind, ["book", "media", "software"]),
				textCondition,
			);
			const orderBy =
				request.sort === "title:asc"
					? [
							sql`lower(${unitLocalization.title}) asc nulls last`,
							asc(unitProgress.unitId),
						]
					: request.sort === "title:desc"
						? [
								sql`lower(${unitLocalization.title}) desc nulls last`,
								asc(unitProgress.unitId),
							]
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
			const countQuery = database
				.select({ value: count() })
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
			const [rows, [countRow]] = await Promise.all([
				baseQuery
					.orderBy(...orderBy)
					.offset(request.offset)
					.limit(request.pageSize + 1),
				countQuery,
			]);
			const total = countRow?.value ?? 0;
			const items = rows.slice(0, request.pageSize).map(({ coverAssetId, ...row }) => ({
				...row,
				type: toProgressUnitType(row.type),
				totalTimeMs: Number(row.totalTimeMs),
				lastReadAnchor: null,
				cover: presentImageAsset(coverAssetId, "cover"),
			}));
			const nextOffset = request.offset + items.length;
			return {
				items,
				total,
				...(rows.length > request.pageSize
					? {
							nextCursor: createProgressSearchCursor(request, nextOffset),
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
			const cursor = decodeProgressEntryCursor(query.cursor);
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
					affectsCurrent: unitProgressEntry.affectsCurrent,
					reviewId: postProgressEntry.postId,
					createdAt: unitProgressEntry.createdAt,
					updatedAt: unitProgressEntry.updatedAt,
				})
				.from(unitProgressEntry)
				.leftJoin(
					postProgressEntry,
					eq(postProgressEntry.progressEntryId, unitProgressEntry.id),
				)
				.where(
					and(
						eq(unitProgressEntry.profileId, profile.unitId),
						eq(unitProgressEntry.unitId, params.unitId),
						isNull(unitProgressEntry.deletedAt),
						query.status ? eq(unitProgressEntry.status, query.status) : undefined,
						progressEntryCursorCondition(cursor),
					),
				)
				.orderBy(
					sql`${unitProgressEntry.occurredAt} desc nulls last`,
					desc(unitProgressEntry.createdAt),
					desc(unitProgressEntry.id),
				)
				.limit(limit + 1);
			const page = rows.slice(0, limit);
			const last = page.at(-1);
			return {
				items: page.map(toProgressEntryResponse),
				nextCursor:
					rows.length > limit && last
						? encodeProgressEntryCursor({
								v: 1,
								occurredAt: last.occurredAt?.toISOString() ?? null,
								createdAt: last.createdAt.toISOString(),
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
					affectsCurrent: body.affectsCurrent ?? false,
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
					affectsCurrent: body.affectsCurrent ?? false,
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
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ProgressEntryNotFound",
				]),
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
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
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
						and(
							eq(unitProgress.profileId, profile.unitId),
							eq(unitProgress.unitId, params.unitId),
						),
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
			const nodeKind = await findCompletableContentStructureNode(
				params.unitId,
				params.nodeId,
			);
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
			const nodeKind = await findCompletableContentStructureNode(
				params.unitId,
				params.nodeId,
			);
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
