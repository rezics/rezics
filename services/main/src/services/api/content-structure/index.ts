import { DevelopmentPreviewCapability } from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import Elysia from "elysia";

import { isContentStructureNodeReadable } from "../../authorization/content-structure/policy";
import { canAccessContentStructureApi } from "../../authorization/content-structure/release";
import session, { resolveIdentity } from "../../auth/session";
import type { Authorization } from "../../authorization";
import { PlatformCapabilityRequired } from "../../authorization/errors";
import { database, type DatabaseTransaction } from "../../database";
import { resolvedUnitLocalizationLanguage } from "../../units/localization";
import {
	contentStructure,
	contentStructureNode,
	label,
	post,
	unit,
	unitOwnership,
	unitLocalization,
	unitLocalizationContentMetric,
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
import { BookNotFound, ChapterLanguageNotFound, ChapterNotFound } from "./errors";
import { ContentStructureNotFound } from "../../content-structure/errors";
import { saveBookContentStructureDraft } from "../../content-structure/book-draft";
import {
	BookContentStructureParams,
	BookContentStructureQuery,
	ChapterLocalizationParams,
	ChapterParams,
	ReadChapterQuery,
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
	SaveBookContentStructureDraftBody,
} from "./schema";
import {
	ChapterDetailResponse,
	ContentStructureNodeListResponse,
	SaveBookContentStructureDraftResponse,
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
import { getUnitLocalizationContentMetric } from "../../content-metrics/service";
import { applyNewPostTagMentionVotes } from "../../posts/tag-mentions";
import {
	orderReaderChapterIds,
	selectReaderChapterLocalization,
} from "../../content-structure/book-reading";

const UnitForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);
const ContentStructureForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"PlatformCapabilityRequired",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function resolveBookContentKind(
	unitKind: string,
	postKind: string | null,
): "chapter" | "label" | null {
	if (unitKind === "label") return "label";
	if (unitKind === "post" && postKind === "chapter") return "chapter";
	return null;
}

async function presentGenericContentStructureNode(node: typeof contentStructureNode.$inferSelect) {
	const storedTarget = contentStructureTargetFromRow(node);
	return {
		id: node.id,
		structureId: node.structureId,
		ownerUnitId: node.ownerUnitId,
		parentId: node.parentId,
		contentUnitId: node.contentUnitId,
		documentKey: node.documentKey,
		target: storedTarget,
		position: node.position,
		contentRating: node.contentRating,
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

async function ensureReleasedContentStructureApi(
	tx: DatabaseTransaction,
	unitId: string,
	authorization: Authorization,
): Promise<void> {
	const [owner] = await tx
		.select({ kind: unit.kind })
		.from(unit)
		.where(and(eq(unit.id, unitId), isNull(unit.deletedAt)))
		.limit(1);
	const previewRequired = owner?.kind === "media" || owner?.kind === "software";
	const hasDevelopmentPreviewAccess =
		previewRequired &&
		(await authorization.platform.hasCapability(DevelopmentPreviewCapability, tx));
	if (owner && !canAccessContentStructureApi(owner.kind, hasDevelopmentPreviewAccess))
		throw new PlatformCapabilityRequired();
}

async function readBookContentStructure(
	tx: DatabaseTransaction,
	bookId: string,
	canEditBook: boolean,
	localizationLanguages: readonly ContentLanguage[] = [],
) {
	const [structure] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, bookId),
				eq(contentStructure.kind, "book.contents"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) return { structureId: null, latestRevisionId: null, items: [] };
	const rows = await tx
		.select({
			id: contentStructureNode.id,
			parentId: contentStructureNode.parentId,
			contentUnitId: contentStructureNode.contentUnitId,
			unitKind: unit.kind,
			postKind: post.kind,
			language: unitLocalization.language,
			title: unitLocalization.title,
			content: unitLocalization.content,
			position: contentStructureNode.position,
			wordCount: unitLocalizationContentMetric.wordCount,
			characterCount: unitLocalizationContentMetric.characterCount,
			unitStatus: unit.status,
			unitVisibility: unit.visibility,
			contentStatus: unitLocalization.contentStatus,
		})
		.from(contentStructureNode)
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.innerJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
				eq(
					unitLocalization.language,
					resolvedUnitLocalizationLanguage(
						contentStructureNode.contentUnitId,
						localizationLanguages,
					),
				),
			),
		)
		.leftJoin(
			unitLocalizationContentMetric,
			and(
				eq(unitLocalizationContentMetric.unitId, contentStructureNode.contentUnitId),
				eq(unitLocalizationContentMetric.language, unitLocalization.language),
			),
		)
		.where(
			and(
				eq(contentStructureNode.structureId, structure.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
	return {
		structureId: structure.id,
		latestRevisionId: await getContentStructureRevision(tx, bookId, structure.id),
		items: rows
			.filter((row) =>
				isContentStructureNodeReadable(canEditBook, row.unitStatus, row.unitVisibility),
			)
			.map((row) => {
				const contentKind = resolveBookContentKind(row.unitKind, row.postKind);
				if (!contentKind)
					throw new Error(
						`Invalid Book content node ${row.id} unit ${row.contentUnitId}`,
					);
				const hasReadableContent =
					contentKind === "chapter" &&
					row.content !== null &&
					(canEditBook || row.contentStatus === "published");
				if (
					contentKind === "chapter" &&
					hasReadableContent &&
					(row.wordCount === null || row.characterCount === null)
				)
					throw new Error(
						`Missing content metric for chapter ${row.contentUnitId} localization ${row.language}`,
					);
				return {
					id: row.id,
					parentId: row.parentId,
					contentUnitId: row.contentUnitId,
					contentKind,
					language: row.language,
					title: row.title ?? "",
					position: row.position,
					contentMetrics: {
						wordCount: hasReadableContent ? (row.wordCount ?? 0) : 0,
						characterCount: hasReadableContent ? (row.characterCount ?? 0) : 0,
					},
				};
			}),
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
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
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
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit Content Structures", tags: ["Content Structure"] },
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["content-structure"]]);
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
				return createContentStructure(tx, {
					ownerUnitId: params.unitId,
					kind: body.kind,
					actorProfileId: profile.unitId,
				});
			});
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
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
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
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
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
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
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
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
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
					await tx.insert(unitOwnership).values({
						unitId: created.id,
						profileId: profile.unitId,
						assignedByProfileId: profile.unitId,
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
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
				return updateContentStructureNode(tx, {
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
			params: GenericContentStructureNodeParams,
			body: UpdateGenericContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeMutationResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
				return deleteContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					nodeId: params.nodeId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
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
			params: GenericContentStructureNodeParams,
			body: ContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
				return deleteContentStructure(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					binding: "direct",
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
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
			params: ContentStructureParams,
			body: ContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
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
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
			if (!(await authorization.unit.canRead(params.unitId))) throw new BookNotFound();
			const canEditBook = await authorization.unit.canUpdate(params.unitId);
			return database.transaction((tx) =>
				readBookContentStructure(
					tx,
					params.unitId,
					canEditBook,
					query.localizationLanguages,
				),
			);
		},
		{
			params: BookContentStructureParams,
			query: BookContentStructureQuery,
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
	.put(
		"/units/book/:unitId/content-structure",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["content-structure"]]);
			return database.transaction(async (tx) => {
				const result = await saveBookContentStructureDraft(tx, {
					ownerUnitId: params.unitId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					nodes: body.nodes,
				});
				const saved = await readBookContentStructure(tx, params.unitId, true);
				if (!saved.structureId || !saved.latestRevisionId) throw new BookNotFound();
				return {
					structureId: saved.structureId,
					latestRevisionId: saved.latestRevisionId,
					items: saved.items,
					revisionCreated: result.revisionCreated,
				};
			});
		},
		{
			access: "contribute:unit:update",
			params: BookContentStructureParams,
			body: SaveBookContentStructureDraftBody,
			response: {
				[StatusCodes.OK]: SaveBookContentStructureDraftResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"PostTargetingLocked",
					"PostTagMentionVoteConflict",
					"ContentStructureRevisionConflict",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: {
				summary: "Save a complete Book Content Structure draft",
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
					unitStatus: unit.status,
					unitVisibility: unit.visibility,
				})
				.from(contentStructureNode)
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNode.contentUnitId, params.chapterId),
						eq(contentStructure.kind, "book.contents"),
						eq(post.kind, "chapter"),
						isNull(contentStructure.deletedAt),
						isNull(contentStructureNode.deletedAt),
						isNull(unit.deletedAt),
					),
				)
				.limit(1);
			if (!node?.chapterId || !(await authorization.unit.canRead(node.bookId)))
				throw new ChapterNotFound();
			const canEditBook = await authorization.unit.canUpdate(node.bookId);
			if (!isContentStructureNodeReadable(canEditBook, node.unitStatus, node.unitVisibility))
				throw new ChapterNotFound();
			const localizationLanguages = query.localizationLanguages ?? [];
			const localizations = await database
				.select({
					language: unitLocalization.language,
					position: unitLocalization.position,
					title: unitLocalization.title,
					content: unitLocalization.content,
					contentStatus: unitLocalization.contentStatus,
					updatedAt: unitLocalization.updatedAt,
				})
				.from(unitLocalization)
				.where(eq(unitLocalization.unitId, params.chapterId))
				.orderBy(unitLocalization.position, unitLocalization.language);
			const selected = selectReaderChapterLocalization(localizations, {
				canEditBook,
				exactLanguage: query.language,
				localizationLanguages,
			});
			if (!selected) throw new ChapterLanguageNotFound();
			const canPresentContent =
				selected.content !== null &&
				(canEditBook || selected.contentStatus === "published");
			const contentMetrics = canPresentContent
				? await getUnitLocalizationContentMetric(
						database,
						params.chapterId,
						selected.language,
					)
				: null;
			if (canPresentContent && !contentMetrics)
				throw new Error(
					`Missing content metric for chapter ${params.chapterId} localization ${selected.language}`,
				);
			const siblingRows = await database
				.select({
					id: contentStructureNode.id,
					parentId: contentStructureNode.parentId,
					contentUnitId: contentStructureNode.contentUnitId,
					position: contentStructureNode.position,
					unitKind: unit.kind,
					postKind: post.kind,
				})
				.from(contentStructureNode)
				.innerJoin(
					contentStructure,
					eq(contentStructure.id, contentStructureNode.structureId),
				)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNode.ownerUnitId, node.bookId),
						eq(contentStructure.kind, "book.contents"),
						isNull(contentStructure.deletedAt),
						isNull(contentStructureNode.deletedAt),
						isNull(unit.deletedAt),
						canEditBook
							? undefined
							: and(
									eq(unit.status, "published"),
									inArray(unit.visibility, ["public", "unlisted"]),
								),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
			const chapterIds = orderReaderChapterIds(
				siblingRows.flatMap((sibling) => {
					const contentKind = resolveBookContentKind(sibling.unitKind, sibling.postKind);
					return contentKind ? [{ ...sibling, contentKind }] : [];
				}),
			);
			const index = chapterIds.indexOf(params.chapterId);
			return {
				nodeId: node.nodeId,
				bookId: node.bookId,
				chapterId: node.chapterId,
				position: node.position,
				title: selected.title ?? "",
				language: selected.language,
				availableLanguages: localizations.map(({ language }) => language),
				content: canPresentContent ? toPortableTextResponse(selected.content) : null,
				contentMetrics,
				status: canPresentContent ? selected.contentStatus : null,
				updatedAt: selected.updatedAt,
				previousChapterId: index > 0 ? (chapterIds[index - 1] ?? null) : null,
				nextChapterId: index >= 0 ? (chapterIds[index + 1] ?? null) : null,
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
				const [current] = await tx
					.select({ content: unitLocalization.content })
					.from(unitLocalization)
					.where(
						and(
							eq(unitLocalization.unitId, params.chapterId),
							eq(unitLocalization.language, params.language),
						),
					)
					.for("update")
					.limit(1);
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
				await applyNewPostTagMentionVotes(tx, {
					postId: params.chapterId,
					profileId: profile.unitId,
					previousBody: current?.content,
					nextBody: body.content,
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
				[StatusCodes.CONFLICT]: toApiErrorResponse(["PostTagMentionVoteConflict"]),
			},
			detail: { summary: "Create or replace chapter content", tags: ["Books"] },
		},
	);
