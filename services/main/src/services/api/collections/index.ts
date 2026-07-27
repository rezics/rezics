import { StatusCodes } from "http-status-codes";
import {
	createCollectionPresentationDocument,
	createManualCollectionDefinitionDocument,
} from "@rezics/block";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database, type DatabaseTransaction } from "../../database";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	resolvedUnitLocalizationLanguage,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	collection,
	collectionItem,
	post,
	unit,
	unitAccessBinding,
	unitLocalization,
	unitRevisionHead,
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
	CollectionItemsQuery,
	CollectionRevisionBody,
	CreateCollectionBody,
	FavoriteItemParams,
	ListCollectionsQuery,
	SaveCollectionItemBody,
	UpdateCollectionBody,
} from "./schema";
import { ensureFavorites, getCollection, getCollectionContent } from "./service";
import { validateCollectionParent } from "./hierarchy";
import { canListAllOwnedCollections } from "./list-access";
import { FavoriteResponse, NoContentResponse, SavedResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CollectionContentResponse,
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
const CollectionMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"UnitProtected",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const FavoritesEditResponse = toApiErrorResponse(["FavoritesEditForbidden"]);
const FavoritesDeleteResponse = toApiErrorResponse(["FavoritesDeleteForbidden"]);
const UnitRevisionConflictResponse = toApiErrorResponse(["UnitRevisionConflict"]);
const InvalidPaginationCursorResponse = toApiErrorResponse(["InvalidPaginationCursor"]);

async function ensureManualCollection(tx: DatabaseTransaction, collectionId: string) {
	const [record] = await tx
		.select({ source: collection.source, systemKey: collection.systemKey })
		.from(collection)
		.where(eq(collection.id, collectionId))
		.limit(1);
	if (!record) throw new UnitNotFound();
	if (record.systemKey === "favorites") throw new FavoritesEditForbidden();
	if (record.source !== "manual")
		throw new ValidationError({ collectionId: "only manual Collections accept direct items" });
	return record;
}

async function nextCollectionItemPosition(tx: DatabaseTransaction, collectionId: string) {
	const [last] = await tx
		.select({ position: collectionItem.position })
		.from(collectionItem)
		.where(eq(collectionItem.collectionId, collectionId))
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
					source: collection.source,
					systemKey: collection.systemKey,
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
						isOwnerQuery ? undefined : eq(unit.status, "published"),
						isOwnerQuery ? undefined : eq(unit.visibility, "public"),
						isOwnerQuery ? undefined : ne(collection.source, "system"),
						query.ownerId ? eq(collection.ownerProfileId, query.ownerId) : undefined,
					),
				)
				.orderBy(desc(unit.updatedAt))
				.limit(query.limit ?? 20);
			return {
				items: items.map(({ coverAssetId, ...item }) => ({
					...item,
					acceptsItems:
						isOwnerQuery &&
						(item.source === "manual" ||
							(item.source === "system" && item.systemKey === "favorites")),
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
		async ({ profile, authorization, body }) => {
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
							publishAllowed: publishDecision?.allowed ?? false,
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
				await ensureManualCollection(tx, params.collectionId);
				if (body.items.some(({ role }) => role === "favorite"))
					throw new ValidationError({
						items: "the favorite role belongs only to Favorites",
					});
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
						parentUnitId: null,
						role: item.role ?? "item",
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
	.put(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			if (params.targetId === params.collectionId)
				throw new ValidationError({ targetId: "a Collection cannot contain itself" });
			await authorization.unit.ensureCanRead(params.targetId);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				await ensureManualCollection(tx, params.collectionId);
				if (body.role === "favorite")
					throw new ValidationError({
						role: "the favorite role belongs only to Favorites",
					});
				const role = body.role ?? "item";
				if (body.placement === "review-with-subject") {
					if (body.parentTargetId !== undefined || body.position !== undefined)
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
							role: "item",
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
						.select({ position: collectionItem.position })
						.from(collectionItem)
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, params.targetId),
							),
						)
						.limit(1);
					await tx
						.insert(collectionItem)
						.values({
							collectionId: params.collectionId,
							unitId: params.targetId,
							parentUnitId: review.subjectUnitId,
							role,
							position:
								reviewMembership?.position ??
								(await nextCollectionItemPosition(tx, params.collectionId)),
							addedByProfileId: profile.unitId,
						})
						.onConflictDoUpdate({
							target: [collectionItem.collectionId, collectionItem.unitId],
							set: { parentUnitId: review.subjectUnitId, role },
						});
				} else {
					const parentTargetId = body.parentTargetId ?? null;
					await ensureValidCollectionParent(tx, {
						collectionId: params.collectionId,
						targetId: params.targetId,
						parentTargetId,
					});
					const [existing] = await tx
						.select({ position: collectionItem.position })
						.from(collectionItem)
						.where(
							and(
								eq(collectionItem.collectionId, params.collectionId),
								eq(collectionItem.unitId, params.targetId),
							),
						)
						.limit(1);
					const position =
						body.position ??
						existing?.position ??
						(await nextCollectionItemPosition(tx, params.collectionId));
					await tx
						.insert(collectionItem)
						.values({
							collectionId: params.collectionId,
							unitId: params.targetId,
							parentUnitId: parentTargetId,
							role,
							position,
							addedByProfileId: profile.unitId,
						})
						.onConflictDoUpdate({
							target: [collectionItem.collectionId, collectionItem.unitId],
							set: {
								parentUnitId: parentTargetId,
								role,
								...(body.position === undefined ? {} : { position }),
							},
						});
				}
				await recordUnitRevision(tx, {
					unitId: params.collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
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
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.collectionId}::text, 0))`,
				);
				await ensureManualCollection(tx, params.collectionId);
				await tx
					.update(collectionItem)
					.set({ parentUnitId: null })
					.where(
						and(
							eq(collectionItem.collectionId, params.collectionId),
							eq(collectionItem.parentUnitId, params.targetId),
						),
					);
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
					baseRevisionId: body.baseRevisionId,
				});
			});
			return { saved: false };
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
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${collectionId}::text, 0))`,
				);
				await tx
					.insert(collectionItem)
					.values({
						collectionId,
						unitId: params.targetId,
						parentUnitId: null,
						role: "favorite",
						position: await nextCollectionItemPosition(tx, collectionId),
						addedByProfileId: profile.unitId,
					})
					.onConflictDoNothing();
				await recordUnitRevision(tx, {
					unitId: collectionId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
			});
			return { favorited: true, collectionId };
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
					baseRevisionId: body.baseRevisionId,
				});
			});
			return { favorited: false, collectionId };
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
