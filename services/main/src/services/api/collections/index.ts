import {presentImageAsset} from "../image-assets/presentation";
import { selfAuthUserIdForEntity } from "../../participation/account-query";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";

import session, { resolveIdentity } from "../../auth/session";
import { getUnitUpdateCondition } from "../../authorization/unit/query";
import { applyCollectionBatch } from "../../collection-structure/batch";
import {
	createCollectionStructureHistory,
	getCollectionStructureRevisionState,
	listCollectionStructureRevisions,
	restoreCollectionStructureRevision,
} from "../../collection-structure/history";
import { database, type DatabaseTransaction } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	collection,
	collectionItem,
	collectionStat,
	collectionStructureRevisionHead,
	creditAttribution,
	unitLocalization,
	unitOwnership,
	unitRevisionHead,
} from "../../database/schema";
import {
	createProfilePublisherAttribution,
	getAttributionSummariesByUnitIds,
} from "../../units/attribution";
import { insertPlatformUnit } from "../../units/create";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";

import { transitionUnitStatus } from "../../units/status";
import { toUnitVisibilityUpdate } from "../../units/visibility-update";
import { ValidationError } from "../errors";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { SavedCollectionItemsResponse } from "../schema/action-response";
import {
	CollectionContentResponse,
	CollectionDetailResponse,
	CollectionListResponse,
	toApiErrorResponse,
} from "../schema/response";
import { decodeCollectionListCursor, encodeCollectionListCursor } from "./cursor";
import {
	AddCollectionItemsBatchBody,
	AddCollectionItemsBatchResponse,
	CollectionDetailQuery,
	CollectionItemParams,
	CollectionItemsQuery,
	CollectionItemsRevisionBody,
	CollectionParams,
	CollectionStructureRevisionCompareQuery,
	CollectionStructureRevisionCompareResponse,
	CollectionStructureRevisionListQuery,
	CollectionStructureRevisionListResponse,
	CollectionStructureRevisionParams,
	CreateCollectionBody,
	ListCollectionsQuery,
	MoveCollectionItemsBody,
	RestoreCollectionStructureRevisionBody,
	RestoreCollectionStructureRevisionResponse,
	SaveCollectionItemBody,
	UpdateCollectionBody,
	UpdateCollectionItemsBatchBody,
	UpdateCollectionItemsBatchResponse,
} from "./schema";
import { getCollection, getCollectionContent } from "./service";

const CollectionNotFoundResponse = toApiErrorResponse(["CollectionNotFound"]);
const CollectionMutationNotFoundResponse = toApiErrorResponse([
	"CollectionNotFound",
	"ImageAssetNotFound",
]);
const CollectionMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitRevisionConflictResponse = toApiErrorResponse(["UnitRevisionConflict"]);
const CollectionStructureRevisionConflictResponse = toApiErrorResponse([
	"CollectionStructureRevisionConflict",
]);
const InvalidPaginationCursorResponse = toApiErrorResponse(["InvalidPaginationCursor"]);
const CollectionBatchErrors = {
	invalid: (message: string) => new ValidationError({ changes: message }),
};

