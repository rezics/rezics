import { StatusCodes } from "http-status-codes";
import { and, desc, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	collection,
	collectionItem,
	unit,
	unitCollaborator,
	unitLocalization,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import {
	CollectionItemParams,
	CollectionParams,
	CreateCollectionBody,
	FavoriteItemParams,
	ListCollectionsQuery,
	SaveCollectionItemBody,
	UpdateCollectionBody,
} from "./schema";
import { ensureFavorites, getCollection } from "./service";
import { FavoriteResponse, NoContentResponse, SavedResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CollectionDetailResponse,
	CollectionListResponse,
} from "../schema/response";
import { FavoritesDeleteForbidden, FavoritesEditForbidden } from "./errors";

const CollectionNotFoundResponse = toApiErrorResponse(["CollectionNotFound"]);
const CollectionOwnershipResponse = toApiErrorResponse(["CollectionOwnershipRequired"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const FavoritesEditResponse = toApiErrorResponse(["FavoritesEditForbidden"]);
const FavoritesDeleteResponse = toApiErrorResponse(["FavoritesDeleteForbidden"]);

export default new Elysia({ prefix: "/collections" })
	.use(session)
	.get(
		"",
		async ({ query }) => ({
			items: await database
				.select({
					id: collection.id,
					ownerId: collection.ownerProfileId,
					itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collection.id})::int`,
					slug: unit.slug,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					updatedAt: unit.updatedAt,
				})
				.from(collection)
				.innerJoin(unit, eq(unit.id, collection.id))
				.leftJoin(
					unitLocalization,
					and(eq(unitLocalization.unitId, unit.id), eq(unitLocalization.isDefault, true)),
				)
				.where(
					and(
						eq(unit.status, "published"),
						eq(unit.visibility, "public"),
						eq(collection.kind, "custom"),
						query.ownerId ? eq(collection.ownerProfileId, query.ownerId) : undefined,
					),
				)
				.orderBy(desc(unit.updatedAt))
				.limit(query.limit ?? 20),
		}),
		{
			query: ListCollectionsQuery,
			response: { [StatusCodes.OK]: CollectionListResponse },
			detail: { summary: "List public collections", tags: ["Collections"] },
		},
	)
	.post(
		"",
		async ({ profile, body }) => {
			const id = await database.transaction(async (tx) => {
				const [created] = await tx
					.insert(unit)
					.values({
						kind: "collection",
						slug: body.slug,
						visibility: body.visibility ?? "private",
					})
					.returning({ id: unit.id });
				if (!created) throw new Error("Collection insertion did not return an id");
				await tx
					.insert(collection)
					.values({ id: created.id, ownerProfileId: profile.unitId });
				await tx
					.insert(unitLocalization)
					.values({ unitId: created.id, ...body.localization, isDefault: true });
				await tx.insert(unitCollaborator).values({
					unitId: created.id,
					profileId: profile.unitId,
					role: "owner",
					addedByProfileId: profile.unitId,
				});
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				return created.id;
			});
			return getCollection(id, profile.unitId);
		},
		{
			write: true,
			body: CreateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Create collection", tags: ["Collections"] },
		},
	)
	.get(
		"/favorites",
		async ({ profile }) => {
			return getCollection(await ensureFavorites(profile.unitId), profile.unitId);
		},
		{
			write: true,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Get Favorites collection", tags: ["Collections"] },
		},
	)
	.get(
		"/:collectionId",
		async ({ params, request }) => {
			return getCollection(
				params.collectionId,
				(await resolveIdentity(request.headers)).profile?.unitId,
			);
		},
		{
			params: CollectionParams,
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
			await authorization.collection.ensureOwner(params.collectionId);
			const [current] = await database
				.select({ kind: collection.kind })
				.from(collection)
				.where(eq(collection.id, params.collectionId))
				.limit(1);
			if (current?.kind === "favorites") throw new FavoritesEditForbidden();
			await database.transaction(async (tx) => {
				await tx
					.update(unit)
					.set({
						status: body.status,
						visibility: body.visibility,
						...(body.status === "published" ? { publishedAt: new Date() } : {}),
					})
					.where(eq(unit.id, params.collectionId));
				if (body.localization) {
					await tx
						.update(unitLocalization)
						.set({ isDefault: false })
						.where(eq(unitLocalization.unitId, params.collectionId));
					await tx
						.insert(unitLocalization)
						.values({
							unitId: params.collectionId,
							...body.localization,
							isDefault: true,
						})
						.onConflictDoUpdate({
							target: [unitLocalization.unitId, unitLocalization.language],
							set: { ...body.localization, isDefault: true },
						});
				}
				await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return getCollection(params.collectionId, profile.unitId);
		},
		{
			write: true,
			params: CollectionParams,
			body: UpdateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.FORBIDDEN]: CollectionOwnershipResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
				[StatusCodes.CONFLICT]: FavoritesEditResponse,
			},
			detail: { summary: "Update collection", tags: ["Collections"] },
		},
	)
	.delete(
		"/:collectionId",
		async ({ params, profile, authorization }) => {
			await authorization.collection.ensureOwner(params.collectionId);
			const [current] = await database
				.select({ kind: collection.kind })
				.from(collection)
				.where(eq(collection.id, params.collectionId))
				.limit(1);
			if (current?.kind === "favorites") throw new FavoritesDeleteForbidden();
			await database.transaction(async (tx) => {
				await tx
					.update(unit)
					.set({ deletedAt: new Date() })
					.where(eq(unit.id, params.collectionId));
				await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "delete",
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
			params: CollectionParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: CollectionOwnershipResponse,
				[StatusCodes.CONFLICT]: FavoritesDeleteResponse,
			},
			detail: {
				summary: "Delete collection",
				tags: ["Collections"],
				responses: NoContentResponse,
			},
		},
	)
	.put(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.collection.ensureOwner(params.collectionId);
			await authorization.unit.ensureCanRead(params.targetId);
			await database.transaction(async (tx) => {
				await tx
					.insert(collectionItem)
					.values({
						collectionId: params.collectionId,
						unitId: params.targetId,
						role: body.kind ?? "item",
						position: body.position ?? "V",
						addedByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [collectionItem.collectionId, collectionItem.unitId],
						set: { role: body.kind ?? "item", position: body.position ?? "V" },
					});
				await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return { saved: true };
		},
		{
			write: true,
			params: CollectionItemParams,
			body: SaveCollectionItemBody,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.FORBIDDEN]: CollectionOwnershipResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Save collection item", tags: ["Collections"] },
		},
	)
	.delete(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization }) => {
			await authorization.collection.ensureOwner(params.collectionId);
			await database.transaction(async (tx) => {
				await tx
					.delete(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, params.collectionId),
							eq(collectionItem.unitId, params.targetId),
						),
					);
				await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return { saved: false };
		},
		{
			write: true,
			params: CollectionItemParams,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.FORBIDDEN]: CollectionOwnershipResponse,
			},
			detail: { summary: "Remove collection item", tags: ["Collections"] },
		},
	)
	.put(
		"/favorites/items/:targetId",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureCanRead(params.targetId);
			const collectionId = await ensureFavorites(profile.unitId);
			await database.transaction(async (tx) => {
				await tx
					.insert(collectionItem)
					.values({
						collectionId,
						unitId: params.targetId,
						role: "favorite",
						addedByProfileId: profile.unitId,
					})
					.onConflictDoNothing();
				await recordUnitRevision(tx, {
					unitId: collectionId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return { favorited: true, collectionId };
		},
		{
			write: true,
			params: FavoriteItemParams,
			response: {
				[StatusCodes.OK]: FavoriteResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Favorite unit", tags: ["Collections"] },
		},
	)
	.delete(
		"/favorites/items/:targetId",
		async ({ params, profile }) => {
			const collectionId = await ensureFavorites(profile.unitId);
			await database.transaction(async (tx) => {
				await tx
					.delete(collectionItem)
					.where(
						and(
							eq(collectionItem.collectionId, collectionId),
							eq(collectionItem.unitId, params.targetId),
						),
					);
				await recordUnitRevision(tx, {
					unitId: collectionId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return { favorited: false, collectionId };
		},
		{
			write: true,
			params: FavoriteItemParams,
			response: { [StatusCodes.OK]: FavoriteResponse },
			detail: { summary: "Remove favorite unit", tags: ["Collections"] },
		},
	);
