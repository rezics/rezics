import { eq, sql } from "drizzle-orm";
import { t, type UnwrapSchema } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";

import type { Authorization } from "../../authorization";
import { database } from "../../database";
import {
	avatarReferenceFromColumns,
	resolveUnitLocalizationFromOrdered,
} from "../../units/localization";
import {
	collection as collectionTable,
	collectionItem,
	profileFavoritesCollection,
	unit,
	unitLocalization,
	unitRevisionHead,
} from "../../database/schema";
import { CollectionNotFound } from "./errors";
import { CollectionContentResponse, CollectionDetailResponse } from "../schema/response";
import { presentImageAsset } from "../../units/service";
import { presentAvatar } from "../../units/avatar";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { hydrateFeedItems } from "../feed";
import { FeedContentKindValues } from "../feed/schema";
import { getAttributionSummariesByUnitIds } from "../../units/attribution";

const CollectionItemsCursor = t.Object(
	{
		v: t.Literal(1),
		collectionId: t.String(),
		revisionId: t.String(),
		offset: t.Integer({ minimum: 1 }),
	},
	{ additionalProperties: false },
);

function encodeCollectionItemsCursor(value: typeof CollectionItemsCursor.static) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCollectionItemsCursor(
	value: string | undefined,
	collectionId: string,
	revisionId: string,
) {
	if (!value) return 0;
	try {
		const cursor = parseJsonCursor(value, CollectionItemsCursor);
		if (cursor.collectionId !== collectionId || cursor.revisionId !== revisionId)
			throw new InvalidPaginationCursor();
		return cursor.offset;
	} catch {
		throw new InvalidPaginationCursor();
	}
}