function escapeRevisionPathSegment(value: string): string {
	return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function compareCollectionStructureStates(
	before: Awaited<ReturnType<typeof getCollectionStructureRevisionState>>,
	after: Awaited<ReturnType<typeof getCollectionStructureRevisionState>>,
) {
	const changes: Array<{ path: string; before?: unknown; after?: unknown }> = [];
	const beforeById = new Map(before.items.map((item) => [item.targetUnitId, item]));
	const afterById = new Map(after.items.map((item) => [item.targetUnitId, item]));
	const targetIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
	for (const targetId of targetIds) {
		const previous = beforeById.get(targetId);
		const next = afterById.get(targetId);
		const path = `/items/${escapeRevisionPathSegment(targetId)}`;
		if (!previous) {
			changes.push({ path, after: next });
			continue;
		}
		if (!next) {
			changes.push({ path, before: previous });
			continue;
		}
		for (const field of ["position", "addedByProfileId", "addedAt"] as const) {
			const previousValue = previous[field];
			const nextValue = next[field];
			const equal =
				previousValue instanceof Date && nextValue instanceof Date
					? previousValue.getTime() === nextValue.getTime()
					: previousValue === nextValue;
			if (!equal)
				changes.push({
					path: `${path}/${field}`,
					before: previousValue,
					after: nextValue,
				});
		}
	}
	return changes;
}

async function ensureEditableCollection(tx: DatabaseTransaction, collectionId: string) {
	const [record] = await tx
		.select({
			id: collection.id,
		})
		.from(collection)
		.where(eq(collection.id, collectionId))
		.limit(1);
	if (!record) throw new UnitNotFound();
	return record;
}

export default new Elysia({ prefix: "/collections" })
	.use(session)
	.get(
		"",
		{
			query: ListCollectionsQuery,
			response: {
				[StatusCodes.OK]: CollectionListResponse,
				[StatusCodes.BAD_REQUEST]: InvalidPaginationCursorResponse,
			},
			detail: { summary: "List collections", tags: ["Collections"] },
		},
		async ({ query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const identity = query.editableOnly ? await resolveIdentity(request, "unit:read") : undefined;
			const viewerId = identity?.entity?.id;
			if (query.editableOnly && !viewerId) return { items: [], nextCursor: null };
			const cursorContext = { query };
			const cursor = decodeCollectionListCursor(query.cursor, cursorContext);
			const limit = query.limit ?? 20;
			const search = query.search?.trim();
			const titleMatchesSearch = search
				? sql<boolean>`position(lower(${search}) in lower(coalesce(${unitLocalization.title}, ''))) > 0`
				: undefined;
			const cursorCondition = cursor
				? or(
						lt(collection.updatedAt, cursor.updatedAt),
						and(eq(collection.updatedAt, cursor.updatedAt), lt(collection.id, cursor.id)),
					)
				: undefined;
			const candidates = await database
				.select({
					id: collection.id,
					language: unitLocalization.language,
					itemCount: collectionStat.itemCount,
					containsTarget: query.targetId
						? sql<boolean>`exists(select 1 from ${collectionItem} selected_item where selected_item.collection_id = ${collection.id} and selected_item.unit_id = ${query.targetId})`
						: sql<boolean>`false`,
					latestRevisionId: unitRevisionHead.revisionId,
					latestItemsRevisionId: collectionStructureRevisionHead.revisionId,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					coverAssetId: resolvedUnitLocalizationImageAssetId(
						collection.id,
						"cover",
						localizationLanguages,
					),
					updatedAt: collection.updatedAt,
				})
				.from(collection)
				.innerJoin(collectionStat, eq(collectionStat.collectionId, collection.id))
				.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, collection.id))
				.innerJoin(
					collectionStructureRevisionHead,
					eq(collectionStructureRevisionHead.collectionId, collection.id),
				)
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, collection.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(collection.id, localizationLanguages),
						),
					),
				)
				.where(
					and(
						query.editableOnly
							? getUnitUpdateCondition(viewerId!, collection)
							: and(
									eq(collection.status, "published"),
									eq(collection.visibility, "public"),
									eq(collection.moderationStatus, "approved"),
									isNull(collection.deletedAt),
								),
						query.publisherProfileId
							? sql`exists(
								select 1 from ${creditAttribution} publisher_credit
								where publisher_credit.source_unit_id = ${collection.id}
									and publisher_credit.credited_entity_id = ${query.publisherProfileId}
									and publisher_credit.role = 'publisher'
							)`
							: undefined,
						query.containsTargetId
							? sql`exists(select 1 from ${collectionItem} containing_item where containing_item.collection_id = ${collection.id} and containing_item.unit_id = ${query.containsTargetId})`
							: undefined,
						query.acceptsItemsOnly && !query.editableOnly ? sql`false` : undefined,
						titleMatchesSearch,
						cursorCondition,
					),
				)
				.orderBy(desc(collection.updatedAt), desc(collection.id))
				.limit(limit + 1);
			const items = candidates.slice(0, limit);
			const last = items.at(-1);
			const attributionMap = await getAttributionSummariesByUnitIds(
				items.map(({ id }) => id),
				localizationLanguages,
			);
			return {
				items: items.map(({ coverAssetId, ...item }) => ({
					...item,
					itemCount: toSafeInteger(item.itemCount, "Collection item count"),
					acceptsItems: Boolean(query.editableOnly),
					attributions: attributionMap.get(item.id) ?? [],
					cover: presentImageAsset(coverAssetId, "cover"),
				})),
				nextCursor:
					candidates.length > limit && last
						? encodeCollectionListCursor(
								{
									updatedAt: last.updatedAt,
									id: last.id,
								},
								cursorContext,
							)
						: null,
			};
		},
	)
	.post(
		"",
		{
			access: "write:unit:create",
			body: CreateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.NOT_FOUND]: CollectionMutationNotFoundResponse,
			},
			detail: { summary: "Create collection", tags: ["Collections"] },
		},
		async ({ entity, authorization, body, principal }) => {
			const id = await database.transaction(async (tx) => {
				await ensureImageAssetsAttachable(
					tx,
					selfAuthUserIdForEntity(entity.id),
					unitLocalizationImageAssetReferences(body.localization),
				);
				const created = await insertPlatformUnit(tx, {
					owner: "collection",
					values: {visibility: body.visibility ?? "private", createdByAuthUserId: principal.authUserId},
					statusActor: { kind: "profile", profileId: entity.id },
				});
				await tx.insert(unitLocalization).values({
					unitId: created.id,
					...toUnitLocalizationStorage(body.localization),
				});
				await tx.insert(unitOwnership).values({
					unitId: created.id,
					profileId: entity.id,
					assignedByProfileId: entity.id,
				});
				await createProfilePublisherAttribution(tx, {
					sourceUnitId: created.id,
					profileId: entity.id,
				});
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: entity.id,
					contribution: body.revisionContext?.contribution,
					event: "create",
				});
				await createCollectionStructureHistory(tx, {
					collectionId: created.id,
					actorProfileId: entity.id,
				});
				return created.id;
			});
			return getCollection(id, authorization);
		},
	)
	.get(
		"/:collectionId/items",
		{
			params: CollectionParams,
			query: CollectionItemsQuery,
			response: {
				[StatusCodes.OK]: CollectionContentResponse,
				[StatusCodes.BAD_REQUEST]: InvalidPaginationCursorResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "List hydrated collection content", tags: ["Collections"] },
		},
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			return getCollectionContent(params.collectionId, identity.authorization, {
				localizationLanguages: query.localizationLanguages,
				cursor: query.cursor,
				limit: query.limit,
			});
		},
	)
	.get(
		"/:collectionId",
		{
			params: CollectionParams,
			query: CollectionDetailQuery,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Get collection", tags: ["Collections"] },
		},
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			return getCollection(
				params.collectionId,
				identity.authorization,
				query.localizationLanguages,
			);
		},
	)
	.patch(
		"/:collectionId",
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: UpdateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: CollectionMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitRevisionConflictResponse,
			},
			detail: { summary: "Update collection", tags: ["Collections"] },
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "collection.update");
			const statusUpdateDecision = body.status
				? await authorization.unit.decide(params.collectionId, "collection.status.update", ["unit"])
				: undefined;
			await database.transaction(async (tx) => {
				if (body.localization)
					await ensureImageAssetsAttachable(
						tx,
						selfAuthUserIdForEntity(entity.id),
						unitLocalizationImageAssetReferences(body.localization),
					);
				const unitUpdate = toUnitVisibilityUpdate(body.visibility);
				if (unitUpdate)
					await tx.update(collection).set(unitUpdate).where(eq(collection.id, params.collectionId));
				if (body.localization) {
					const storedLocalization = toUnitLocalizationStorage(body.localization);
					await tx
						.insert(unitLocalization)
						.values({
							unitId: params.collectionId,
							...storedLocalization,
						})
						.onConflictDoUpdate({
							target: [unitLocalization.unitId, unitLocalization.language],
							set: storedLocalization,
						});
				}
				const revision = await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: entity.id,
					contribution: body.revisionContext?.contribution,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				if (body.status)
					await transitionUnitStatus(tx, {
						unitId: params.collectionId,
						toStatus: body.status,
						actor: { kind: "profile", profileId: entity.id },
						authorization: {
							kind: "interactive",
							statusUpdateAllowed: statusUpdateDecision?.allowed ?? false,
						},
						revisionId: revision.revisionId,
					});
			});
			return getCollection(params.collectionId, authorization);
		},
	)
	.post(
		"/:collectionId/items/batch-update",
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: UpdateCollectionItemsBatchBody,
			response: {
				[StatusCodes.OK]: UpdateCollectionItemsBatchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([CollectionStructureRevisionConflictResponse]),
			},
			detail: {
				summary: "Apply an atomic mixed Collection item command batch",
				tags: ["Collections"],
			},
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "collection.update");
			const result = await database.transaction((tx) =>
				applyCollectionBatch(tx, {
					collectionId: params.collectionId,
					actorProfileId: entity.id,
					baseRevisionId: body.baseItemsRevisionId,
					commands: body.changes,
					errors: CollectionBatchErrors,
					ensureTargetReadable: async (targetId) => {
						const decision = await authorization.unit.decideInTransaction(
							tx,
							targetId,
							"collection.read",
						);
						if (!decision.allowed) throw new UnitNotFound();
					},
				}),
			);
			return {
				results: [...result.results],
				latestItemsRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	)
	.post(
		"/:collectionId/items/batch",
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: AddCollectionItemsBatchBody,
			response: {
				[StatusCodes.OK]: AddCollectionItemsBatchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([CollectionStructureRevisionConflictResponse]),
			},
			detail: { summary: "Add collection items atomically", tags: ["Collections"] },
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "collection.update");
			if (new Set(body.items.map(({ targetId }) => targetId)).size !== body.items.length)
				throw new ValidationError({ items: "targetId values must be unique" });
			if (body.items.some(({ targetId }) => targetId === params.collectionId))
				throw new ValidationError({ items: "a Collection cannot contain itself" });
			return database.transaction(async (tx) => {
				const result = await applyCollectionBatch(tx, {
					collectionId: params.collectionId,
					actorProfileId: entity.id,
					baseRevisionId: body.baseItemsRevisionId,
					commands: body.items.map(({ targetId }, index) => ({
						opId: String(index),
						type: "item.add" as const,
						targetId,
					})),
					errors: CollectionBatchErrors,
					ensureTargetReadable: async (targetId) => {
						const decision = await authorization.unit.decideInTransaction(
							tx,
							targetId,
							"collection.read",
						);
						if (!decision.allowed) throw new UnitNotFound();
					},
				});
				return {
					items: body.items.map(({ targetId }, index) => {
						const itemState = result.results[index]?.itemState;
						if (!itemState) throw new Error("Collection add batch result is incomplete");
						return { targetId, state: itemState };
					}),
					latestItemsRevisionId: result.revisionId,
				};
			});
		},
	)
	.post(
		"/:collectionId/items/move",
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: MoveCollectionItemsBody,
			response: {
				[StatusCodes.OK]: SavedCollectionItemsResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([CollectionStructureRevisionConflictResponse]),
			},
			detail: { summary: "Move collection items atomically", tags: ["Collections"] },
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "collection.update");
			const result = await database.transaction((tx) =>
				applyCollectionBatch(tx, {
					collectionId: params.collectionId,
					actorProfileId: entity.id,
					baseRevisionId: body.baseItemsRevisionId,
					commands: [
						{
							opId: "move",
							type: "items.move",
							targetIds: body.targetIds,
							placement: body.placement,
						},
					],
					errors: CollectionBatchErrors,
					ensureTargetReadable: async () => {},
				}),
			);
			return { saved: true, latestItemsRevisionId: result.revisionId };
		},
	)
	.put(
		"/:collectionId/items/:targetId",
		{
			access: "write:unit:update",
			params: CollectionItemParams,
			body: SaveCollectionItemBody,
			response: {
				[StatusCodes.OK]: SavedCollectionItemsResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([CollectionStructureRevisionConflictResponse]),
			},
			detail: { summary: "Save collection item", tags: ["Collections"] },
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "collection.update");
			if (params.targetId === params.collectionId)
				throw new ValidationError({ targetId: "a Collection cannot contain itself" });
			await authorization.unit.ensureCanRead(params.targetId);
			const result = await database.transaction((tx) =>
				applyCollectionBatch(tx, {
					collectionId: params.collectionId,
					actorProfileId: entity.id,
					baseRevisionId: body.baseItemsRevisionId,
					commands: [{ opId: "add", type: "item.add", targetId: params.targetId }],
					errors: CollectionBatchErrors,
					ensureTargetReadable: async (targetId) => {
						const decision = await authorization.unit.decideInTransaction(
							tx,
							targetId,
							"collection.read",
						);
						if (!decision.allowed) throw new UnitNotFound();
					},
				}),
			);
			return { saved: true, latestItemsRevisionId: result.revisionId };
		},
	)
	.delete(
		"/:collectionId/items/:targetId",
		{
			access: "write:unit:update",
			params: CollectionItemParams,
			body: CollectionItemsRevisionBody,
			response: {
				[StatusCodes.OK]: SavedCollectionItemsResponse,
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.CONFLICT]: t.Union([CollectionStructureRevisionConflictResponse]),
			},
			detail: { summary: "Remove collection item", tags: ["Collections"] },
		},
		async ({ params, entity, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "collection.update");
			const result = await database.transaction((tx) =>
				applyCollectionBatch(tx, {
					collectionId: params.collectionId,
					actorProfileId: entity.id,
					baseRevisionId: body.baseItemsRevisionId,
					commands: [{ opId: "remove", type: "item.remove", targetId: params.targetId }],
					errors: CollectionBatchErrors,
					ensureTargetReadable: async () => {},
				}),
			);
			return { saved: false, latestItemsRevisionId: result.revisionId };
		},
	)
	.get(
		"/:collectionId/item-revisions",
		{
			params: CollectionParams,
			query: CollectionStructureRevisionListQuery,
			response: {
				[StatusCodes.OK]: CollectionStructureRevisionListResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "List Collection item revisions", tags: ["Collections"] },
		},
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.collectionId);
			return database.transaction(async (tx) => ({
				items: await listCollectionStructureRevisions(tx, params.collectionId, query.limit ?? 50),
			}));
		},
	)
	.get(
		"/:collectionId/item-revisions/compare",
		{
			params: CollectionParams,
			query: CollectionStructureRevisionCompareQuery,
			response: {
				[StatusCodes.OK]: CollectionStructureRevisionCompareResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
				[StatusCodes.CONFLICT]: CollectionStructureRevisionConflictResponse,
			},
			detail: { summary: "Compare Collection item revisions", tags: ["Collections"] },
		},
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.collectionId);
			return database.transaction(async (tx) => {
				const [before, after] = await Promise.all([
					getCollectionStructureRevisionState(tx, {
						collectionId: params.collectionId,
						revisionId: query.from,
					}),
					getCollectionStructureRevisionState(tx, {
						collectionId: params.collectionId,
						revisionId: query.to,
					}),
				]);
				return {
					fromRevisionId: query.from,
					toRevisionId: query.to,
					changes: compareCollectionStructureStates(before, after),
				};
			});
		},
	)
	.post(
		"/:collectionId/item-revisions/:revisionId/restore",
		{
			access: "session-only",
			params: CollectionStructureRevisionParams,
			body: RestoreCollectionStructureRevisionBody,
			response: {
				[StatusCodes.OK]: RestoreCollectionStructureRevisionResponse,
				[StatusCodes.CONFLICT]: t.Union([CollectionStructureRevisionConflictResponse]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Restore a Collection item revision", tags: ["Collections"] },
		},
		async ({ params, body, entity, authorization }) => {
			await authorization.unit.ensure(params.collectionId, "collection.history.restore");
			const result = await database.transaction(async (tx) => {
				await ensureEditableCollection(tx, params.collectionId);
				return restoreCollectionStructureRevision(tx, {
					collectionId: params.collectionId,
					sourceRevisionId: params.revisionId,
					baseRevisionId: body.baseItemsRevisionId,
					actorProfileId: entity.id,
					message: body.message,
					minor: body.minor,
				});
			});
			return {
				updated: true as const,
				latestItemsRevisionId: result.revisionId,
				revisionCreated: result.revisionCreated,
			};
		},
	);
