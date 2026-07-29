import { StatusCodes } from "http-status-codes";
import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database, type DatabaseTransaction } from "../../database";
import { fractionalPositionBetween, fractionalPositionsBetween } from "../../ordering/position";
import {
	resolvedUnitLocalizationLanguage,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	collection,
	collectionItem,
	creditAttribution,
	post,
	profileFavoritesCollection,
	unit,
	unitOwnership,
	unitLocalization,
	unitRevisionHead,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { transitionUnitStatus } from "../../units/status";
import { UnitNotFound } from "../../units/errors";
import { presentImageAsset } from "../../units/service";
import { toUnitVisibilityUpdate } from "../../units/visibility-update";
import {
	AddCollectionItemsBatchBody,
	AddCollectionItemsBatchResponse,
	CollectionItemParams,
	CollectionParams,
	CollectionDetailQuery,
	CollectionItemsQuery,
	CollectionRevisionBody,
	CreateCollectionBody,
	FavoriteItemParams,
	ListCollectionsQuery,
	MoveCollectionItemsBody,
	SaveCollectionItemBody,
	UpdateCollectionBody,
} from "./schema";
import { ensureFavorites } from "../../collections/favorites";
import { getCollection, getCollectionContent } from "./service";
import { validateCollectionParent } from "./hierarchy";
import { FavoriteResponse, NoContentResponse, SavedResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CollectionContentResponse,
	CollectionDetailResponse,
	CollectionListResponse,
} from "../schema/response";
import { FavoritesDeleteForbidden, FavoritesEditForbidden } from "./errors";
import { decodeCollectionListCursor, encodeCollectionListCursor } from "./cursor";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { ValidationError } from "../errors";
import { createProfilePublisherAttribution } from "../../units/attribution";
import { getAttributionSummariesByUnitIds } from "../../units/attribution";
import { getUnitUpdateCondition } from "../../authorization/unit/query";
import { collectionSubtreeIds, orderedCollectionMoveRoots } from "./move";

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
const FavoritesEditResponse = toApiErrorResponse(["FavoritesEditForbidden"]);
const FavoritesDeleteResponse = toApiErrorResponse(["FavoritesDeleteForbidden"]);
const UnitRevisionConflictResponse = toApiErrorResponse(["UnitRevisionConflict"]);
const InvalidPaginationCursorResponse = toApiErrorResponse(["InvalidPaginationCursor"]);

async function ensureEditableCollection(tx: DatabaseTransaction, collectionId: string) {
	const [record] = await tx
		.select({
			id: collection.id,
			favoritesProfileId: profileFavoritesCollection.profileId,
		})
		.from(collection)
		.leftJoin(
			profileFavoritesCollection,
			eq(profileFavoritesCollection.collectionId, collection.id),
		)
		.where(eq(collection.id, collectionId))
		.limit(1);
	if (!record) throw new UnitNotFound();
	if (record.favoritesProfileId) throw new FavoritesEditForbidden();
	return record;
}

async function nextCollectionItemPosition(
	tx: DatabaseTransaction,
	collectionId: string,
	parentUnitId: string | null = null,
) {
	const [last] = await tx
		.select({ position: collectionItem.position })
		.from(collectionItem)
		.where(
			and(
				eq(collectionItem.collectionId, collectionId),
				parentUnitId
					? eq(collectionItem.parentUnitId, parentUnitId)
					: isNull(collectionItem.parentUnitId),
			),
		)
		.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
		.limit(1);
	return fractionalPositionBetween(last?.position, null);
}

async function ensureValidCollectionParent(
	tx: DatabaseTransaction,
	input: {
		readonly collectionId: string;
		readonly targetId: string;
		readonly parentTargetId: string | null | undefined;
	},
) {
	if (!input.parentTargetId) return;
	if (input.targetId === input.parentTargetId)
		throw new ValidationError({ parentTargetId: "an item cannot be its own parent" });
	const memberships = await tx
		.select({
			unitId: collectionItem.unitId,
			parentUnitId: collectionItem.parentUnitId,
		})
		.from(collectionItem)
		.where(eq(collectionItem.collectionId, input.collectionId));
	const failure = validateCollectionParent(input, memberships);
	if (failure === "self-parent")
		throw new ValidationError({ parentTargetId: "an item cannot be its own parent" });
	if (failure === "missing-parent")
		throw new ValidationError({
			parentTargetId: "the parent must already belong to this Collection",
		});
	if (failure === "would-cycle")
		throw new ValidationError({ parentTargetId: "the parent would create a cycle" });
	if (failure === "existing-cycle")
		throw new ValidationError({ parentTargetId: "the Collection hierarchy is cyclic" });
}

export default new Elysia({ prefix: "/collections" })
	.use(session)
	.get(
		"",
		async ({ query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const identity = query.editableOnly
				? await resolveIdentity(request.headers, "unit:read")
				: undefined;
			const viewerId = identity?.profile?.unitId;
			if (query.editableOnly && !viewerId) return { items: [], nextCursor: null };
			if (viewerId) await ensureFavorites(viewerId);
			const cursorContext = { query };
			const cursor = decodeCollectionListCursor(query.cursor, cursorContext);
			const limit = query.limit ?? 20;
			const favoritesRank = sql<number>`case
				when ${profileFavoritesCollection.profileId} is not null then 1
				else 0
			end`;
			const search = query.search?.trim();
			const titleMatchesSearch = search
				? sql<boolean>`position(lower(${search}) in lower(coalesce(${unitLocalization.title}, ''))) > 0`
				: undefined;
			const cursorCondition = cursor
				? or(
						lt(favoritesRank, cursor.favoritesRank),
						and(
							eq(favoritesRank, cursor.favoritesRank),
							lt(unit.updatedAt, cursor.updatedAt),
						),
						and(
							eq(favoritesRank, cursor.favoritesRank),
							eq(unit.updatedAt, cursor.updatedAt),
							lt(collection.id, cursor.id),
						),
					)
				: undefined;
			const candidates = await database
				.select({
					id: collection.id,
					favoritesProfileId: profileFavoritesCollection.profileId,
					favoritesRank,
					language: unitLocalization.language,
					itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collection.id})::int`,
					containsTarget: query.targetId
						? sql<boolean>`exists(select 1 from ${collectionItem} selected_item where selected_item.collection_id = ${collection.id} and selected_item.unit_id = ${query.targetId})`
						: sql<boolean>`false`,
					latestRevisionId: unitRevisionHead.revisionId,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					coverAssetId: unitLocalization.coverAssetId,
					updatedAt: unit.updatedAt,
				})
				.from(collection)
				.innerJoin(unit, eq(unit.id, collection.id))
				.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
				.leftJoin(
					profileFavoritesCollection,
					eq(profileFavoritesCollection.collectionId, collection.id),
				)
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
						),
					),
				)
				.where(
					and(
						query.editableOnly
							? and(
									getUnitUpdateCondition(viewerId!, unit),
									or(
										isNull(profileFavoritesCollection.profileId),
										eq(profileFavoritesCollection.profileId, viewerId!),
									),
								)
							: and(
									eq(unit.status, "published"),
									eq(unit.visibility, "public"),
									eq(unit.moderationStatus, "approved"),
									isNull(unit.deletedAt),
									isNull(profileFavoritesCollection.profileId),
								),
						query.publisherProfileId
							? sql`exists(
								select 1 from ${creditAttribution} publisher_credit
								where publisher_credit.source_unit_id = ${collection.id}
									and publisher_credit.credited_unit_id = ${query.publisherProfileId}
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
				.orderBy(desc(favoritesRank), desc(unit.updatedAt), desc(collection.id))
				.limit(limit + 1);
			const items = candidates.slice(0, limit);
			const last = items.at(-1);
			const attributionMap = await getAttributionSummariesByUnitIds(
				items.map(({ id }) => id),
				localizationLanguages,
			);
			return {
				items: items.map(
					({
						coverAssetId,
						favoritesRank: _favoritesRank,
						favoritesProfileId,
						...item
					}) => ({
						...item,
						purpose: favoritesProfileId
							? ("favorites" as const)
							: ("collection" as const),
						acceptsItems: Boolean(query.editableOnly),
						attributions: attributionMap.get(item.id) ?? [],
						cover: presentImageAsset(coverAssetId, "cover"),
					}),
				),
				nextCursor:
					candidates.length > limit && last
						? encodeCollectionListCursor(
								{
									favoritesRank: last.favoritesRank,
									updatedAt: last.updatedAt,
									id: last.id,
								},
								cursorContext,
							)
						: null,
			};
		},
		{
			query: ListCollectionsQuery,
			response: {
				[StatusCodes.OK]: CollectionListResponse,
				[StatusCodes.BAD_REQUEST]: InvalidPaginationCursorResponse,
			},
			detail: { summary: "List collections", tags: ["Collections"] },
		},
	)
	.post(
		"",
		async ({ profile, authorization, body }) => {
			const id = await database.transaction(async (tx) => {
				await ensureImageAssetsAttachable(
					tx,
					profile.unitId,
					unitLocalizationImageAssetReferences(body.localization),
				);
				const created = await insertUnit(tx, {
					kind: "collection",
					visibility: body.visibility ?? "private",
					statusActor: { kind: "profile", profileId: profile.unitId },
				});
				await tx.insert(collection).values({ id: created.id });
				await tx.insert(unitLocalization).values({
					unitId: created.id,
					...toUnitLocalizationStorage(body.localization),
				});
				await tx.insert(unitOwnership).values({
					unitId: created.id,
					profileId: profile.unitId,
					assignedByProfileId: profile.unitId,
				});
				await createProfilePublisherAttribution(tx, {
					sourceUnitId: created.id,
					profileId: profile.unitId,
				});
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				return created.id;
			});
			return getCollection(id, authorization);
		},
		{
			access: "write:unit:create",
			body: CreateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.NOT_FOUND]: CollectionMutationNotFoundResponse,
			},
			detail: { summary: "Create collection", tags: ["Collections"] },
		},
	)
	.get(
		"/favorites",
		async ({ profile, authorization, query }) => {
			return getCollection(
				await ensureFavorites(profile.unitId),
				authorization,
				query.localizationLanguages,
			);
		},
		{
			access: "write:unit:read",
			query: CollectionDetailQuery,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Get Favorites collection", tags: ["Collections"] },
		},
	)
	.get(
		"/:collectionId/items",
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			return getCollectionContent(params.collectionId, identity.authorization, {
				localizationLanguages: query.localizationLanguages,
				cursor: query.cursor,
				limit: query.limit,
			});
		},
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
	)
	.get(
		"/:collectionId",
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			return getCollection(
				params.collectionId,
				identity.authorization,
				query.localizationLanguages,
			);
		},
		{
			params: CollectionParams,
			query: CollectionDetailQuery,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Get collection", tags: ["Collections"] },
		},
	)
	.patch(
		"/:collectionId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			const statusUpdateDecision = body.status
				? await authorization.unit.decide(params.collectionId, "unit.status.update", [
						"unit",
					])
				: undefined;
			const [current] = await database
				.select({ favoritesProfileId: profileFavoritesCollection.profileId })
				.from(collection)
				.leftJoin(
					profileFavoritesCollection,
					eq(profileFavoritesCollection.collectionId, collection.id),
				)
				.where(eq(collection.id, params.collectionId))
				.limit(1);
			if (current?.favoritesProfileId) throw new FavoritesEditForbidden();
			await database.transaction(async (tx) => {
				if (body.localization)
					await ensureImageAssetsAttachable(
						tx,
						profile.unitId,
						unitLocalizationImageAssetReferences(body.localization),
					);
				const unitUpdate = toUnitVisibilityUpdate(body.visibility);
				if (unitUpdate)
					await tx.update(unit).set(unitUpdate).where(eq(unit.id, params.collectionId));
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
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				if (body.status)
					await transitionUnitStatus(tx, {
						unitId: params.collectionId,
						toStatus: body.status,
						actor: { kind: "profile", profileId: profile.unitId },
						authorization: {
							kind: "interactive",
							statusUpdateAllowed: statusUpdateDecision?.allowed ?? false,
						},
						revisionId: revision.revisionId,
					});
			});
			return getCollection(params.collectionId, authorization);
		},
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: UpdateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: CollectionMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					UnitRevisionConflictResponse,
				]),
			},
			detail: { summary: "Update collection", tags: ["Collections"] },
		},
	)
	.delete(
		"/:collectionId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.delete");
			const [current] = await database
				.select({ favoritesProfileId: profileFavoritesCollection.profileId })
				.from(collection)
				.leftJoin(
					profileFavoritesCollection,
					eq(profileFavoritesCollection.collectionId, collection.id),
				)
				.where(eq(collection.id, params.collectionId))
				.limit(1);
			if (current?.favoritesProfileId) throw new FavoritesDeleteForbidden();
			await database.transaction(async (tx) => {
				await tx
					.update(unit)
					.set({ deletedAt: new Date() })
					.where(eq(unit.id, params.collectionId));
				await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "delete",
					baseRevisionId: body.baseRevisionId,
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "write:unit:delete",
			params: CollectionParams,
			body: CollectionRevisionBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesDeleteResponse,
					UnitRevisionConflictResponse,
				]),
			},
			detail: {
				summary: "Delete collection",
				tags: ["Collections"],
				responses: NoContentResponse,
			},
		},
	)
	.post(
		"/:collectionId/items/batch",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			if (new Set(body.items.map(({ targetId }) => targetId)).size !== body.items.length)
				throw new ValidationError({ items: "targetId values must be unique" });
			if (body.items.some(({ targetId }) => targetId === params.collectionId))
				throw new ValidationError({ items: "a Collection cannot contain itself" });
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				await ensureEditableCollection(tx, params.collectionId);
				for (const item of body.items) {
					const decision = await authorization.unit.decideInTransaction(
						tx,
						item.targetId,
						"unit.read",
					);
					if (!decision.allowed) throw new UnitNotFound();
				}
				const targetIds = body.items.map(({ targetId }) => targetId);
				const existing = await tx
					.select({ unitId: collectionItem.unitId })
					.from(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, params.collectionId),
							inArray(collectionItem.unitId, targetIds),
						),
					);
				const existingIds = new Set(existing.map(({ unitId }) => unitId));
				const pending = body.items.filter(({ targetId }) => !existingIds.has(targetId));
				const [last] = await tx
					.select({ position: collectionItem.position })
					.from(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, params.collectionId),
							isNull(collectionItem.parentUnitId),
						),
					)
					.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
					.limit(1);
				let lastPosition = last?.position;
				const values = pending.map((item) => {
					const position = fractionalPositionBetween(lastPosition, null);
					lastPosition = position;
					return {
						collectionId: params.collectionId,
						unitId: item.targetId,
						parentUnitId: null,
						position,
						addedByProfileId: profile.unitId,
					};
				});
				if (values.length) {
					await tx.insert(collectionItem).values(values).onConflictDoNothing();
					await recordUnitRevision(tx, {
						unitId: params.collectionId,
						actorProfileId: profile.unitId,
						event: "update",
						baseRevisionId: body.baseRevisionId,
					});
				}
				return {
					items: body.items.map(({ targetId }) => ({
						targetId,
						state: existingIds.has(targetId)
							? ("existing" as const)
							: ("created" as const),
					})),
				};
			});
		},
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: AddCollectionItemsBatchBody,
			response: {
				[StatusCodes.OK]: AddCollectionItemsBatchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					UnitRevisionConflictResponse,
				]),
			},
			detail: { summary: "Add collection items atomically", tags: ["Collections"] },
		},
	)
	.post(
		"/:collectionId/items/move",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			const latestRevisionId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				await ensureEditableCollection(tx, params.collectionId);
				const memberships = await tx
					.select({
						unitId: collectionItem.unitId,
						parentUnitId: collectionItem.parentUnitId,
						position: collectionItem.position,
					})
					.from(collectionItem)
					.where(eq(collectionItem.collectionId, params.collectionId))
					.orderBy(
						asc(collectionItem.parentUnitId),
						asc(collectionItem.position),
						asc(collectionItem.unitId),
					);
				const membershipById = new Map(
					memberships.map((membership) => [membership.unitId, membership]),
				);
				const selectedIds = new Set(body.targetIds);
				if (selectedIds.size !== body.targetIds.length)
					throw new ValidationError({ targetIds: "targetId values must be unique" });
				if (body.targetIds.some((targetId) => !membershipById.has(targetId)))
					throw new ValidationError({
						targetIds: "every moved item must belong to this Collection",
					});
				const moveRootIds = orderedCollectionMoveRoots(selectedIds, memberships);
				const movingSubtreeIds = collectionSubtreeIds(moveRootIds, memberships);

				let destinationParentId: string | null;
				let beforePosition: string | null;
				let afterPosition: string | null;
				if (body.placement.kind === "after") {
					const anchor = membershipById.get(body.placement.targetId);
					if (!anchor)
						throw new ValidationError({
							placement: "the destination item must belong to this Collection",
						});
					if (movingSubtreeIds.has(anchor.unitId))
						throw new ValidationError({
							placement: "the destination cannot be inside a moved subtree",
						});
					destinationParentId = anchor.parentUnitId;
					const siblings = memberships.filter(
						(membership) =>
							membership.parentUnitId === destinationParentId &&
							!moveRootIds.includes(membership.unitId),
					);
					const anchorIndex = siblings.findIndex(
						(membership) => membership.unitId === anchor.unitId,
					);
					if (anchorIndex < 0)
						throw new ValidationError({ placement: "the destination is invalid" });
					beforePosition = anchor.position;
					afterPosition = siblings[anchorIndex + 1]?.position ?? null;
				} else {
					destinationParentId = body.placement.parentTargetId;
					if (
						destinationParentId &&
						(!membershipById.has(destinationParentId) ||
							movingSubtreeIds.has(destinationParentId))
					)
						throw new ValidationError({
							placement: "the parent must be outside every moved subtree",
						});
					const siblings = memberships.filter(
						(membership) =>
							membership.parentUnitId === destinationParentId &&
							!moveRootIds.includes(membership.unitId),
					);
					if (body.placement.kind === "start") {
						beforePosition = null;
						afterPosition = siblings[0]?.position ?? null;
					} else {
						beforePosition = siblings.at(-1)?.position ?? null;
						afterPosition = null;
					}
				}
				const positions = fractionalPositionsBetween(
					beforePosition,
					afterPosition,
					moveRootIds.length,
				);
				for (const unitId of moveRootIds)
					await tx
						.update(collectionItem)
						.set({
							parentUnitId: destinationParentId,
							position: `~moving-${unitId}`,
						})
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, unitId),
							),
						);
				for (const [index, unitId] of moveRootIds.entries()) {
					const position = positions[index];
					if (!position)
						throw new Error("Fractional position generation returned too few values");
					await tx
						.update(collectionItem)
						.set({
							parentUnitId: destinationParentId,
							position,
						})
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, unitId),
							),
						);
				}
				const revision = await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				return revision.revisionId;
			});
			return { saved: true, latestRevisionId };
		},
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: MoveCollectionItemsBody,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					UnitRevisionConflictResponse,
				]),
			},
			detail: { summary: "Move collection items atomically", tags: ["Collections"] },
		},
	)
	.put(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			if (params.targetId === params.collectionId)
				throw new ValidationError({ targetId: "a Collection cannot contain itself" });
			await authorization.unit.ensureCanRead(params.targetId);
			const latestRevisionId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				await ensureEditableCollection(tx, params.collectionId);
				if (body.placement === "review-with-subject") {
					if (body.parentTargetId !== undefined)
						throw new ValidationError({
							placement: "review placement derives its parent and position",
						});
					const [review] = await tx
						.select({ kind: post.kind, subjectUnitId: post.subjectUnitId })
						.from(post)
						.where(eq(post.id, params.targetId))
						.limit(1);
					if (review?.kind !== "review" || !review.subjectUnitId)
						throw new ValidationError({
							targetId: "review placement requires a Review target",
						});
					if (review.subjectUnitId === params.collectionId)
						throw new ValidationError({
							targetId: "a Collection cannot contain itself as a Review subject",
						});
					const subjectDecision = await authorization.unit.decideInTransaction(
						tx,
						review.subjectUnitId,
						"unit.read",
					);
					if (!subjectDecision.allowed) throw new UnitNotFound();
					const [subjectMembership] = await tx
						.select({ unitId: collectionItem.unitId })
						.from(collectionItem)
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, review.subjectUnitId),
							),
						)
						.limit(1);
					if (!subjectMembership) {
						await tx.insert(collectionItem).values({
							collectionId: params.collectionId,
							unitId: review.subjectUnitId,
							parentUnitId: null,
							position: await nextCollectionItemPosition(tx, params.collectionId),
							addedByProfileId: profile.unitId,
						});
					}
					await ensureValidCollectionParent(tx, {
						collectionId: params.collectionId,
						targetId: params.targetId,
						parentTargetId: review.subjectUnitId,
					});
					const [reviewMembership] = await tx
						.select({
							parentUnitId: collectionItem.parentUnitId,
							position: collectionItem.position,
						})
						.from(collectionItem)
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, params.targetId),
							),
						)
						.limit(1);
					const position =
						reviewMembership?.parentUnitId === review.subjectUnitId
							? reviewMembership.position
							: await nextCollectionItemPosition(
									tx,
									params.collectionId,
									review.subjectUnitId,
								);
					await tx
						.insert(collectionItem)
						.values({
							collectionId: params.collectionId,
							unitId: params.targetId,
							parentUnitId: review.subjectUnitId,
							position,
							addedByProfileId: profile.unitId,
						})
						.onConflictDoUpdate({
							target: [collectionItem.collectionId, collectionItem.unitId],
							set: {
								parentUnitId: review.subjectUnitId,
								position,
							},
						});
				} else {
					const parentTargetId = body.parentTargetId ?? null;
					await ensureValidCollectionParent(tx, {
						collectionId: params.collectionId,
						targetId: params.targetId,
						parentTargetId,
					});
					const [existing] = await tx
						.select({
							parentUnitId: collectionItem.parentUnitId,
							position: collectionItem.position,
						})
						.from(collectionItem)
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, params.targetId),
							),
						)
						.limit(1);
					const position =
						existing?.parentUnitId === parentTargetId
							? existing.position
							: await nextCollectionItemPosition(
									tx,
									params.collectionId,
									parentTargetId,
								);
					await tx
						.insert(collectionItem)
						.values({
							collectionId: params.collectionId,
							unitId: params.targetId,
							parentUnitId: parentTargetId,
							position,
							addedByProfileId: profile.unitId,
						})
						.onConflictDoUpdate({
							target: [collectionItem.collectionId, collectionItem.unitId],
							set: {
								parentUnitId: parentTargetId,
								position,
							},
						});
				}
				const revision = await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				return revision.revisionId;
			});
			return { saved: true, latestRevisionId };
		},
		{
			access: "write:unit:update",
			params: CollectionItemParams,
			body: SaveCollectionItemBody,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					UnitRevisionConflictResponse,
				]),
			},
			detail: { summary: "Save collection item", tags: ["Collections"] },
		},
	)
	.delete(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			const latestRevisionId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				await ensureEditableCollection(tx, params.collectionId);
				const children = await tx
					.select({
						unitId: collectionItem.unitId,
						position: collectionItem.position,
					})
					.from(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, params.collectionId),
							eq(collectionItem.parentUnitId, params.targetId),
						),
					)
					.orderBy(asc(collectionItem.position), asc(collectionItem.unitId));
				if (children.length) {
					const [lastRoot] = await tx
						.select({ position: collectionItem.position })
						.from(collectionItem)
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								isNull(collectionItem.parentUnitId),
								ne(collectionItem.unitId, params.targetId),
							),
						)
						.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
						.limit(1);
					const positions = fractionalPositionsBetween(
						lastRoot?.position,
						null,
						children.length,
					);
					for (const child of children)
						await tx
							.update(collectionItem)
							.set({ parentUnitId: null, position: `~promoting-${child.unitId}` })
							.where(
								and(
									eq(collectionItem.collectionId, params.collectionId),
									eq(collectionItem.unitId, child.unitId),
								),
							);
					for (const [index, child] of children.entries()) {
						const position = positions[index];
						if (!position)
							throw new Error(
								"Fractional position generation returned too few values",
							);
						await tx
							.update(collectionItem)
							.set({ position })
							.where(
								and(
									eq(collectionItem.collectionId, params.collectionId),
									eq(collectionItem.unitId, child.unitId),
								),
							);
					}
				}
				await tx
					.delete(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, params.collectionId),
							eq(collectionItem.unitId, params.targetId),
						),
					);
				const revision = await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				return revision.revisionId;
			});
			return { saved: false, latestRevisionId };
		},
		{
			access: "write:unit:update",
			params: CollectionItemParams,
			body: CollectionRevisionBody,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					UnitRevisionConflictResponse,
				]),
			},
			detail: { summary: "Remove collection item", tags: ["Collections"] },
		},
	)
	.put(
		"/favorites/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanRead(params.targetId);
			const collectionId = await ensureFavorites(profile.unitId);
			const latestRevisionId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${collectionId}::text, 0))`,
				);
				await tx
					.insert(collectionItem)
					.values({
						collectionId,
						unitId: params.targetId,
						parentUnitId: null,
						position: await nextCollectionItemPosition(tx, collectionId),
						addedByProfileId: profile.unitId,
					})
					.onConflictDoNothing();
				const revision = await recordUnitRevision(tx, {
					unitId: collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				return revision.revisionId;
			});
			return { favorited: true, collectionId, latestRevisionId };
		},
		{
			access: "write:unit:update",
			params: FavoriteItemParams,
			body: CollectionRevisionBody,
			response: {
				[StatusCodes.OK]: FavoriteResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: UnitRevisionConflictResponse,
			},
			detail: { summary: "Favorite unit", tags: ["Collections"] },
		},
	)
	.delete(
		"/favorites/items/:targetId",
		async ({ params, profile, body }) => {
			const collectionId = await ensureFavorites(profile.unitId);
			const latestRevisionId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${collectionId}::text, 0))`,
				);
				await tx
					.delete(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, collectionId),
							eq(collectionItem.unitId, params.targetId),
						),
					);
				const revision = await recordUnitRevision(tx, {
					unitId: collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				return revision.revisionId;
			});
			return { favorited: false, collectionId, latestRevisionId };
		},
		{
			access: "write:unit:update",
			params: FavoriteItemParams,
			body: CollectionRevisionBody,
			response: {
				[StatusCodes.OK]: FavoriteResponse,
				[StatusCodes.CONFLICT]: UnitRevisionConflictResponse,
			},
			detail: { summary: "Remove favorite unit", tags: ["Collections"] },
		},
	);
