import { StatusCodes } from "http-status-codes";
import {
	createCollectionPresentationDocument,
	createManualCollectionDefinitionDocument,
} from "@rezics/block";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	makePrimaryUnitLocalization,
	resolvedUnitLocalizationLanguage,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	collection,
	collectionItem,
	unit,
	unitAccessBinding,
	unitLocalization,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { transitionUnitStatus } from "../../units/status";
import { UnitNotFound } from "../../units/errors";
import { presentImageAsset } from "../../units/service";
import {
	AddCollectionItemsBatchBody,
	AddCollectionItemsBatchResponse,
	CollectionItemParams,
	CollectionParams,
	CollectionDetailQuery,
	CreateCollectionBody,
	FavoriteItemParams,
	ListCollectionsQuery,
	SaveCollectionItemBody,
	UpdateCollectionBody,
} from "./schema";
import { ensureFavorites, getCollection } from "./service";
import { canListAllOwnedCollections } from "./list-access";
import { FavoriteResponse, NoContentResponse, SavedResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CollectionDetailResponse,
	CollectionListResponse,
} from "../schema/response";
import { FavoritesDeleteForbidden, FavoritesEditForbidden } from "./errors";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { ValidationError } from "../errors";

const CollectionNotFoundResponse = toApiErrorResponse(["CollectionNotFound"]);
const CollectionMutationNotFoundResponse = toApiErrorResponse([
	"CollectionNotFound",
	"ImageAssetNotFound",
]);
const CollectionOwnershipResponse = toApiErrorResponse(["CollectionOwnershipRequired"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const FavoritesEditResponse = toApiErrorResponse(["FavoritesEditForbidden"]);
const FavoritesDeleteResponse = toApiErrorResponse(["FavoritesDeleteForbidden"]);

export default new Elysia({ prefix: "/collections" })
	.use(session)
	.get(
		"",
		async ({ query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const viewerId = query.ownerId
				? (await resolveIdentity(request.headers, "unit:read")).profile?.unitId
				: undefined;
			const isOwnerQuery = canListAllOwnedCollections({
				ownerId: query.ownerId,
				viewerId,
			});
			const items = await database
				.select({
					id: collection.id,
					ownerId: collection.ownerProfileId,
					language: unitLocalization.language,
					itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collection.id})::int`,
					containsTarget: query.targetId
						? sql<boolean>`exists(select 1 from ${collectionItem} selected_item where selected_item.collection_id = ${collection.id} and selected_item.unit_id = ${query.targetId})`
						: sql<boolean>`false`,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					coverAssetId: unitLocalization.coverAssetId,
					updatedAt: unit.updatedAt,
				})
				.from(collection)
				.innerJoin(unit, eq(unit.id, collection.id))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(
								unit.id,
								localizationLanguages,
							),
						),
					),
				)
				.where(
					and(
						isOwnerQuery ? undefined : eq(unit.status, "published"),
						isOwnerQuery ? undefined : eq(unit.visibility, "public"),
						ne(collection.source, "system"),
						query.ownerId ? eq(collection.ownerProfileId, query.ownerId) : undefined,
					),
				)
				.orderBy(desc(unit.updatedAt))
				.limit(query.limit ?? 20);
			return {
				items: items.map(({ coverAssetId, ...item }) => ({
					...item,
					cover: presentImageAsset(coverAssetId, "cover"),
				})),
			};
		},
		{
			query: ListCollectionsQuery,
			response: { [StatusCodes.OK]: CollectionListResponse },
			detail: { summary: "List collections", tags: ["Collections"] },
		},
	)
	.post(
		"",
		async ({ profile, body }) => {
			const id = await database.transaction(async (tx) => {
				await ensureImageAssetsAttachable(
					tx,
					profile.unitId,
					unitLocalizationImageAssetReferences(body.localization),
				);
				const definitionDocument =
					body.definitionDocument ?? createManualCollectionDefinitionDocument();
				const created = await insertUnit(tx, {
					kind: "collection",
					visibility: body.visibility ?? "private",
					statusActor: { kind: "profile", profileId: profile.unitId },
				});
				await tx.insert(collection).values({
					id: created.id,
					ownerProfileId: profile.unitId,
					source: definitionDocument.source,
					definitionDocument,
					presentationDocument:
						body.presentationDocument ?? createCollectionPresentationDocument(),
				});
				await tx.insert(unitLocalization).values({
					unitId: created.id,
					...toUnitLocalizationStorage(body.localization),
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
				return created.id;
			});
			return getCollection(id, profile.unitId);
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
		async ({ profile, query }) => {
			return getCollection(
				await ensureFavorites(profile.unitId),
				profile.unitId,
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
		"/:collectionId",
		async ({ params, query, request }) => {
			return getCollection(
				params.collectionId,
				(await resolveIdentity(request.headers, "unit:read")).profile?.unitId,
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
			await authorization.collection.ensureOwner(params.collectionId);
			const publishDecision = body.status
				? await authorization.unit.decide(params.collectionId, "unit.publish", ["unit"])
				: undefined;
			const [current] = await database
				.select({ systemKey: collection.systemKey })
				.from(collection)
				.innerJoin(unit, eq(unit.id, collection.id))
				.where(eq(collection.id, params.collectionId))
				.limit(1);
			if (current?.systemKey === "favorites") throw new FavoritesEditForbidden();
			await database.transaction(async (tx) => {
				if (body.localization)
					await ensureImageAssetsAttachable(
						tx,
						profile.unitId,
						unitLocalizationImageAssetReferences(body.localization),
					);
				await tx
					.update(unit)
					.set({
						visibility: body.visibility,
					})
					.where(eq(unit.id, params.collectionId));
				if (body.definitionDocument || body.presentationDocument) {
					await tx
						.update(collection)
						.set({
							source: body.definitionDocument?.source,
							definitionDocument: body.definitionDocument,
							presentationDocument: body.presentationDocument,
						})
						.where(eq(collection.id, params.collectionId));
				}
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
					await makePrimaryUnitLocalization(
						tx,
						params.collectionId,
						body.localization.language,
					);
				}
				const revision = await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				if (body.status)
					await transitionUnitStatus(tx, {
						unitId: params.collectionId,
						toStatus: body.status,
						actor: { kind: "profile", profileId: profile.unitId },
						authorization: {
							kind: "interactive",
							publishAllowed: publishDecision?.allowed ?? false,
						},
						revisionId: revision.revisionId,
					});
			});
			return getCollection(params.collectionId, profile.unitId);
		},
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: UpdateCollectionBody,
			response: {
				[StatusCodes.OK]: CollectionDetailResponse,
				[StatusCodes.FORBIDDEN]: CollectionOwnershipResponse,
				[StatusCodes.NOT_FOUND]: CollectionMutationNotFoundResponse,
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
				.select({ systemKey: collection.systemKey })
				.from(collection)
				.where(eq(collection.id, params.collectionId))
				.limit(1);
			if (current?.systemKey === "favorites") throw new FavoritesDeleteForbidden();
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
			access: "write:unit:delete",
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
	.post(
		"/:collectionId/items/batch",
		async ({ params, profile, authorization, body }) => {
			await authorization.collection.ensureOwner(params.collectionId);
			if (new Set(body.items.map(({ targetId }) => targetId)).size !== body.items.length)
				throw new ValidationError({ items: "targetId values must be unique" });
			if (body.items.some(({ targetId }) => targetId === params.collectionId))
				throw new ValidationError({ items: "a Collection cannot contain itself" });
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				const [targetCollection] = await tx
					.select({ systemKey: collection.systemKey })
					.from(collection)
					.where(eq(collection.id, params.collectionId))
					.limit(1);
				if (targetCollection?.systemKey === "favorites") throw new FavoritesEditForbidden();
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
					.where(eq(collectionItem.collectionId, params.collectionId))
					.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
					.limit(1);
				let lastPosition = last?.position;
				const values = pending.map((item) => {
					const position = fractionalPositionBetween(lastPosition, null);
					lastPosition = position;
					return {
						collectionId: params.collectionId,
						unitId: item.targetId,
						role: item.kind ?? "item",
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
				[StatusCodes.FORBIDDEN]: CollectionOwnershipResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: FavoritesEditResponse,
			},
			detail: { summary: "Add collection items atomically", tags: ["Collections"] },
		},
	)
	.put(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.collection.ensureOwner(params.collectionId);
			if (params.targetId === params.collectionId)
				throw new ValidationError({ targetId: "a Collection cannot contain itself" });
			await authorization.unit.ensureCanRead(params.targetId);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				const [last] = await tx
					.select({ position: collectionItem.position })
					.from(collectionItem)
					.where(eq(collectionItem.collectionId, params.collectionId))
					.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
					.limit(1);
				const position = body.position ?? fractionalPositionBetween(last?.position, null);
				await tx
					.insert(collectionItem)
					.values({
						collectionId: params.collectionId,
						unitId: params.targetId,
						role: body.kind ?? "item",
						position,
						addedByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [collectionItem.collectionId, collectionItem.unitId],
						set:
							body.position === undefined
								? { role: body.kind ?? "item" }
								: { role: body.kind ?? "item", position },
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
			access: "write:unit:update",
			params: CollectionItemParams,
			body: SaveCollectionItemBody,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
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
			access: "write:unit:update",
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
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${collectionId}::text, 0))`,
				);
				const [last] = await tx
					.select({ position: collectionItem.position })
					.from(collectionItem)
					.where(eq(collectionItem.collectionId, collectionId))
					.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
					.limit(1);
				await tx
					.insert(collectionItem)
					.values({
						collectionId,
						unitId: params.targetId,
						role: "favorite",
						position: fractionalPositionBetween(last?.position, null),
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
			access: "write:unit:update",
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
			access: "write:unit:update",
			params: FavoriteItemParams,
			response: { [StatusCodes.OK]: FavoriteResponse },
			detail: { summary: "Remove favorite unit", tags: ["Collections"] },
		},
	);
