import { StatusCodes } from "http-status-codes";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database, type DatabaseTransaction } from "../../database";
import { fractionalPositionBetween, fractionalPositionsBetween } from "../../ordering/position";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	collection,
	collectionItem,
	collectionStructureRevisionHead,
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
	CollectionItemsRevisionBody,
	CollectionStructureRevisionCompareQuery,
	CollectionStructureRevisionCompareResponse,
	CollectionStructureRevisionListQuery,
	CollectionStructureRevisionListResponse,
	CollectionStructureRevisionParams,
	CreateCollectionBody,
	FavoriteItemParams,
	ListCollectionsQuery,
	MoveCollectionItemsBody,
	SaveCollectionItemBody,
	RestoreCollectionStructureRevisionBody,
	RestoreCollectionStructureRevisionResponse,
	UpdateCollectionBody,
} from "./schema";
import { ensureFavorites } from "../../collections/favorites";
import { getCollection, getCollectionContent } from "./service";
import { planCollectionItemInsertions } from "./save";
import { FavoriteResponse, SavedCollectionItemsResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CollectionContentResponse,
	CollectionDetailResponse,
	CollectionListResponse,
} from "../schema/response";
import { FavoritesEditForbidden } from "./errors";
import { decodeCollectionListCursor, encodeCollectionListCursor } from "./cursor";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { ValidationError } from "../errors";
import { createProfilePublisherAttribution } from "../../units/attribution";
import { getAttributionSummariesByUnitIds } from "../../units/attribution";
import { getUnitUpdateCondition } from "../../authorization/unit/query";
import {
	createCollectionStructureHistory,
	getCollectionStructureRevisionState,
	listCollectionStructureRevisions,
	mutateCollectionStructureWithHistory,
	restoreCollectionStructureRevision,
} from "../../collection-structure/history";

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
const UnitRevisionConflictResponse = toApiErrorResponse(["UnitRevisionConflict"]);
const CollectionStructureRevisionConflictResponse = toApiErrorResponse([
	"CollectionStructureRevisionConflict",
]);
const InvalidPaginationCursorResponse = toApiErrorResponse(["InvalidPaginationCursor"]);

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

async function nextCollectionItemPosition(tx: DatabaseTransaction, collectionId: string) {
	const [last] = await tx
		.select({ position: collectionItem.position })
		.from(collectionItem)
		.where(eq(collectionItem.collectionId, collectionId))
		.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
		.limit(1);
	return fractionalPositionBetween(last?.position, null);
}

async function reviewSubjectsForTargets(tx: DatabaseTransaction, targetIds: readonly string[]) {
	const rows = await tx
		.select({
			id: post.id,
			kind: post.kind,
			subjectUnitId: post.subjectUnitId,
		})
		.from(post)
		.where(inArray(post.id, targetIds));
	const subjects = new Map<string, string>();
	for (const row of rows) {
		if (row.kind !== "review") continue;
		if (!row.subjectUnitId) throw new Error("A Review must have an authoritative subject Unit");
		subjects.set(row.id, row.subjectUnitId);
	}
	return subjects;
}

