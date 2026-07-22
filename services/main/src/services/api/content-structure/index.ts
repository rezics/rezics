import { StatusCodes } from "http-status-codes";
import { and, asc, eq, isNull } from "drizzle-orm";
import Elysia from "elysia";
import type { ContentLanguage } from "@rezics/i18n";

import { isContentStructureNodeReadable } from "../../authorization/content-structure/policy";
import session, { resolveIdentity } from "../../auth/session";
import { database, type DatabaseTransaction } from "../../database";
import { isPrimaryUnitLocalization } from "../../units/localization";
import {
	contentStructure,
	contentStructureNode,
	label,
	post,
	unit,
	unitAccessBinding,
	unitLocalization,
	zonePage,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import {
	createContentStructure,
	deleteContentStructure,
	deleteContentStructureNode,
	getContentStructureRevision,
	insertContentStructureNode,
	listContentStructures,
	updateContentStructureNode,
} from "../../content-structure/service";
import {
	loadContentStructureSnapshot,
	contentStructureTargetFromRow,
} from "../../content-structure/storage";
import { insertUnit } from "../../units/create";
import { ensureSubjectPostTargetingAllowed } from "../../posts/targeting";
import {
	BookNotFound,
	ChapterLanguageNotFound,
	ChapterNotFound,
	ContentStructureNodeNotFound,
} from "./errors";
import { ContentStructureNotFound } from "../../content-structure/errors";
import {
	BookContentStructureParams,
	ChapterLocalizationParams,
	ChapterParams,
	ContentStructureNodeParams,
	CreateContentStructureNodeBody,
	ReadChapterQuery,
	UpdateContentStructureNodeBody,
	UpsertChapterLocalizationBody,
	ContentStructureParams,
	ContentStructureRevisionBody,
	CreateContentStructureBody,
	CreateGenericContentStructureNodeBody,
	GenericContentStructureNodeParams,
	UnitContentStructuresParams,
	UpdateGenericContentStructureNodeBody,
	ContentStructureRevisionParams,
	ContentStructureRevisionListQuery,
	RestoreContentStructureRevisionBody,
} from "./schema";
import {
	ChapterDetailResponse,
	ContentStructureNodeListResponse,
	ContentStructureNodeResponse,
	toPortableTextResponse,
	UpdateStateResponse,
	ContentStructureDetailResponse,
	ContentStructureListResponse,
	ContentStructureMutationResponse,
	ContentStructureNodeMutationResponse,
	ContentStructureDeleteResponse,
	ContentStructureRevisionListResponse,
} from "../schema/response";
import {
	listContentStructureRevisions,
	restoreContentStructureRevision,
} from "../../content-structure/history";
import { toApiErrorResponse } from "../schema/response";

const UnitForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden", "UnitProtected"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

async function presentGenericContentStructureNode(node: typeof contentStructureNode.$inferSelect) {
	const storedTarget = contentStructureTargetFromRow(node);
	const target =
		storedTarget.kind === "zone_page"
			? await (async () => {
					const [page] = await database
						.select({ zoneId: zonePage.zoneId, slug: zonePage.slug })
						.from(zonePage)
						.where(eq(zonePage.id, storedTarget.zonePageId))
						.limit(1);
					if (!page) throw new ContentStructureNotFound();
					return { ...storedTarget, ...page };
				})()
			: storedTarget;
	return {
		id: node.id,
		structureId: node.structureId,
		ownerUnitId: node.ownerUnitId,
		parentId: node.parentId,
		contentUnitId: node.contentUnitId,
		documentKey: node.documentKey,
		target,
		position: node.position,
		contentRating: node.contentRating,
		searchConfiguration: node.searchConfiguration,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
	};
}

function presentContentStructure(
	structure: typeof contentStructure.$inferSelect,
	latestRevisionId: string | null,
) {
	return {
		id: structure.id,
		ownerUnitId: structure.ownerUnitId,
		kind: structure.kind,
		documentKey: structure.documentKey,
		latestRevisionId,
		createdAt: structure.createdAt,
		updatedAt: structure.updatedAt,
	};
}

async function ensureContentStructureOwner(
	tx: DatabaseTransaction,
	unitId: string,
	structureId: string,
): Promise<void> {
	const [owned] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(and(eq(contentStructure.id, structureId), eq(contentStructure.ownerUnitId, unitId)))
		.limit(1);
	if (!owned) throw new ContentStructureNotFound();
}

function toContentStructureNodeResponse(
	node: typeof contentStructureNode.$inferSelect,
	language: ContentLanguage,
	title: string,
	contentKind: "chapter" | "chapter_group",
	latestRevisionId: string,
) {
	return {
		id: node.id,
		unitId: node.ownerUnitId,
		structureId: node.structureId,
		latestRevisionId,
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
		"/units/by-id/:unitId/content-structures",
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				const structures = await listContentStructures(tx, params.unitId);
				const items = [];
				for (const structure of structures) {
					items.push(
						presentContentStructure(
							structure,
							await getContentStructureRevision(tx, params.unitId, structure.id),
						),
					);
				}
				return { items };
			});
		},
		{
			params: UnitContentStructuresParams,
			response: {
				[StatusCodes.OK]: ContentStructureListResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit Content Structures", tags: ["Content Structure"] },
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["content-structure"]]);
			const result = await database.transaction((tx) =>
				createContentStructure(tx, {
					ownerUnitId: params.unitId,
					kind: body.kind,
					actorProfileId: profile.unitId,
				}),
			);
			return {
				structure: presentContentStructure(result.structure, result.revisionId),
				revisionCreated: result.revisionCreated,
			};
		},
		{
			access: "contribute:unit:update",
			params: UnitContentStructuresParams,
			body: CreateContentStructureBody,
			response: {
				[StatusCodes.OK]: ContentStructureMutationResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Create Content Structure", tags: ["Content Structure"] },
		},
	)
	.get(
		"/units/by-id/:unitId/content-structures/:structureId",
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				const snapshot = await loadContentStructureSnapshot(tx, {
					structureId: params.structureId,
					ownerUnitId: params.unitId,
				});
				const latestRevisionId = await getContentStructureRevision(
					tx,
					params.unitId,
					params.structureId,
				);
				return {
					...presentContentStructure(snapshot.structure, latestRevisionId),
					nodes: await Promise.all(
						snapshot.nodes.map(presentGenericContentStructureNode),
					),
				};
			});
		},
		{
			params: ContentStructureParams,
			response: {
				[StatusCodes.OK]: ContentStructureDetailResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
			},
			detail: { summary: "Get Content Structure", tags: ["Content Structure"] },
		},
	)
	.get(
		"/units/by-id/:unitId/content-structures/:structureId/revisions",
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				await ensureContentStructureOwner(tx, params.unitId, params.structureId);
				return {
					items: await listContentStructureRevisions(
						tx,
						params.structureId,
						query.limit ?? 50,
					),
				};
			});
		},
		{
			params: ContentStructureParams,
			query: ContentStructureRevisionListQuery,
			response: {
				[StatusCodes.OK]: ContentStructureRevisionListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
			},
			detail: { summary: "List Content Structure revisions", tags: ["Content Structure"] },
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures/:structureId/revisions/:revisionId/restore",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [
				["content-structure", params.structureId],
			]);
			const result = await database.transaction(async (tx) => {
				await ensureContentStructureOwner(tx, params.unitId, params.structureId);
				return restoreContentStructureRevision(tx, {
					structureId: params.structureId,
					sourceRevisionId: params.revisionId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					message: body.message,
					minor: body.minor,
				});
			});
			return {
				updated: true as const,
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
		{
			access: "contribute:unit:update",
			params: ContentStructureRevisionParams,
			body: RestoreContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
			},
			detail: {
				summary: "Restore a Content Structure revision",
				tags: ["Content Structure"],
			},
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures/:structureId/nodes",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [
				["content-structure", params.structureId],
			]);
			if (body.content.kind === "unit")
				await authorization.unit.ensureCanRead(body.content.unitId);
			if (body.target?.kind === "unit")
				await authorization.unit.ensureCanRead(body.target.unitId);
			const result = await database.transaction(async (tx) => {
				let contentUnitId: string;
				if (body.content.kind === "unit") contentUnitId = body.content.unitId;
				else {
					const created = await insertUnit(tx, {
						kind: "label",
						status: "published",
						visibility: "public",
						publishedAt: new Date(),
						statusActor: { kind: "profile", profileId: profile.unitId },
					});
					await tx.insert(label).values({ id: created.id });
					await tx.insert(unitLocalization).values({
						unitId: created.id,
						language: body.content.language,
						title: body.content.title,
					});
					await tx.insert(unitAccessBinding).values({
						unitId: created.id,
						subjectKind: "profile",
						profileId: profile.unitId,
						role: "owner",
						scope: [],
						grantedByProfileId: profile.unitId,
					});
					await recordUnitRevision(tx, {
						unitId: created.id,
						actorProfileId: profile.unitId,
						event: "create",
					});
					contentUnitId = created.id;
				}
				return insertContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					parentId: body.parentId,
					contentUnitId,
					documentKey: body.documentKey,
					target: body.target,
					position: body.position,
					contentRating: body.contentRating,
					searchConfiguration: body.searchConfiguration,
				});
			});
			return {
				node: await presentGenericContentStructureNode(result.node),
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
		{
			access: "contribute:unit:update",
			params: ContentStructureParams,
			body: CreateGenericContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeMutationResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Insert Content Structure node", tags: ["Content Structure"] },
		},
	)
	.patch(
		"/units/by-id/:unitId/content-structures/:structureId/nodes/:nodeId",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [
				["content-structure", params.structureId],
			]);
			if (body.contentUnitId) await authorization.unit.ensureCanRead(body.contentUnitId);
			if (body.target?.kind === "unit")
				await authorization.unit.ensureCanRead(body.target.unitId);
			const result = await database.transaction((tx) =>
				updateContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					nodeId: params.nodeId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					parentId: body.parentId,
					contentUnitId: body.contentUnitId,
					documentKey: body.documentKey,
					target: body.target,
					position: body.position,
					contentRating: body.contentRating,
					searchConfiguration: body.searchConfiguration,
				}),
			);
			return {
				node: await presentGenericContentStructureNode(result.node),
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
		{
			access: "contribute:unit:update",
			params: GenericContentStructureNodeParams,
			body: UpdateGenericContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeMutationResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Update Content Structure node", tags: ["Content Structure"] },
		},
	)
	.delete(
		"/units/by-id/:unitId/content-structures/:structureId/nodes/:nodeId",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [
				["content-structure", params.structureId],
			]);
			const result = await database.transaction((tx) =>
				deleteContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					nodeId: params.nodeId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
				}),
			);
			return {
				updated: true as const,
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
		{
			access: "contribute:unit:update",
			params: GenericContentStructureNodeParams,
			body: ContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
			},
			detail: {
				summary: "Delete Content Structure node subtree",
				tags: ["Content Structure"],
			},
		},
	)
	.delete(
		"/units/by-id/:unitId/content-structures/:structureId",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [
				["content-structure", params.structureId],
			]);
			const result = await database.transaction((tx) =>
				deleteContentStructure(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					binding: "direct",
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
				}),
			);
			return {
				updated: true as const,
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
		{
			access: "contribute:unit:update",
			params: ContentStructureParams,
			body: ContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Delete Content Structure", tags: ["Content Structure"] },
		},
	)
	.get(
		"/units/book/:unitId/content-structure/nodes",
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
			if (!(await authorization.unit.canRead(params.unitId))) throw new BookNotFound();
			const canEditBook = await authorization.unit.canUpdate(params.unitId);
			const [structure] = await database
				.select({ id: contentStructure.id })
				.from(contentStructure)
				.where(
					and(
						eq(contentStructure.ownerUnitId, params.unitId),
						eq(contentStructure.kind, "book.contents"),
						isNull(contentStructure.deletedAt),
					),
				)
				.limit(1);
			if (!structure) return { structureId: null, latestRevisionId: null, items: [] };
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
						isPrimaryUnitLocalization(unitLocalization.unitId),
					),
				)
				.where(
					and(
						eq(contentStructureNode.structureId, structure.id),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
			const latestRevisionId = await database.transaction((tx) =>
				getContentStructureRevision(tx, params.unitId, structure.id),
			);
			return {
				structureId: structure.id,
				latestRevisionId,
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
			await authorization.unit.ensureCanUpdate(params.unitId, [["content-structure"]]);
			const result = await database.transaction(async (tx) => {
				const hasContent = body.content !== undefined;
				const published = hasContent ? body.status === "published" : true;
				const contentUnit = await insertUnit(tx, {
					kind: "post",
					status: published ? "published" : "draft",
					visibility: "public",
					publishedAt: published ? new Date() : null,
					statusActor: { kind: "profile", profileId: profile.unitId },
				});
				await ensureSubjectPostTargetingAllowed(tx, {
					sourcePostId: contentUnit.id,
					subjectUnitId: params.unitId,
				});
				await tx.insert(post).values({
					id: contentUnit.id,
					subjectUnitId: params.unitId,
					kind: hasContent ? "chapter" : "chapter_group",
				});
				await tx.insert(unitLocalization).values({
					unitId: contentUnit.id,
					language: body.language,
					title: body.title,
					content: body.content,
					contentStatus: hasContent ? (body.status ?? "draft") : undefined,
				});
				await tx.insert(unitAccessBinding).values({
					unitId: contentUnit.id,
					subjectKind: "profile",
					profileId: profile.unitId,
					role: "owner",
					scope: [],
					grantedByProfileId: profile.unitId,
				});
				await recordUnitRevision(tx, {
					unitId: contentUnit.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				const [structure] = await tx
					.select({ id: contentStructure.id })
					.from(contentStructure)
					.where(
						and(
							eq(contentStructure.ownerUnitId, params.unitId),
							eq(contentStructure.kind, "book.contents"),
							isNull(contentStructure.deletedAt),
						),
					)
					.limit(1);
				if (!structure) throw new BookNotFound();
				return insertContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: structure.id,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					parentId: body.parentId,
					contentUnitId: contentUnit.id,
					position: body.position,
				});
			});
			return toContentStructureNodeResponse(
				result.node,
				body.language,
				body.title,
				body.content !== undefined ? "chapter" : "chapter_group",
				result.revisionId,
			);
		},
		{
			access: "contribute:unit:update",
			params: BookContentStructureParams,
			body: CreateContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"PostTargetingLocked",
					"ContentStructureRevisionConflict",
				]),
			},
			detail: { summary: "Create book group or chapter", tags: ["Books"] },
		},
	)
	.patch(
		"/units/book/:unitId/content-structure/nodes/:nodeId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["content-structure"]]);
			const result = await database.transaction(async (tx) => {
				const condition = and(
					eq(contentStructureNode.id, params.nodeId),
					eq(contentStructureNode.ownerUnitId, params.unitId),
					isNull(contentStructureNode.deletedAt),
				);
				const [current] = await tx
					.select()
					.from(contentStructureNode)
					.where(condition)
					.limit(1);
				if (!current) throw new ContentStructureNodeNotFound();
				if (body.title !== undefined) {
					const localized = await tx
						.update(unitLocalization)
						.set({ title: body.title })
						.where(
							and(
								eq(unitLocalization.unitId, current.contentUnitId),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.returning({ unitId: unitLocalization.unitId });
					if (!localized.length) throw new ContentStructureNodeNotFound();
					await recordUnitRevision(tx, {
						unitId: current.contentUnitId,
						actorProfileId: profile.unitId,
						event: "update",
					});
				}
				const structural = "baseRevisionId" in body;
				const structuralResult = structural
					? await updateContentStructureNode(tx, {
							ownerUnitId: params.unitId,
							structureId: current.structureId,
							nodeId: current.id,
							baseRevisionId: body.baseRevisionId,
							actorProfileId: profile.unitId,
							parentId: body.parentId,
							position: body.position,
						})
					: null;
				const updated = structuralResult?.node ?? current;
				const latestRevisionId =
					structuralResult?.revisionId ??
					(await getContentStructureRevision(tx, params.unitId, current.structureId));
				if (!latestRevisionId) throw new ContentStructureNodeNotFound();
				return { node: updated, latestRevisionId };
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
						eq(unitLocalization.unitId, result.node.contentUnitId),
						isPrimaryUnitLocalization(unitLocalization.unitId),
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
				result.node,
				localization.language,
				localization.title,
				localization.contentKind,
				result.latestRevisionId,
			);
		},
		{
			access: "contribute:unit:update",
			params: ContentStructureNodeParams,
			body: UpdateContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ContentStructureNodeNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
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
			const authorization = (await resolveIdentity(request.headers, "unit:read"))
				.authorization;
			const [node] = await database
				.select({
					nodeId: contentStructureNode.id,
					bookId: contentStructureNode.ownerUnitId,
					chapterId: contentStructureNode.contentUnitId,
					position: contentStructureNode.position,
				})
				.from(contentStructureNode)
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
				.where(
					and(
						eq(contentStructureNode.contentUnitId, params.chapterId),
						eq(contentStructure.kind, "book.contents"),
						isNull(contentStructure.deletedAt),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.limit(1);
			if (!node?.chapterId || !(await authorization.unit.canRead(node.bookId)))
				throw new ChapterNotFound();
			const canEditBook = await authorization.unit.canUpdate(node.bookId);
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
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
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
						eq(contentStructure.kind, "book.contents"),
						isNull(contentStructure.deletedAt),
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
			await authorization.unit.ensureCanUpdate(params.chapterId, [
				["localizations", params.language],
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
			access: "contribute:unit:update",
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
