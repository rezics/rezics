import { readUnitStateById } from "../../units/query";
import { readContentStructureContentRows } from "../../content-structure/content-preview";
import {
	type ContentStructureNodeState,
	type ContentStructureState,
} from "../../content-structure/contracts";
import { CatalogReferenceSchema } from "@rezics/reference";
import { loadCatalogIdentity, CatalogAccessDenied } from "../../catalog/storage";
import {
	runWithParticipationAuthority,
	ParticipationDenied,
	type ParticipationAuthority,
} from "../../participation/policy";
import { AuthenticationRequired } from "../../auth/errors";
import { DevelopmentPreviewCapability } from "@rezics/access";
import type { ContentLanguage } from "@rezics/i18n";
import { and, eq, isNull } from "drizzle-orm";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";

import session, { resolveIdentity } from "../../auth/session";
import type { Authorization } from "../../authorization";
import { PlatformCapabilityRequired } from "../../authorization/errors";
import { getUnitLocalizationContentMetric } from "../../content-metrics/service";
import { applyContentStructureBatch } from "../../content-structure/batch";
import { saveBookContentStructureDraft } from "../../content-structure/book-draft";
import {
	orderReaderChapterNodeIds,
	selectReaderChapterLocalization,
} from "../../content-structure/book-reading";
import { ContentStructureNotFound } from "../../content-structure/errors";
import {
	listContentStructureRevisions,
	restoreContentStructureRevision,
} from "../../content-structure/history";
import { saveMediaContentStructureDraft } from "../../content-structure/media-draft";
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
	contentStructureTargetFromRow,
	loadContentStructureSnapshot,
	ensureContentStructureKindOwner,
} from "../../content-structure/storage";
import { database, type DatabaseTransaction } from "../../database";
import {
	publishingTextVersion,
	contentStructure,
	contentStructureNode,
	post,
	unitLocalization,
	unitOwnership,
} from "../../database/schema";
import { runVoteTransaction } from "../../database/vote-admission";
import { applyNewPostTagMentionVotes } from "../../posts/tag-mentions";
import { findPostTargetingLock } from "../../posts/targeting";
import { insertPlatformUnit } from "../../units/create";
import { recordUnitRevision } from "../../units/history";
import {
	BookChapterNodeDetailResponse,
	ContentStructureBatchMutationResponse,
	ContentStructureDeleteResponse,
	ContentStructureDetailResponse,
	ContentStructureListResponse,
	ContentStructureMutationResponse,
	ContentStructureNodeMutationResponse,
	ContentStructureRevisionListResponse,
	toApiErrorResponse,
	toPortableTextResponse,
	UpdateStateResponse,
	VoteBackpressureResponse,
} from "../schema/response";
import { BookNotFound, ChapterLanguageNotFound, ChapterNotFound, MediaNotFound } from "./errors";
import {
	NativeContentStructureNodeListResponse,
	NativeContentStructureDraftResponse,
	BookChapterNodeParams,
	BookContentStructureParams,
	BookContentStructureQuery,
	ChapterLocalizationParams,
	ContentStructureParams,
	ContentStructureRevisionBody,
	ContentStructureRevisionListQuery,
	ContentStructureRevisionParams,
	CreateContentStructureBody,
	CreateGenericContentStructureNodeBody,
	GenericContentStructureNodeParams,
	MediaContentStructureParams,
	MediaContentStructureQuery,
	ReadChapterQuery,
	RestoreContentStructureRevisionBody,
	SaveBookContentStructureDraftBody,
	SaveMediaContentStructureDraftBody,
	UnitContentStructuresParams,
	UpdateContentStructureNodesBatchBody,
	UpdateGenericContentStructureNodeBody,
	UpsertChapterLocalizationBody,
} from "./schema";

const UnitForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);
const ContentStructureForbiddenResponse = toApiErrorResponse([
	"RealmCapabilityRequired",
	"UnitPermissionForbidden",
	"PlatformCapabilityRequired",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function resolveBookContentKind(
	unitKind: string,
	postKind: string | null,
	shape?: string,
): "text_version" | "chapter" | "label" | null {
	if (unitKind === "publishing" && shape === "text_version") return "text_version";
	if (unitKind === "label") return "label";
	if (unitKind === "post" && postKind === "chapter") return "chapter";
	return null;
}

async function presentGenericContentStructureNode(node: ContentStructureNodeState) {
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
		realmTagQueryStrategy: node.realmTagQueryStrategy,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
	};
}

function presentContentStructure(
	structure: ContentStructureState,
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

async function ensureCanMutateContentStructure(
	authorization: Authorization<string>,
	participation: ParticipationAuthority,
	input: {
		readonly ownerUnitId: string;
		readonly structureId?: string;
		readonly kind?: "realm.taxonomy";
	},
): Promise<void> {
	const [existing] = input.structureId
		? await database
				.select({ kind: contentStructure.kind })
				.from(contentStructure)
				.where(
					and(
						eq(contentStructure.id, input.structureId),
						eq(contentStructure.ownerUnitId, input.ownerUnitId),
						isNull(contentStructure.deletedAt),
					),
				)
				.limit(1)
		: [];
	if (input.kind === "realm.taxonomy" || existing?.kind === "realm.taxonomy") {
		await authorization.realm.ensureCapability(input.ownerUnitId, "realm.tags.manage");
		return;
	}
	const owner = await readUnitStateById(database, input.ownerUnitId);
	if (owner && CatalogReferenceSchema.safeParse(owner.reference).success) {
		await database.transaction((tx) =>
			ensureReleasedContentStructureApi(tx, input.ownerUnitId, authorization, participation),
		);
		return;
	}
	await authorization.unit.ensureCanUpdate(input.ownerUnitId, [
		input.structureId ? ["content-structure", input.structureId] : ["content-structure"],
	]);
}

async function ensureReleasedContentStructureApi(
	tx: DatabaseTransaction,
	unitId: string,
	authorization: Authorization,
	participation?: ParticipationAuthority,
): Promise<void> {
	const owner = await readUnitStateById(tx, unitId);
	if (owner && participation) {
		const ref = CatalogReferenceSchema.safeParse(owner.reference);
		if (ref.success) {
			try {
				await runWithParticipationAuthority(participation, () =>
					loadCatalogIdentity(tx, ref.data, participation.principal.authUserId, true, "share"),
				);
			} catch (error) {
				if (error instanceof CatalogAccessDenied) throw new ParticipationDenied();
				throw error;
			}
		}
	}
	const previewRequired = owner?.reference.owner === "software";
	const hasDevelopmentPreviewAccess =
		previewRequired &&
		(await authorization.platform.hasCapability(DevelopmentPreviewCapability, tx));
	if (previewRequired && !hasDevelopmentPreviewAccess) throw new PlatformCapabilityRequired();
}

function requireAuthUserId(authorization: Authorization<string>) {
	if (!authorization.authUserId) throw new AuthenticationRequired();
	return authorization.authUserId;
}
async function readNativeContentStructure(
	tx: DatabaseTransaction,
	ownerId: string,
	kind: "book.contents" | "media.contents",
	authorization: Authorization,
	languages: readonly ContentLanguage[] = [],
) {
	await ensureContentStructureKindOwner(tx, ownerId, kind);
	const [structure] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, ownerId),
				eq(contentStructure.kind, kind),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) return { structureId: null, latestRevisionId: null, items: [] };
	const snapshot = await loadContentStructureSnapshot(tx, {
		structureId: structure.id,
		ownerUnitId: ownerId,
	});
	const visibleNodes = await visibleStructureNodes(authorization, snapshot.nodes);
	const content = await readContentStructureContentRows(
		tx,
		visibleNodes.map((node) => node.contentUnitId),
		languages,
	);
	const byId = new Map(content.map((row) => [row.id, row]));
	const items = visibleNodes.flatMap((node) => {
		const row = byId.get(node.contentUnitId);
		if (!row) return [];
		const contentKind =
			kind === "book.contents"
				? resolveBookContentKind(row.unitKind, row.postKind, row.shape)
				: row.unitKind === "program"
					? ("program" as const)
					: row.unitKind === "audio" || row.unitKind === "video" || row.unitKind === "label"
						? row.unitKind
						: null;
		if (!contentKind) throw new ContentStructureNotFound();
		return [
			{
				id: node.id,
				parentId: node.parentId,
				contentUnitId: node.contentUnitId,
				reference: { owner: row.unitKind, id: row.id, shape: row.shape },
				contentKind,
				language: row.language,
				languageTag: row.languageTag,
				title: row.title,
				position: node.position,
				contentMetrics:
					row.wordCount === null || row.characterCount === null
						? null
						: { wordCount: row.wordCount, characterCount: row.characterCount },
				durationSeconds: row.durationSeconds,
			},
		];
	});
	return {
		structureId: structure.id,
		latestRevisionId: await getContentStructureRevision(tx, ownerId, structure.id),
		items,
	};
}
async function visibleStructureNodes(
	authorization: Authorization,
	nodes: readonly ContentStructureNodeState[],
) {
	const ids = [
		...new Set(
			nodes.flatMap((node) => [
				node.contentUnitId,
				...(node.targetUnitId ? [node.targetUnitId] : []),
			]),
		),
	];
	const readable = new Set<string>();
	for (let start = 0; start < ids.length; start += 500)
		for (const id of await authorization.unit.readableUnitIds(ids.slice(start, start + 500)))
			readable.add(id);
	const visible = nodes.filter(
		(node) =>
			readable.has(node.contentUnitId) && (!node.targetUnitId || readable.has(node.targetUnitId)),
	);
	const nodeIds = new Set(visible.map((node) => node.id));
	return visible.map((node) => ({
		...node,
		parentId: node.parentId && nodeIds.has(node.parentId) ? node.parentId : null,
	}));
}
async function ensureStructureReferencesReadable(
	authorization: Authorization,
	value: Awaited<ReturnType<typeof readNativeContentStructure>>,
) {
	const ids = [...new Set(value.items.map((item) => item.contentUnitId))];
	const readable = new Set<string>();
	for (let start = 0; start < ids.length; start += 500)
		for (const id of await authorization.unit.readableUnitIds(ids.slice(start, start + 500)))
			readable.add(id);
	return { ...value, items: value.items.filter((item) => readable.has(item.contentUnitId)) };
}
export default new Elysia()
	.use(session)
	.get(
		"/units/by-id/:unitId/content-structures",
		{
			params: UnitContentStructuresParams,
			response: {
				[StatusCodes.OK]: ContentStructureListResponse,
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit Content Structures", tags: ["Content Structure"] },
		},
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
				const structures = await listContentStructures(tx, params.unitId);
				return {
					items: structures.map((structure) =>
						presentContentStructure(structure, structure.latestRevisionId),
					),
				};
			});
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures",
		{
			access: "session-only",
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
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				kind: body.kind === "realm.taxonomy" ? body.kind : undefined,
			});
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				return createContentStructure(tx, {
					ownerUnitId: params.unitId,
					kind: body.kind,
					actorProfileId: entity.id,
				});
			});
			return {
				structure: presentContentStructure(result.structure, result.revisionId),
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.get(
		"/units/by-id/:unitId/content-structures/:structureId",
		{
			params: ContentStructureParams,
			response: {
				[StatusCodes.OK]: ContentStructureDetailResponse,
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
			},
			detail: { summary: "Get Content Structure", tags: ["Content Structure"] },
		},
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
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
						(await visibleStructureNodes(authorization, snapshot.nodes)).map(
							presentGenericContentStructureNode,
						),
					),
				};
			});
		},
	)
	.get(
		"/units/by-id/:unitId/content-structures/:structureId/revisions",
		{
			params: ContentStructureParams,
			query: ContentStructureRevisionListQuery,
			response: {
				[StatusCodes.OK]: ContentStructureRevisionListResponse,
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
			},
			detail: { summary: "List Content Structure revisions", tags: ["Content Structure"] },
		},
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization);
				await ensureContentStructureOwner(tx, params.unitId, params.structureId);
				return {
					items: await listContentStructureRevisions(tx, params.structureId, query.limit ?? 50),
				};
			});
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures/:structureId/revisions/:revisionId/restore",
		{
			access: "session-only",
			params: ContentStructureRevisionParams,
			body: RestoreContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
			},
			detail: {
				summary: "Restore a Content Structure revision",
				tags: ["Content Structure"],
			},
		},
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				structureId: params.structureId,
			});
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				await ensureContentStructureOwner(tx, params.unitId, params.structureId);
				return restoreContentStructureRevision(tx, {
					structureId: params.structureId,
					sourceRevisionId: params.revisionId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
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
	)
	.post(
		"/units/by-id/:unitId/content-structures/:structureId/nodes/batch",
		{
			access: "session-only",
			params: ContentStructureParams,
			body: UpdateContentStructureNodesBatchBody,
			response: {
				[StatusCodes.OK]: ContentStructureBatchMutationResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: {
				summary: "Apply an atomic Content Structure node command batch",
				tags: ["Content Structure"],
			},
		},
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				structureId: params.structureId,
			});
			const referencedUnitIds = new Set<string>();
			for (const change of body.changes) {
				if (change.type === "node.create") referencedUnitIds.add(change.contentUnitId);
				else if (change.type === "node.update" && change.contentUnitId !== undefined)
					referencedUnitIds.add(change.contentUnitId);
				if (
					(change.type === "node.create" || change.type === "node.update") &&
					change.target?.kind === "unit"
				)
					referencedUnitIds.add(change.target.unitId);
			}
			await authorization.unit.ensureCanReadMany([...referencedUnitIds]);
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				return applyContentStructureBatch(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
					commands: body.changes,
				});
			});
			return {
				results: [...result.results],
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.post(
		"/units/by-id/:unitId/content-structures/:structureId/nodes",
		{
			access: "session-only",
			params: ContentStructureParams,
			body: CreateGenericContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeMutationResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Insert Content Structure node", tags: ["Content Structure"] },
		},
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				structureId: params.structureId,
			});
			if (body.content.kind === "unit") await authorization.unit.ensureCanRead(body.content.unitId);
			if (body.target?.kind === "unit") await authorization.unit.ensureCanRead(body.target.unitId);
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				let contentUnitId: string;
				if (body.content.kind === "unit") contentUnitId = body.content.unitId;
				else {
					const created = await insertPlatformUnit(tx, {
						owner: "label",
						values: {
							createdByAuthUserId: requireAuthUserId(authorization),
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
						},
						statusActor: { kind: "profile", profileId: entity.id },
					});
					await tx.insert(unitLocalization).values({
						unitId: created.id,
						language: body.content.language,
						title: body.content.title,
					});
					await tx.insert(unitOwnership).values({
						unitId: created.id,
						profileId: entity.id,
						assignedByProfileId: entity.id,
					});
					await recordUnitRevision(tx, {
						unitId: created.id,
						actorProfileId: entity.id,
						contribution: body.revisionContext?.contribution,
						event: "create",
					});
					contentUnitId = created.id;
				}
				return insertContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
					parentId: body.parentId,
					contentUnitId,
					documentKey: body.documentKey,
					target: body.target,
					position: body.position,
					contentRating: body.contentRating,
					realmTagQueryStrategy: body.realmTagQueryStrategy,
				});
			});
			return {
				node: await presentGenericContentStructureNode(result.node),
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.patch(
		"/units/by-id/:unitId/content-structures/:structureId/nodes/:nodeId",
		{
			access: "session-only",
			params: GenericContentStructureNodeParams,
			body: UpdateGenericContentStructureNodeBody,
			response: {
				[StatusCodes.OK]: ContentStructureNodeMutationResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Update Content Structure node", tags: ["Content Structure"] },
		},
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				structureId: params.structureId,
			});
			if (body.contentUnitId) await authorization.unit.ensureCanRead(body.contentUnitId);
			if (body.target?.kind === "unit") await authorization.unit.ensureCanRead(body.target.unitId);
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				return updateContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					nodeId: params.nodeId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
					parentId: body.parentId,
					contentUnitId: body.contentUnitId,
					documentKey: body.documentKey,
					target: body.target,
					position: body.position,
					contentRating: body.contentRating,
					realmTagQueryStrategy: body.realmTagQueryStrategy,
				});
			});
			return {
				node: await presentGenericContentStructureNode(result.node),
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.delete(
		"/units/by-id/:unitId/content-structures/:structureId/nodes/:nodeId",
		{
			access: "session-only",
			params: GenericContentStructureNodeParams,
			body: ContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
			},
			detail: {
				summary: "Delete Content Structure node subtree",
				tags: ["Content Structure"],
			},
		},
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				structureId: params.structureId,
			});
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				return deleteContentStructureNode(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					nodeId: params.nodeId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
				});
			});
			return {
				updated: true as const,
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.delete(
		"/units/by-id/:unitId/content-structures/:structureId",
		{
			access: "session-only",
			params: ContentStructureParams,
			body: ContentStructureRevisionBody,
			response: {
				[StatusCodes.OK]: ContentStructureDeleteResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: ContentStructureForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ContentStructureNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Delete Content Structure", tags: ["Content Structure"] },
		},
		async ({ params, body, entity, authorization, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
				structureId: params.structureId,
			});
			const result = await database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				return deleteContentStructure(tx, {
					ownerUnitId: params.unitId,
					structureId: params.structureId,
					binding: "direct",
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
				});
			});
			return {
				updated: true as const,
				latestRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.get(
		"/publishing/text-versions/:unitId/content-structure/nodes",
		{
			params: BookContentStructureParams,
			query: BookContentStructureQuery,
			response: {
				[StatusCodes.OK]: NativeContentStructureNodeListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["BookNotFound"]),
			},
			detail: {
				summary: "List book Content Structure nodes",
				tags: ["Content Structure"],
			},
		},
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			if (!(await authorization.unit.canRead(params.unitId))) throw new BookNotFound();
			return ensureStructureReferencesReadable(
				authorization,
				await database.transaction((tx) =>
					readNativeContentStructure(
						tx,
						params.unitId,
						"book.contents",
						authorization,
						query.localizationLanguages,
					),
				),
			);
		},
	)
	.put(
		"/publishing/text-versions/:unitId/content-structure",
		{
			access: "contribute:unit:update",
			params: BookContentStructureParams,
			body: SaveBookContentStructureDraftBody,
			response: {
				[StatusCodes.OK]: NativeContentStructureDraftResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"PostTargetingLocked",
					"PostTagMentionVoteConflict",
					"ContentStructureRevisionConflict",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
				[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
			},
			detail: {
				summary: "Save a complete Book Content Structure draft",
				tags: ["Content Structure"],
			},
		},
		async ({ params, entity, authorization, body, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
			});
			return runVoteTransaction({ family: "unit_tag", authority: "global" }, async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				const attachedContentUnitIds = [
					...new Set(
						body.nodes.flatMap((node) => (node.state === "attached" ? [node.contentUnitId] : [])),
					),
				];
				for (const unitId of attachedContentUnitIds)
					await authorization.unit.ensureInTransaction(tx, unitId, "unit.read");
				const result = await saveBookContentStructureDraft(tx, {
					authorization: authorization.unit,
					actorAuthUserId: requireAuthUserId(authorization),
					ownerUnitId: params.unitId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: entity.id,
					contribution: body.revisionContext?.contribution,
					nodes: body.nodes,
				});
				const saved = await readNativeContentStructure(
					tx,
					params.unitId,
					"book.contents",
					authorization,
				);
				if (!saved.structureId || !saved.latestRevisionId) throw new BookNotFound();
				return {
					structureId: saved.structureId,
					latestRevisionId: saved.latestRevisionId,
					items: saved.items,
					revisionCreated: result.revisionCreated,
				};
			});
		},
	)
	.get(
		"/program/:unitId/content-structure/nodes",
		{
			params: MediaContentStructureParams,
			query: MediaContentStructureQuery,
			response: {
				[StatusCodes.OK]: NativeContentStructureNodeListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["MediaNotFound"]),
			},
			detail: {
				summary: "List Media Content Structure nodes",
				tags: ["Content Structure"],
			},
		},
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			if (!(await authorization.unit.canRead(params.unitId))) throw new MediaNotFound();
			return ensureStructureReferencesReadable(
				authorization,
				await database.transaction((tx) =>
					readNativeContentStructure(
						tx,
						params.unitId,
						"media.contents",
						authorization,
						query.localizationLanguages,
					),
				),
			);
		},
	)
	.put(
		"/program/:unitId/content-structure",
		{
			access: "contribute:unit:update",
			params: MediaContentStructureParams,
			body: SaveMediaContentStructureDraftBody,
			response: {
				[StatusCodes.OK]: NativeContentStructureDraftResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: {
				summary: "Save a complete Media Content Structure draft",
				tags: ["Content Structure"],
			},
		},
		async ({ params, entity, authorization, body, participation }) => {
			await ensureCanMutateContentStructure(authorization, participation, {
				ownerUnitId: params.unitId,
			});
			return database.transaction(async (tx) => {
				await ensureReleasedContentStructureApi(tx, params.unitId, authorization, participation);
				const attachedContentUnitIds = [
					...new Set(
						body.nodes.flatMap((node) => (node.state === "attached" ? [node.contentUnitId] : [])),
					),
				];
				for (const unitId of attachedContentUnitIds)
					await authorization.unit.ensureInTransaction(tx, unitId, "unit.read");
				const result = await saveMediaContentStructureDraft(tx, {
					authorization: authorization.unit,
					actorAuthUserId: requireAuthUserId(authorization),
					ownerUnitId: params.unitId,
					base: body.base,
					actorProfileId: entity.id,
					contribution: body.revisionContext?.contribution,
					nodes: body.nodes,
				});
				const saved = await readNativeContentStructure(
					tx,
					params.unitId,
					"media.contents",
					authorization,
				);
				if (!saved.structureId || !saved.latestRevisionId)
					throw new Error("Saved Media Content Structure is uninitialized");
				return {
					...saved,
					structureId: saved.structureId,
					latestRevisionId: saved.latestRevisionId,
					revisionCreated: result.revisionCreated,
				};
			});
		},
	)
	.get(
		"/publishing/text-versions/:bookId/content-nodes/:nodeId",
		{
			params: BookChapterNodeParams,
			query: ReadChapterQuery,
			response: {
				[StatusCodes.OK]: BookChapterNodeDetailResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ChapterNotFound", "ChapterLanguageNotFound"]),
			},
			detail: { summary: "Read a Chapter occurrence in a Book", tags: ["Books"] },
		},
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const { authorization } = identity;
			if (!(await authorization.unit.canRead(params.bookId))) throw new ChapterNotFound();
			const [node] = await database
				.select({
					nodeId: contentStructureNode.id,
					structureId: contentStructureNode.structureId,
					bookId: contentStructureNode.ownerUnitId,
					chapterId: contentStructureNode.contentUnitId,
					position: contentStructureNode.position,
				})
				.from(contentStructureNode)
				.innerJoin(contentStructure, eq(contentStructure.id, contentStructureNode.structureId))
				.innerJoin(
					publishingTextVersion,
					eq(publishingTextVersion.id, contentStructure.ownerUnitId),
				)
				.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNode.id, params.nodeId),
						eq(contentStructureNode.ownerUnitId, params.bookId),
						eq(contentStructure.kind, "book.contents"),
						eq(post.kind, "chapter"),
						isNull(contentStructure.deletedAt),
						isNull(contentStructureNode.deletedAt),
						isNull(post.deletedAt),
						eq(post.moderationStatus, "approved"),
					),
				)
				.limit(1);
			if (!node?.chapterId) throw new ChapterNotFound();
			await authorization.unit.ensureCanRead(node.chapterId, () => new ChapterNotFound());
			const bodyPresentation = (await authorization.unit.canUpdate(node.chapterId, [
				"localizations",
			]))
				? ("preview" as const)
				: ("published" as const);
			const localizationLanguages = query.localizationLanguages ?? [];
			const [localizations, targetingLock] = await Promise.all([
				database
					.select({
						language: unitLocalization.language,
						position: unitLocalization.position,
						title: unitLocalization.title,
						content: unitLocalization.content,
						contentStatus: unitLocalization.contentStatus,
						updatedAt: unitLocalization.updatedAt,
					})
					.from(unitLocalization)
					.where(eq(unitLocalization.unitId, node.chapterId))
					.orderBy(unitLocalization.position, unitLocalization.language),
				findPostTargetingLock(database, {
					targets: [{ relation: "root", unitId: node.chapterId }],
				}),
			]);
			const selected = selectReaderChapterLocalization(localizations, {
				bodyPresentation,
				exactLanguage: query.language,
				localizationLanguages,
			});
			if (!selected) throw new ChapterLanguageNotFound();
			const canPresentContent =
				selected.content !== null &&
				(bodyPresentation === "preview" || selected.contentStatus === "published");
			const contentMetrics = canPresentContent
				? await getUnitLocalizationContentMetric(database, node.chapterId, selected.language)
				: null;
			if (canPresentContent && !contentMetrics)
				throw new Error(
					`Missing content metric for chapter ${node.chapterId} localization ${selected.language}`,
				);
			const siblingSnapshot = await database.transaction((tx) =>
				loadContentStructureSnapshot(tx, {
					structureId: node.structureId,
					ownerUnitId: params.bookId,
				}),
			);
			const siblingContent = await database.transaction((tx) =>
				readContentStructureContentRows(
					tx,
					siblingSnapshot.nodes.map((item) => item.contentUnitId),
				),
			);
			const byId = new Map(siblingContent.map((item) => [item.id, item]));
			const allowed = new Set<string>();
			for (let start = 0; start < siblingContent.length; start += 500)
				for (const id of await authorization.unit.readableUnitIds(
					siblingContent.slice(start, start + 500).map((item) => item.id),
				))
					allowed.add(id);
			const siblingRows = siblingSnapshot.nodes.flatMap((item) => {
				const content = byId.get(item.contentUnitId);
				return content && allowed.has(content.id) ? [{ ...content, ...item }] : [];
			});
			const chapterNodeIds = orderReaderChapterNodeIds(
				siblingRows.flatMap((sibling) => {
					const contentKind = resolveBookContentKind(
						sibling.unitKind,
						sibling.postKind,
						sibling.shape,
					);
					return contentKind ? [{ ...sibling, contentKind }] : [];
				}),
			);
			const index = chapterNodeIds.indexOf(params.nodeId);
			return {
				nodeId: node.nodeId,
				bookId: node.bookId,
				chapterId: node.chapterId,
				position: node.position,
				title: selected.title ?? "",
				language: selected.language,
				availableLanguages: localizations.map(({ language }) => language),
				content: canPresentContent
					? toPortableTextResponse(selected.content, "unit_localization.content")
					: null,
				contentMetrics,
				status: canPresentContent ? selected.contentStatus : null,
				updatedAt: selected.updatedAt,
				previousNodeId: index > 0 ? (chapterNodeIds[index - 1] ?? null) : null,
				nextNodeId: index >= 0 ? (chapterNodeIds[index + 1] ?? null) : null,
				capabilities: { canReply: !targetingLock },
			};
		},
	)
	.put(
		"/chapters/:chapterId/localizations/:language/content",
		{
			access: "contribute:unit:update",
			params: ChapterLocalizationParams,
			body: UpsertChapterLocalizationBody,
			response: {
				[StatusCodes.OK]: UpdateStateResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UnitRevisionConflict",
					"PostTagMentionVoteConflict",
				]),
				[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
			},
			detail: { summary: "Create or replace chapter content", tags: ["Books"] },
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(params.chapterId, [
				["localizations", params.language],
			]);
			await runVoteTransaction({ family: "unit_tag", authority: "global" }, async (tx) => {
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
					profileId: entity.id,
					previousBody: current?.content,
					nextBody: body.content,
				});
				await recordUnitRevision(tx, {
					unitId: params.chapterId,
					actorProfileId: entity.id,
					contribution: body.revisionContext?.contribution,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
			});
			return { updated: true };
		},
	);
