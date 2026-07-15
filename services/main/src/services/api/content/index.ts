import { StatusCodes } from "http-status-codes";
import { and, asc, eq, isNull } from "drizzle-orm";
import Elysia from "elysia";

import { isChapterContentReadable } from "../../authorization/content/policy";
import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { contentNode, post, unit, unitCollaborator, unitLocalization } from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import {
	BookNotFound,
	ChapterLanguageNotFound,
	ChapterNotFound,
	ContentNodeNotFound,
} from "./errors";
import {
	BookContentParams,
	ChapterLocalizationParams,
	ChapterParams,
	ContentNodeParams,
	CreateContentNodeBody,
	ReadChapterQuery,
	UpdateContentNodeBody,
	UpsertChapterLocalizationBody,
} from "./schema";
import {
	ChapterDetailResponse,
	ContentNodeListResponse,
	ContentNodeResponse,
	toPortableTextResponse,
	UpdateStateResponse,
} from "../schema/response";
import { toApiErrorResponse } from "../schema/response";

const UnitForbiddenResponse = toApiErrorResponse(["UnitEditForbidden", "UnitFieldLocked"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function toContentNodeResponse(node: typeof contentNode.$inferSelect) {
	return {
		id: node.id,
		unitId: node.bookId,
		parentId: node.parentId,
		contentUnitId: node.chapterId,
		language: null,
		title: node.title,
		position: node.position,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
	};
}

export default new Elysia()
	.use(session)
	.get(
		"/units/book/:unitId/content-nodes",
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request.headers);
			if (!(await authorization.unit.canRead(params.unitId))) throw new BookNotFound();
			const canEditBook = await authorization.unit.canEdit(params.unitId);
			const rows = await database
				.select({
					id: contentNode.id,
					parentId: contentNode.parentId,
					contentUnitId: contentNode.chapterId,
					title: contentNode.title,
					position: contentNode.position,
					unitStatus: unit.status,
					unitVisibility: unit.visibility,
					contentStatus: unitLocalization.contentStatus,
				})
				.from(contentNode)
				.leftJoin(unit, eq(unit.id, contentNode.chapterId))
				.leftJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, contentNode.chapterId),
						eq(unitLocalization.isDefault, true),
					),
				)
				.where(and(eq(contentNode.bookId, params.unitId), isNull(contentNode.deletedAt)))
				.orderBy(asc(contentNode.position), asc(contentNode.id));
			return {
				items: rows
					.filter(
						(row) =>
							!row.contentUnitId ||
							isChapterContentReadable(
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
							language: null,
						}),
					),
			};
		},
		{
			params: BookContentParams,
			response: {
				[StatusCodes.OK]: ContentNodeListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["BookNotFound"]),
			},
			detail: { summary: "List book content tree", tags: ["Books"] },
		},
	)
	.post(
		"/units/book/:unitId/content-nodes",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanEdit(params.unitId);
			await authorization.unit.ensureFieldsUnlocked(params.unitId, ["/contentNodes"]);
			const node = await database.transaction(async (tx) => {
				let chapterId: string | undefined;
				if (body.content !== undefined) {
					const published = body.status === "published";
					const [chapter] = await tx
						.insert(unit)
						.values({
							kind: "post",
							status: published ? "published" : "draft",
							visibility: "public",
							publishedAt: published ? new Date() : null,
						})
						.returning({ id: unit.id });
					if (!chapter) throw new Error("Chapter insertion did not return an id");
					chapterId = chapter.id;
					await tx.insert(post).values({
						id: chapter.id,
						authorProfileId: profile.unitId,
						subjectUnitId: params.unitId,
						kind: "chapter",
					});
					await tx.insert(unitLocalization).values({
						unitId: chapter.id,
						language: body.language,
						isDefault: true,
						title: body.title,
						content: body.content,
						contentStatus: body.status ?? "draft",
					});
					await tx.insert(unitCollaborator).values({
						unitId: chapter.id,
						profileId: profile.unitId,
						role: "owner",
						addedByProfileId: profile.unitId,
					});
					await recordUnitRevision(tx, {
						unitId: chapter.id,
						actorProfileId: profile.unitId,
						event: "create",
					});
				}
				const [created] = await tx
					.insert(contentNode)
					.values({
						bookId: params.unitId,
						parentId: body.parentId,
						chapterId,
						title: body.title,
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
			return toContentNodeResponse(node);
		},
		{
			contribute: true,
			params: BookContentParams,
			body: CreateContentNodeBody,
			response: {
				[StatusCodes.OK]: ContentNodeResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Create book group or chapter", tags: ["Books"] },
		},
	)
	.patch(
		"/units/book/:unitId/content-nodes/:nodeId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanEdit(params.unitId);
			await authorization.unit.ensureFieldsUnlocked(params.unitId, ["/contentNodes"]);
			const node = await database.transaction(async (tx) => {
				const [updated] = await tx
					.update(contentNode)
					.set(body)
					.where(
						and(
							eq(contentNode.id, params.nodeId),
							eq(contentNode.bookId, params.unitId),
							isNull(contentNode.deletedAt),
						),
					)
					.returning();
				if (!updated) throw new ContentNodeNotFound();
				await recordUnitRevision(tx, {
					unitId: params.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return updated;
			});
			return toContentNodeResponse(node);
		},
		{
			contribute: true,
			params: ContentNodeParams,
			body: UpdateContentNodeBody,
			response: {
				[StatusCodes.OK]: ContentNodeResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentNodeNotFound",
				]),
			},
			detail: { summary: "Move or rename content node", tags: ["Books"] },
		},
	)
	.get(
		"/chapters/:chapterId",
		async ({ params, query, request }) => {
			const authorization = (await resolveIdentity(request.headers)).authorization;
			const [node] = await database
				.select({
					nodeId: contentNode.id,
					bookId: contentNode.bookId,
					chapterId: contentNode.chapterId,
					title: contentNode.title,
					position: contentNode.position,
				})
				.from(contentNode)
				.where(
					and(eq(contentNode.chapterId, params.chapterId), isNull(contentNode.deletedAt)),
				)
				.limit(1);
			if (!node?.chapterId || !(await authorization.unit.canRead(node.bookId)))
				throw new ChapterNotFound();
			const canEditBook = await authorization.unit.canEdit(node.bookId);
			const [content] = await database
				.select({
					language: unitLocalization.language,
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
				!isChapterContentReadable(
					canEditBook,
					content.unitStatus,
					content.unitVisibility,
					content.status,
				)
			)
				throw new ChapterLanguageNotFound();
			const siblings = await database
				.select({
					id: contentNode.chapterId,
					position: contentNode.position,
					unitStatus: unit.status,
					unitVisibility: unit.visibility,
					contentStatus: unitLocalization.contentStatus,
				})
				.from(contentNode)
				.innerJoin(unit, eq(unit.id, contentNode.chapterId))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, contentNode.chapterId),
						eq(unitLocalization.language, query.language),
					),
				)
				.where(and(eq(contentNode.bookId, node.bookId), isNull(contentNode.deletedAt)))
				.orderBy(asc(contentNode.position), asc(contentNode.id));
			const readable = siblings.filter((item) =>
				isChapterContentReadable(
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
