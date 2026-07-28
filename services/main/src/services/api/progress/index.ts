import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { getUnitReadCondition } from "../../authorization/unit/query";
import session from "../../auth/session";
import { database } from "../../database";
import { resolvedUnitLocalizationLanguage } from "../../units/localization";
import {
	contentStructure,
	contentStructureNodeProgress,
	contentStructureNode,
	postProgressEntry,
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
	ImportProgressBody,
	ListProgressQuery,
	ListProgressEntriesQuery,
	ProgressEntryParams,
	ProgressLookupResponse,
	ProgressNodeParams,
	ProgressUnitParams,
	ReplaceProgressEntryBody,
	UpsertProgressBody,
} from "./schema";
import {
	CompletionStateResponse,
	ImportProgressResponse,
	ProgressEntryListResponse,
	ProgressEntryResponse,
	ProgressListResponse,
	ProgressNodeListResponse,
	ProgressResponse,
} from "../schema/response";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { Uuid } from "../schema";
import {
	createProgressEntry,
	deleteProgressEntry,
	lockUnitProgress,
	refreshProgressSnapshot,
	replaceProgressEntry,
} from "./service";

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
		sourceExternalId: string | null;
		sourceKind: string;
		sourceProvider: string | null;
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
		"/import",
		async ({ profile, authorization, body }) => {
			const unitIds = [...new Set(body.items.map((item) => item.unitId))].sort();
			await Promise.all(unitIds.map((unitId) => authorization.unit.ensureCanRead(unitId)));
			const entryIds = await database.transaction(async (tx) => {
				for (const unitId of unitIds) await lockUnitProgress(tx, profile.unitId, unitId);
				const ids: string[] = [];
				const preferredCurrentEntryByUnitId = new Map<string, string>();
				for (const item of body.items) {
					const entry = await createProgressEntry(
						tx,
						profile.unitId,
						item.unitId,
						{
							entryKind: item.entryKind,
							status: item.status,
							progress: item.progress,
							totalTimeMs: item.totalTimeMs,
							lastContentStructureNodeId: item.lastContentStructureNodeId,
							occurredAt: item.occurredAt,
							datePrecision: item.datePrecision,
							sourceKind: "import",
							sourceProvider: body.sourceProvider,
							sourceExternalId: item.sourceExternalId,
							affectsCurrent: item.affectsCurrent ?? false,
						},
						{ refreshSnapshot: false },
					);
					ids.push(entry.id);
					if (entry.affectsCurrent)
						preferredCurrentEntryByUnitId.set(item.unitId, entry.id);
				}
				for (const unitId of unitIds)
					await refreshProgressSnapshot(
						tx,
						profile.unitId,
						unitId,
						preferredCurrentEntryByUnitId.get(unitId),
					);
				return ids;
			});
			return { createdCount: entryIds.length, entryIds };
		},
		{
			access: "write:interaction:write",
			body: ImportProgressBody,
			response: {
				[StatusCodes.OK]: ImportProgressResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
			},
			detail: { summary: "Import Progress journal entries", tags: ["Progress"] },
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
					sourceKind: unitProgressEntry.sourceKind,
					sourceProvider: unitProgressEntry.sourceProvider,
					sourceExternalId: unitProgressEntry.sourceExternalId,
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
					sourceKind: body.sourceKind ?? "manual",
					sourceProvider: body.sourceProvider,
					sourceExternalId: body.sourceExternalId,
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
					sourceKind: body.sourceKind ?? "manual",
					sourceProvider: body.sourceProvider,
					sourceExternalId: body.sourceExternalId,
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
					sourceKind: "rezics",
					affectsCurrent: true,
				});
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
					sourceKind: "rezics",
					affectsCurrent: true,
				});
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
					.set({ currentEntryId: null, deletedAt: now, lastSeenAt: now })
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