export async function getCollection(
	collectionId: string,
	authorization: Authorization,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<UnwrapSchema<typeof CollectionDetailResponse>> {
	const [record] = await database
		.select({
			id: unit.id,
			status: unit.status,
			visibility: unit.visibility,
			favoritesProfileId: profileFavoritesCollection.profileId,
			itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collectionTable.id})::int`,
			latestRevisionId: unitRevisionHead.revisionId,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(collectionTable)
		.innerJoin(unit, eq(unit.id, collectionTable.id))
		.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
		.leftJoin(
			profileFavoritesCollection,
			eq(profileFavoritesCollection.collectionId, collectionTable.id),
		)
		.where(eq(collectionTable.id, collectionId))
		.limit(1);
	if (!record) throw new CollectionNotFound();
	const readDecision = await authorization.unit.decide(collectionId, "unit.read");
	if (!readDecision.allowed) throw new CollectionNotFound();
	const [localizations, attributionMap] = await Promise.all([
		database
			.select({
				language: unitLocalization.language,
				position: unitLocalization.position,
				title: unitLocalization.title,
				summary: unitLocalization.summary,
				avatarType: unitLocalization.avatarType,
				avatarAssetId: unitLocalization.avatarAssetId,
				avatarEmoji: unitLocalization.avatarEmoji,
				avatarIconPrefix: unitLocalization.avatarIconPrefix,
				avatarIconName: unitLocalization.avatarIconName,
				bannerAssetId: unitLocalization.bannerAssetId,
				coverAssetId: unitLocalization.coverAssetId,
			})
			.from(unitLocalization)
			.where(eq(unitLocalization.unitId, collectionId))
			.orderBy(unitLocalization.position, unitLocalization.language),
		getAttributionSummariesByUnitIds([collectionId], localizationLanguages),
	]);
	const selectedLocalization = resolveUnitLocalizationFromOrdered(
		localizations,
		localizationLanguages,
	);
	if (!selectedLocalization) throw new CollectionNotFound();
	const [updateDecision, accessDecision, restoreDecision, deleteDecision] = await Promise.all([
		authorization.unit.decide(collectionId, "unit.update"),
		authorization.unit.decide(collectionId, "unit.access.manage"),
		authorization.unit.decide(collectionId, "unit.history.restore"),
		authorization.unit.decide(collectionId, "unit.delete"),
	]);
	const ordinaryCollection = record.favoritesProfileId === null;
	const canUpdate = updateDecision.allowed && ordinaryCollection;
	const { favoritesProfileId, ...detail } = record;
	return {
		...detail,
		purpose: favoritesProfileId ? "favorites" : "collection",
		language: selectedLocalization.language,
		attributions: attributionMap.get(collectionId) ?? [],
		localizations: localizations.map(
			({
				avatarType,
				avatarAssetId,
				avatarEmoji,
				avatarIconPrefix,
				avatarIconName,
				bannerAssetId,
				coverAssetId,
				position: _position,
				...localization
			}) => ({
				...localization,
				avatar: presentAvatar(
					avatarReferenceFromColumns({
						avatarType,
						avatarAssetId,
						avatarEmoji,
						avatarIconPrefix,
						avatarIconName,
					}),
				),
				banner: presentImageAsset(bannerAssetId, "banner"),
				cover: presentImageAsset(coverAssetId, "cover"),
			}),
		),
		capabilities: {
			canEditDetails: canUpdate,
			canManageItems: updateDecision.allowed,
			canManagePublishers: canUpdate,
			canManageLocalizations: canUpdate,
			canManageAccess: accessDecision.allowed && ordinaryCollection,
			canViewHistory:
				updateDecision.allowed || accessDecision.allowed || restoreDecision.allowed,
			canRestoreHistory: restoreDecision.allowed && ordinaryCollection,
			canDelete: deleteDecision.allowed && ordinaryCollection,
		},
	};
}

export async function getCollectionContent(
	collectionId: string,
	authorization: Authorization,
	input: {
		readonly localizationLanguages?: readonly ContentLanguage[];
		readonly cursor?: string;
		readonly limit?: number;
	},
): Promise<UnwrapSchema<typeof CollectionContentResponse>> {
	const localizationLanguages = input.localizationLanguages ?? [];
	const collection = await getCollection(collectionId, authorization, localizationLanguages);
	const offset = decodeCollectionItemsCursor(
		input.cursor,
		collectionId,
		collection.latestRevisionId,
	);
	const limit = input.limit ?? 20;
	const result = await database.execute<{
		targetId: string;
		parentTargetId: string | null;
		position: string;
		createdAt: Date;
	}>(sql`
		with recursive collection_tree (
			unit_id,
			parent_unit_id,
			position,
			created_at,
			visited_ids,
			order_path
		) as (
			select
				root_item.unit_id,
				root_item.parent_unit_id,
				root_item.position,
				root_item.created_at,
				array[root_item.unit_id],
				array[root_item.position collate "C", root_item.unit_id::text collate "C"]
			from ${collectionItem} root_item
			where root_item.collection_id = ${collectionId}
				and root_item.parent_unit_id is null

			union all

			select
				child_item.unit_id,
				child_item.parent_unit_id,
				child_item.position,
				child_item.created_at,
				parent_item.visited_ids || child_item.unit_id,
				parent_item.order_path || array[
					child_item.position collate "C",
					child_item.unit_id::text collate "C"
				]
			from collection_tree parent_item
			inner join ${collectionItem} child_item
				on child_item.collection_id = ${collectionId}
				and child_item.parent_unit_id = parent_item.unit_id
			where child_item.unit_id <> all(parent_item.visited_ids)
		)
		select
			unit_id as "targetId",
			parent_unit_id as "parentTargetId",
			position,
			created_at as "createdAt"
		from collection_tree
		order by order_path collate "C"
		offset ${offset}
		limit ${limit + 1}
	`);
	const memberships = result.rows;
	const page = memberships.slice(0, limit);
	const viewer = await resolveRecommendationViewer(authorization.profileId, false);
	const contents = await hydrateFeedItems(
		page.map(({ targetId }) => ({ id: targetId, realmId: null })),
		viewer,
		{
			content: FeedContentKindValues,
			...(localizationLanguages.length ? { localizationLanguages } : {}),
		},
		new Date(),
		{ kind: "contextual" },
	);
	const contentById = new Map(contents.map((content) => [content.id, content]));
	return {
		items: page.flatMap((membership) => {
			const content = contentById.get(membership.targetId);
			return content ? [{ membership, content }] : [];
		}),
		nextCursor:
			memberships.length > limit
				? encodeCollectionItemsCursor({
						v: 1,
						collectionId,
						revisionId: collection.latestRevisionId,
						offset: offset + limit,
					})
				: null,
	};
}
