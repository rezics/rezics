import { and, asc, eq, gt, or } from "drizzle-orm";
import { t, type UnwrapSchema } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";

import type { Authorization } from "../../authorization";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	avatarReferenceFromColumns,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
} from "../../units/localization";
import {
	collection as collectionTable,
	collectionItem,
	collectionStat,
	collectionStructureRevisionHead,
	profileFavoritesCollection,
	unit,
	unitLocalization,
	unitRevisionHead,
} from "../../database/schema";
import { CollectionNotFound } from "./errors";
import { CollectionContentResponse, CollectionDetailResponse } from "../schema/response";
import { FractionalPosition, Uuid } from "../schema";
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
		collectionId: Uuid,
		revisionId: Uuid,
		position: FractionalPosition,
		targetId: Uuid,
	},
	{ additionalProperties: false },
);

type CollectionContentMembership = UnwrapSchema<
	typeof CollectionContentResponse
>["items"][number]["membership"];

export function presentCollectionMembership(value: {
	readonly targetId: string;
	readonly position: string;
	readonly createdAt: Date;
}): CollectionContentMembership {
	return { ...value, createdAt: value.createdAt.toISOString() };
}

function encodeCollectionItemsCursor(value: typeof CollectionItemsCursor.static) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCollectionItemsCursor(
	value: string | undefined,
	collectionId: string,
	revisionId: string,
) {
	if (!value) return null;
	try {
		const cursor = parseJsonCursor(value, CollectionItemsCursor);
		if (cursor.collectionId !== collectionId || cursor.revisionId !== revisionId)
			throw new InvalidPaginationCursor();
		return cursor;
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
			itemCount: collectionStat.itemCount,
			latestRevisionId: unitRevisionHead.revisionId,
			latestItemsRevisionId: collectionStructureRevisionHead.revisionId,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(collectionTable)
		.innerJoin(unit, eq(unit.id, collectionTable.id))
		.innerJoin(collectionStat, eq(collectionStat.collectionId, collectionTable.id))
		.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
		.innerJoin(
			collectionStructureRevisionHead,
			eq(collectionStructureRevisionHead.collectionId, collectionTable.id),
		)
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
	const [updateDecision, accessDecision, restoreDecision, realmPublicationDecision] =
		await Promise.all([
			authorization.unit.decide(collectionId, "unit.update"),
			authorization.unit.decide(collectionId, "unit.access.manage"),
			authorization.unit.decide(collectionId, "unit.history.restore"),
			authorization.unit.decide(collectionId, "unit.realm-publication.manage"),
		]);
	const ordinaryCollection = record.favoritesProfileId === null;
	const canUpdate = updateDecision.allowed && ordinaryCollection;
	const { favoritesProfileId, ...detail } = record;
	return {
		...detail,
		itemCount: toSafeInteger(detail.itemCount, "Collection item count"),
		purpose: favoritesProfileId ? "favorites" : "collection",
		language: selectedLocalization.language,
		cover: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(
				localizations,
				"cover",
				localizationLanguages,
			),
			"cover",
		),
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
			canManageRealmPublications: realmPublicationDecision.allowed && ordinaryCollection,
			canViewHistory:
				updateDecision.allowed || accessDecision.allowed || restoreDecision.allowed,
			canRestoreHistory: restoreDecision.allowed && ordinaryCollection,
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
	const cursor = decodeCollectionItemsCursor(
		input.cursor,
		collectionId,
		collection.latestItemsRevisionId,
	);
	const limit = input.limit ?? 20;
	const memberships = (
		await database
			.select({
				targetId: collectionItem.unitId,
				position: collectionItem.position,
				createdAt: collectionItem.createdAt,
			})
			.from(collectionItem)
			.where(
				and(
					eq(collectionItem.collectionId, collectionId),
					cursor
						? or(
								gt(collectionItem.position, cursor.position),
								and(
									eq(collectionItem.position, cursor.position),
									gt(collectionItem.unitId, cursor.targetId),
								),
							)
						: undefined,
				),
			)
			.orderBy(asc(collectionItem.position), asc(collectionItem.unitId))
			.limit(limit + 1)
	).map(presentCollectionMembership);
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
						revisionId: collection.latestItemsRevisionId,
						position: page.at(-1)!.position,
						targetId: page.at(-1)!.targetId,
					})
				: null,
	};
}