async function planAndInsertCollectionItems(
	tx: DatabaseTransaction,
	input: {
		readonly collectionId: string;
		readonly requestedTargetIds: readonly string[];
		readonly addedByProfileId: string;
		readonly reviewSubjectByTargetId: ReadonlyMap<string, string>;
	},
) {
	if (!input.requestedTargetIds.length)
		throw new TypeError("At least one Collection target ID must be requested");
	const relevantTargetIds = [
		...new Set([...input.requestedTargetIds, ...input.reviewSubjectByTargetId.values()]),
	];
	const existingMemberships = await tx
		.select({
			targetId: collectionItem.unitId,
			position: collectionItem.position,
		})
		.from(collectionItem)
		.where(
			and(
				eq(collectionItem.collectionId, input.collectionId),
				inArray(collectionItem.unitId, relevantTargetIds),
			),
		);
	const existingPositionByTargetId = new Map(
		existingMemberships.map(({ targetId, position }) => [targetId, position]),
	);
	const [last] = await tx
		.select({ position: collectionItem.position })
		.from(collectionItem)
		.where(eq(collectionItem.collectionId, input.collectionId))
		.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
		.limit(1);
	const positionBeforeReviewByTargetId = new Map<string, string | null>();
	for (const targetId of input.requestedTargetIds) {
		const subjectId = input.reviewSubjectByTargetId.get(targetId);
		const reviewPosition = existingPositionByTargetId.get(targetId);
		if (!subjectId || reviewPosition === undefined || existingPositionByTargetId.has(subjectId))
			continue;
		const [previous] = await tx
			.select({ position: collectionItem.position })
			.from(collectionItem)
			.where(
				and(
					eq(collectionItem.collectionId, input.collectionId),
					lt(collectionItem.position, reviewPosition),
				),
			)
			.orderBy(desc(collectionItem.position), desc(collectionItem.unitId))
			.limit(1);
		positionBeforeReviewByTargetId.set(targetId, previous?.position ?? null);
	}
	const planned = planCollectionItemInsertions({
		requestedTargetIds: input.requestedTargetIds,
		existingPositionByTargetId,
		lastPosition: last?.position,
		positionBeforeReviewByTargetId,
		reviewSubjectByTargetId: input.reviewSubjectByTargetId,
	});
	if (planned.insertions.length)
		await tx.insert(collectionItem).values(
			planned.insertions.map(({ targetId, position }) => ({
				collectionId: input.collectionId,
				unitId: targetId,
				position,
				addedByProfileId: input.addedByProfileId,
			})),
		);
	return planned;
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
					latestItemsRevisionId: collectionStructureRevisionHead.revisionId,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					coverAssetId: resolvedUnitLocalizationImageAssetId(
						unit.id,
						"cover",
						localizationLanguages,
					),
					updatedAt: unit.updatedAt,
				})
				.from(collection)
				.innerJoin(unit, eq(unit.id, collection.id))
				.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
				.innerJoin(
					collectionStructureRevisionHead,
					eq(collectionStructureRevisionHead.collectionId, collection.id),
				)
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
				await createCollectionStructureHistory(tx, {
					collectionId: created.id,
					actorProfileId: profile.unitId,
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
	.post(
		"/:collectionId/items/batch",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			if (new Set(body.items.map(({ targetId }) => targetId)).size !== body.items.length)
				throw new ValidationError({ items: "targetId values must be unique" });
			if (body.items.some(({ targetId }) => targetId === params.collectionId))
				throw new ValidationError({ items: "a Collection cannot contain itself" });
			return database.transaction(async (tx) => {
				const result = await mutateCollectionStructureWithHistory(
					tx,
					{
						collectionId: params.collectionId,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseItemsRevisionId,
					},
					async () => {
						await ensureEditableCollection(tx, params.collectionId);
						const targetIds = body.items.map(({ targetId }) => targetId);
						const reviewSubjectByTargetId = await reviewSubjectsForTargets(
							tx,
							targetIds,
						);
						const authorizedTargetIds = new Set([
							...targetIds,
							...reviewSubjectByTargetId.values(),
						]);
						if (authorizedTargetIds.has(params.collectionId))
							throw new ValidationError({
								items: "a Collection cannot contain itself",
							});
						for (const targetId of authorizedTargetIds) {
							const decision = await authorization.unit.decideInTransaction(
								tx,
								targetId,
								"unit.read",
							);
							if (!decision.allowed) throw new UnitNotFound();
						}
						const planned = await planAndInsertCollectionItems(tx, {
							collectionId: params.collectionId,
							requestedTargetIds: targetIds,
							addedByProfileId: profile.unitId,
							reviewSubjectByTargetId,
						});
						return { items: planned.requestedItems };
					},
				);
				return {
					items: [...result.items],
					latestItemsRevisionId: result.revisionId,
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
					CollectionStructureRevisionConflictResponse,
				]),
			},
			detail: { summary: "Add collection items atomically", tags: ["Collections"] },
		},
	)
	.post(
		"/:collectionId/items/move",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			const result = await database.transaction(async (tx) =>
				mutateCollectionStructureWithHistory(
					tx,
					{
						collectionId: params.collectionId,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseItemsRevisionId,
					},
					async () => {
						await ensureEditableCollection(tx, params.collectionId);
						const memberships = await tx
							.select({
								unitId: collectionItem.unitId,
								position: collectionItem.position,
							})
							.from(collectionItem)
							.where(eq(collectionItem.collectionId, params.collectionId))
							.orderBy(asc(collectionItem.position), asc(collectionItem.unitId));
						const membershipById = new Map(
							memberships.map((membership) => [membership.unitId, membership]),
						);
						const selectedIds = new Set(body.targetIds);
						if (selectedIds.size !== body.targetIds.length)
							throw new ValidationError({
								targetIds: "targetId values must be unique",
							});
						if (body.targetIds.some((targetId) => !membershipById.has(targetId)))
							throw new ValidationError({
								targetIds: "every moved item must belong to this Collection",
							});
						const movingIds = memberships
							.filter(({ unitId }) => selectedIds.has(unitId))
							.map(({ unitId }) => unitId);
						const remaining = memberships.filter(
							({ unitId }) => !selectedIds.has(unitId),
						);

						let beforePosition: string | null;
						let afterPosition: string | null;
						if (body.placement.kind === "after") {
							const anchor = membershipById.get(body.placement.targetId);
							if (!anchor)
								throw new ValidationError({
									placement:
										"the destination item must belong to this Collection",
								});
							if (selectedIds.has(anchor.unitId))
								throw new ValidationError({
									placement: "the destination cannot be a moved item",
								});
							const anchorIndex = remaining.findIndex(
								(membership) => membership.unitId === anchor.unitId,
							);
							if (anchorIndex < 0)
								throw new ValidationError({
									placement: "the destination is invalid",
								});
							beforePosition = anchor.position;
							afterPosition = remaining[anchorIndex + 1]?.position ?? null;
						} else {
							if (body.placement.kind === "start") {
								beforePosition = null;
								afterPosition = remaining[0]?.position ?? null;
							} else {
								beforePosition = remaining.at(-1)?.position ?? null;
								afterPosition = null;
							}
						}
						const positions = fractionalPositionsBetween(
							beforePosition,
							afterPosition,
							movingIds.length,
						);
						for (const unitId of movingIds)
							await tx
								.update(collectionItem)
								.set({ position: `~moving-${unitId}` })
								.where(
									and(
										eq(collectionItem.collectionId, params.collectionId),
										eq(collectionItem.unitId, unitId),
									),
								);
						for (const [index, unitId] of movingIds.entries()) {
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
										eq(collectionItem.unitId, unitId),
									),
								);
						}
						return { saved: true };
					},
				),
			);
			return { saved: result.saved, latestItemsRevisionId: result.revisionId };
		},
		{
			access: "write:unit:update",
			params: CollectionParams,
			body: MoveCollectionItemsBody,
			response: {
				[StatusCodes.OK]: SavedCollectionItemsResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					CollectionStructureRevisionConflictResponse,
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
			const result = await database.transaction(async (tx) =>
				mutateCollectionStructureWithHistory(
					tx,
					{
						collectionId: params.collectionId,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseItemsRevisionId,
					},
					async () => {
						await ensureEditableCollection(tx, params.collectionId);
						const reviewSubjectByTargetId = await reviewSubjectsForTargets(tx, [
							params.targetId,
						]);
						const subjectId = reviewSubjectByTargetId.get(params.targetId);
						if (subjectId === params.collectionId)
							throw new ValidationError({
								targetId: "a Collection cannot contain itself as a Review subject",
							});
						if (subjectId) {
							const decision = await authorization.unit.decideInTransaction(
								tx,
								subjectId,
								"unit.read",
							);
							if (!decision.allowed) throw new UnitNotFound();
						}
						await planAndInsertCollectionItems(tx, {
							collectionId: params.collectionId,
							requestedTargetIds: [params.targetId],
							addedByProfileId: profile.unitId,
							reviewSubjectByTargetId,
						});
						return { saved: true };
					},
				),
			);
			return { saved: result.saved, latestItemsRevisionId: result.revisionId };
		},
		{
			access: "write:unit:update",
			params: CollectionItemParams,
			body: SaveCollectionItemBody,
			response: {
				[StatusCodes.OK]: SavedCollectionItemsResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					CollectionStructureRevisionConflictResponse,
				]),
			},
			detail: { summary: "Save collection item", tags: ["Collections"] },
		},
	)
	.delete(
		"/:collectionId/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensure(params.collectionId, "unit.update");
			const result = await database.transaction(async (tx) =>
				mutateCollectionStructureWithHistory(
					tx,
					{
						collectionId: params.collectionId,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseItemsRevisionId,
					},
					async () => {
						await ensureEditableCollection(tx, params.collectionId);
						await tx
							.delete(collectionItem)
							.where(
								and(
									eq(collectionItem.collectionId, params.collectionId),
									eq(collectionItem.unitId, params.targetId),
								),
							);
						return { saved: false };
					},
				),
			);
			return { saved: result.saved, latestItemsRevisionId: result.revisionId };
		},
		{
			access: "write:unit:update",
			params: CollectionItemParams,
			body: CollectionItemsRevisionBody,
			response: {
				[StatusCodes.OK]: SavedCollectionItemsResponse,
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					CollectionStructureRevisionConflictResponse,
				]),
			},
			detail: { summary: "Remove collection item", tags: ["Collections"] },
		},
	)
	.get(
		"/:collectionId/item-revisions",
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
			await authorization.unit.ensureCanRead(params.collectionId);
			return database.transaction(async (tx) => ({
				items: await listCollectionStructureRevisions(
					tx,
					params.collectionId,
					query.limit ?? 50,
				),
			}));
		},
		{
			params: CollectionParams,
			query: CollectionStructureRevisionListQuery,
			response: {
				[StatusCodes.OK]: CollectionStructureRevisionListResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "List Collection item revisions", tags: ["Collections"] },
		},
	)
	.get(
		"/:collectionId/item-revisions/compare",
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request.headers, "unit:read");
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
	)
	.post(
		"/:collectionId/item-revisions/:revisionId/restore",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensure(params.collectionId, "unit.history.restore");
			const result = await database.transaction(async (tx) => {
				await ensureEditableCollection(tx, params.collectionId);
				return restoreCollectionStructureRevision(tx, {
					collectionId: params.collectionId,
					sourceRevisionId: params.revisionId,
					baseRevisionId: body.baseItemsRevisionId,
					actorProfileId: profile.unitId,
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
		{
			access: "session-only",
			params: CollectionStructureRevisionParams,
			body: RestoreCollectionStructureRevisionBody,
			response: {
				[StatusCodes.OK]: RestoreCollectionStructureRevisionResponse,
				[StatusCodes.CONFLICT]: t.Union([
					FavoritesEditResponse,
					CollectionStructureRevisionConflictResponse,
				]),
				[StatusCodes.FORBIDDEN]: CollectionMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: CollectionNotFoundResponse,
			},
			detail: { summary: "Restore a Collection item revision", tags: ["Collections"] },
		},
	)
	.put(
		"/favorites/items/:targetId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanRead(params.targetId);
			const collectionId = await ensureFavorites(profile.unitId);
			const result = await database.transaction(async (tx) =>
				mutateCollectionStructureWithHistory(
					tx,
					{
						collectionId,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseItemsRevisionId,
					},
					async () => {
						await tx
							.insert(collectionItem)
							.values({
								collectionId,
								unitId: params.targetId,
								position: await nextCollectionItemPosition(tx, collectionId),
								addedByProfileId: profile.unitId,
							})
							.onConflictDoNothing();
						return { favorited: true };
					},
				),
			);
			return {
				favorited: result.favorited,
				collectionId,
				latestItemsRevisionId: result.revisionId,
			};
		},
		{
			access: "write:unit:update",
			params: FavoriteItemParams,
			body: CollectionItemsRevisionBody,
			response: {
				[StatusCodes.OK]: FavoriteResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: CollectionStructureRevisionConflictResponse,
			},
			detail: { summary: "Favorite unit", tags: ["Collections"] },
		},
	)
	.delete(
		"/favorites/items/:targetId",
		async ({ params, profile, body }) => {
			const collectionId = await ensureFavorites(profile.unitId);
			const result = await database.transaction(async (tx) =>
				mutateCollectionStructureWithHistory(
					tx,
					{
						collectionId,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseItemsRevisionId,
					},
					async () => {
						await tx
							.delete(collectionItem)
							.where(
								and(
									eq(collectionItem.collectionId, collectionId),
									eq(collectionItem.unitId, params.targetId),
								),
							);
						return { favorited: false };
					},
				),
			);
			return {
				favorited: result.favorited,
				collectionId,
				latestItemsRevisionId: result.revisionId,
			};
		},
		{
			access: "write:unit:update",
			params: FavoriteItemParams,
			body: CollectionItemsRevisionBody,
			response: {
				[StatusCodes.OK]: FavoriteResponse,
				[StatusCodes.CONFLICT]: CollectionStructureRevisionConflictResponse,
			},
			detail: { summary: "Remove favorite unit", tags: ["Collections"] },
		},
	);
