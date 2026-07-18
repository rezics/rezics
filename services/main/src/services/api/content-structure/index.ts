import { StatusCodes } from "http-status-codes";
import { and, asc, eq, isNull } from "drizzle-orm";
import Elysia from "elysia";

import { isContentStructureNodeReadable } from "../../authorization/content-structure/policy";
import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	contentStructureNode,
	post,
	unit,
	unitCollaborator,
	unitLocalization,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import {
	BookNotFound,
	ChapterLanguageNotFound,
	ChapterNotFound,
	ContentStructureNodeNotFound,
} from "./errors";
import {
	BookContentStructureParams,
	ChapterLocalizationParams,
	ChapterParams,
	ContentStructureNodeParams,
	CreateContentStructureNodeBody,
	ReadChapterQuery,
	UpdateContentStructureNodeBody,
	UpsertChapterLocalizationBody,
} from "./schema";
import {
	ChapterDetailResponse,
	ContentStructureNodeListResponse,
	ContentStructureNodeResponse,
	toPortableTextResponse,
	UpdateStateResponse,
} from "../schema/response";
import { toApiErrorResponse } from "../schema/response";

const UnitForbiddenResponse = toApiErrorResponse(["UnitEditForbidden", "UnitFieldLocked"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function toContentStructureNodeResponse(
	node: typeof contentStructureNode.$inferSelect,
	language: string,
	title: string,
	contentKind: "chapter" | "chapter_group",
) {
	return {
		id: node.id,
		unitId: node.ownerUnitId,
		parentId: node.parentId,
		contentUnitId: node.contentUnitId,
		contentKind,
		language,
		title,
		position: node.position,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
	};
}

export default new Elysia()
	.use(session)
	.get(
		"/units/book/:unitId/content-structure/nodes",
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request.headers);
			if (!(await authorization.unit.canRead(params.unitId))) throw new BookNotFound();
			const canEditBook = await authorization.unit.canEdit(params.unitId);
			const rows = await database
				.select({
					id: contentStructureNode.id,
					parentId: contentStructureNode.parentId,
					contentUnitId: contentStructureNode.contentUnitId,
					contentKind: post.kind,
					language: unitLocalization.language,
					title: unitLocalization.title,
					position: contentStructureNode.position,
					unitStatus: unit.status,
					unitVisibility: unit.visibility,
					contentStatus: unitLocalization.contentStatus,
				})
				.from(contentStructureNode)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
						eq(unitLocalization.isDefault, true),
					),
				)
				.where(
					and(
						eq(contentStructureNode.ownerUnitId, params.unitId),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
			return {
				items: rows
					.filter((row) =>
						isContentStructureNodeReadable(
							canEditBook,
							row.unitStatus,
							row.unitVisibility,
							row.contentStatus,
						),
					)
					.map(
						({
							unitStatus: _status,
							unitVisibility: _visibility,
							contentStatus: _contentStatus,
							...node
						}) => ({
							...node,
							contentKind:
								node.contentKind === "chapter" ? "chapter" : "chapter_group",
							title: node.title ?? "",
						}),
					),
			};
		},
		{
			params: BookContentStructureParams,
			response: {
				[StatusCodes.OK]: ContentStructureNodeListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["BookNotFound"]),
			},
			detail: {
				summary: "List book Content Structure nodes",
				tags: ["Content Structure"],
			},
		},
	)
	.post(
		"/units/book/:unitId/content-structure/nodes",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanEdit(params.unitId);
			await authorization.unit.ensureFieldsUnlocked(params.unitId, [
				"/contentStructureNodes",
			]);
			const node = await database.transaction(async (tx) => {
				const hasContent = body.content !== undefined;
				const published = hasContent ? body.status === "published" : true;
				const [contentUnit] = await tx
					.insert(unit)
					.values({
						kind: "post",
						status: published ? "published" : "draft",
						visibility: "public",
						publishedAt: published ? new Date() : null,
					})
					.returning({ id: unit.id });
				if (!contentUnit) throw new Error("Content Unit insertion did not return an id");
				await tx.insert(post).values({
					id: contentUnit.id,
					authorProfileId: profile.unitId,
					subjectUnitId: params.unitId,
					kind: hasContent ? "chapter" : "chapter_group",
				});
				await tx.insert(unitLocalization).values({
					unitId: contentUnit.id,
					language: body.language,
					isDefault: true,
					title: body.title,
					content: body.content,
					contentStatus: hasContent ? (body.status ?? "draft") : undefined,
				});
				await tx.insert(unitCollaborator).values({
					unitId: contentUnit.id,
					profileId: profile.unitId,
					role: "owner",
					addedByProfileId: profile.unitId,
				});
				await recordUnitRevision(tx, {
					unitId: contentUnit.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				const [created] = await tx
					.insert(contentStructureNode)
					.values({
						ownerUnitId: params.unitId,
						parentId: body.parentId,
						contentUnitId: contentUnit.id,
						position: body.position,
					})
					.returning();
				if (!created) throw new Error("Content node insertion did not return a row");
				await recordUnitRevision(tx, {
					unitId: params.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return created;
			});
			return toContentStructureNodeResponse(
				node,
				body.language,
				body.title,
				body.content !== undefined ? "chapter" : "chapter_group",
			);
		},
		{
			contribute: true,
			params: BookContentStructureParams,
			body: CreateContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Create book group or chapter", tags: ["Books"] },
		},
	)
	.patch(
		"/units/book/:unitId/content-structure/nodes/:nodeId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanEdit(params.unitId);
			await authorization.unit.ensureFieldsUnlocked(params.unitId, [
				"/contentStructureNodes",
			]);
			const node = await database.transaction(async (tx) => {
				const condition = and(
					eq(contentStructureNode.id, params.nodeId),
					eq(contentStructureNode.ownerUnitId, params.unitId),
					isNull(contentStructureNode.deletedAt),
				);
				const [updated] =
					body.parentId !== undefined || body.position !== undefined
						? await tx
								.update(contentStructureNode)
								.set({ parentId: body.parentId, position: body.position })
								.where(condition)
								.returning()
						: await tx.select().from(contentStructureNode).where(condition).limit(1);
				if (!updated) throw new ContentStructureNodeNotFound();
				if (body.title !== undefined) {
					const localized = await tx
						.update(unitLocalization)
						.set({ title: body.title })
						.where(
							and(
								eq(unitLocalization.unitId, updated.contentUnitId),
								eq(unitLocalization.isDefault, true),
							),
						)
						.returning({ unitId: unitLocalization.unitId });
					if (!localized.length) throw new ContentStructureNodeNotFound();
					await recordUnitRevision(tx, {
						unitId: updated.contentUnitId,
						actorProfileId: profile.unitId,
						event: "update",
					});
				}
				await recordUnitRevision(tx, {
					unitId: params.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return updated;
			});
			const [localization] = await database
				.select({
					language: unitLocalization.language,
					title: unitLocalization.title,
					contentKind: post.kind,
				})
				.from(unitLocalization)
				.innerJoin(post, eq(post.id, unitLocalization.unitId))
				.where(
					and(
						eq(unitLocalization.unitId, node.contentUnitId),
						eq(unitLocalization.isDefault, true),
					),
				)
				.limit(1);
			if (
				!localization?.title ||
				(localization.contentKind !== "chapter" &&
					localization.contentKind !== "chapter_group")
			)
				throw new ContentStructureNodeNotFound();
			return toContentStructureNodeResponse(
				node,
				localization.language,
				localization.title,
				localization.contentKind,
			);
		},
		{
			contribute: true,
			params: ContentStructureNodeParams,
			body: UpdateContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
			},
			detail: {
				summary: "Move or rename Content Structure node",
				tags: ["Content Structure"],
			},
		},
	)
	.get(
		"/chapters/:chapterId",
		async ({ params, query, request }) => {
			const authorization = (await resolveIdentity(request.headers)).authorization;
			const [node] = await database
				.select({
					nodeId: contentStructureNode.id,
					bookId: contentStructureNode.ownerUnitId,
					chapterId: contentStructureNode.contentUnitId,
					position: contentStructureNode.position,
				})
				.from(contentStructureNode)
				.where(
					and(
						eq(contentStructureNode.contentUnitId, params.chapterId),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.limit(1);
			if (!node?.chapterId || !(await authorization.unit.canRead(node.bookId)))
				throw new ChapterNotFound();
			const canEditBook = await authorization.unit.canEdit(node.bookId);
			const [content] = await database
				.select({
					language: unitLocalization.language,
					title: unitLocalization.title,
					content: unitLocalization.content,
					status: unitLocalization.contentStatus,
					updatedAt: unitLocalization.updatedAt,
					unitStatus: unit.status,
					unitVisibility: unit.visibility,
				})
				.from(unitLocalization)
				.innerJoin(unit, eq(unit.id, unitLocalization.unitId))
				.where(
					and(
						eq(unitLocalization.unitId, params.chapterId),
						eq(unitLocalization.language, query.language),
					),
				)
				.limit(1);
			if (
				!content?.content ||
				!content.status ||
				!isContentStructureNodeReadable(
					canEditBook,
					content.unitStatus,
					content.unitVisibility,
					content.status,
				)
			)
				throw new ChapterLanguageNotFound();
			const siblings = await database
				.select({
					id: contentStructureNode.contentUnitId,
					position: contentStructureNode.position,
					unitStatus: unit.status,
					unitVisibility: unit.visibility,
					contentStatus: unitLocalization.contentStatus,
				})
				.from(contentStructureNode)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
						eq(unitLocalization.language, query.language),
					),
				)
				.where(
					and(
						eq(contentStructureNode.ownerUnitId, node.bookId),
						eq(post.kind, "chapter"),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
			const readable = siblings.filter((item) =>
				isContentStructureNodeReadable(
					canEditBook,
					item.unitStatus,
					item.unitVisibility,
					item.contentStatus,
				),
			);
			const index = readable.findIndex((item) => item.id === params.chapterId);
			return {
				...node,
				chapterId: node.chapterId,
				title: content.title ?? "",
				language: content.language,
				content: toPortableTextResponse(content.content),
				status: content.status,
				updatedAt: content.updatedAt,
				previousChapterId: index > 0 ? (readable[index - 1]?.id ?? null) : null,
				nextChapterId: index >= 0 ? (readable[index + 1]?.id ?? null) : null,
			};
		},
		{
			params: ChapterParams,
			query: ReadChapterQuery,
			response: {
				[StatusCodes.OK]: ChapterDetailResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"ChapterNotFound",
					"ChapterLanguageNotFound",
				]),
			},
			detail: { summary: "Read chapter", tags: ["Books"] },
		},
	)
	.put(
		"/chapters/:chapterId/localizations/:language/content",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanEdit(params.chapterId);
			await authorization.unit.ensureFieldsUnlocked(params.chapterId, [
				`/localizations/${params.language}`,
			]);
			await database.transaction(async (tx) => {
				await tx
					.insert(unitLocalization)
					.values({
						unitId: params.chapterId,
						language: params.language,
						title: body.title,
						content: body.content,
						contentStatus: body.status,
					})
					.onConflictDoUpdate({
						target: [unitLocalization.unitId, unitLocalization.language],
						set: {
							title: body.title,
							content: body.content,
							contentStatus: body.status,
						},
					});
				await recordUnitRevision(tx, {
					unitId: params.chapterId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return { updated: true };
		},
		{
			contribute: true,
			params: ChapterLocalizationParams,
			body: UpsertChapterLocalizationBody,
			response: {
				[StatusCodes.OK]: UpdateStateResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Create or replace chapter content", tags: ["Books"] },
		},
	);
