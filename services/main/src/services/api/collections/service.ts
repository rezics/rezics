import { and, eq, sql } from "drizzle-orm";
import type { UnwrapSchema } from "elysia";
import {
	CollectionDefinitionDocument,
	CollectionPresentationDocument,
	createCollectionPresentationDocument,
	createSystemCollectionDefinitionDocument,
	parseDocument,
} from "@rezics/block";

import { getUnitReadCondition } from "../../authorization/unit/query";
import { database } from "../../database";
import { avatarReferenceFromColumns, isPrimaryUnitLocalization } from "../../units/localization";
import {
	collection as collectionTable,
	collectionItem,
	unit,
	unitAccessBinding,
	unitLocalization,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { DefaultContentLanguage } from "../../database/schema/contract-values";
import { CollectionNotFound } from "./errors";
import { CollectionDetailResponse } from "../schema/response";
import { presentImageAsset } from "../../units/service";
import { presentAvatar } from "../../units/avatar";

export async function ensureFavorites(ownerId: string) {
	const find = () =>
		database
			.select({ id: collectionTable.id })
			.from(collectionTable)
			.where(
				and(
					eq(collectionTable.ownerProfileId, ownerId),
					eq(collectionTable.systemKey, "favorites"),
				),
			)
			.limit(1);
	const [existing] = await find();
	if (existing) return existing.id;

	try {
		return await database.transaction(async (tx) => {
			const created = await insertUnit(tx, {
				kind: "collection",
				status: "published",
				visibility: "private",
				publishedAt: new Date(),
				statusActor: { kind: "profile", profileId: ownerId },
			});
			await tx.insert(collectionTable).values({
				id: created.id,
				ownerProfileId: ownerId,
				source: "system",
				systemKey: "favorites",
				definitionDocument: createSystemCollectionDefinitionDocument("favorites"),
				presentationDocument: createCollectionPresentationDocument("flat", "added-at"),
			});
			await tx.insert(unitLocalization).values({
				unitId: created.id,
				language: DefaultContentLanguage,
				title: "Favorites",
			});
			await tx.insert(unitAccessBinding).values({
				unitId: created.id,
				subjectKind: "profile",
				profileId: ownerId,
				role: "owner",
				scope: [],
				grantedByProfileId: ownerId,
			});
			await recordUnitRevision(tx, {
				unitId: created.id,
				actorProfileId: ownerId,
				event: "create",
			});
			return created.id;
		});
	} catch (error) {
		const [raced] = await find();
		if (raced) return raced.id;
		throw error;
	}
}

export async function getCollection(
	collectionId: string,
	viewerId?: string,
): Promise<UnwrapSchema<typeof CollectionDetailResponse>> {
	const [record] = await database
		.select({
			id: unit.id,
			status: unit.status,
			visibility: unit.visibility,
			language: unitLocalization.language,
			ownerId: collectionTable.ownerProfileId,
			source: collectionTable.source,
			systemKey: collectionTable.systemKey,
			definitionDocument: collectionTable.definitionDocument,
			presentationDocument: collectionTable.presentationDocument,
			itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collectionTable.id})::int`,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(collectionTable)
		.innerJoin(unit, eq(unit.id, collectionTable.id))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, unit.id),
				isPrimaryUnitLocalization(unitLocalization.unitId),
			),
		)
		.where(eq(collectionTable.id, collectionId))
		.limit(1);
	if (
		!record ||
		(record.ownerId !== viewerId &&
			!(record.status === "published" && ["public", "unlisted"].includes(record.visibility)))
	)
		throw new CollectionNotFound();
	const definitionDocument = parseDocument(
		CollectionDefinitionDocument,
		record.definitionDocument,
	);
	const presentationDocument = parseDocument(
		CollectionPresentationDocument,
		record.presentationDocument,
	);

	const localizations = await database
		.select({
			language: unitLocalization.language,
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
		.orderBy(unitLocalization.position, unitLocalization.language);
	const items = await database
		.select({
			targetId: collectionItem.unitId,
			kind: collectionItem.role,
			position: collectionItem.position,
			type: unit.kind,
			title: unitLocalization.title,
			coverAssetId: unitLocalization.coverAssetId,
			directItemCount: sql<
				number | null
			>`case when ${unit.kind} = 'collection' then (select count(*)::int from collection_item nested_item where nested_item.collection_id = ${collectionItem.unitId}) else null end`,
		})
		.from(collectionItem)
		.innerJoin(unit, eq(unit.id, collectionItem.unitId))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, unit.id),
				isPrimaryUnitLocalization(unitLocalization.unitId),
			),
		)
		.where(and(eq(collectionItem.collectionId, collectionId), getUnitReadCondition(viewerId)))
		.orderBy(collectionItem.position, collectionItem.unitId);
	return {
		...record,
		definitionDocument,
		presentationDocument,
		localizations: localizations.map(
			({
				avatarType,
				avatarAssetId,
				avatarEmoji,
				avatarIconPrefix,
				avatarIconName,
				bannerAssetId,
				coverAssetId,
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
				banner: presentImageAsset(bannerAssetId),
				cover: presentImageAsset(coverAssetId),
			}),
		),
		items: items.map(({ coverAssetId, ...item }) => ({
			...item,
			cover: presentImageAsset(coverAssetId),
			parentTargetId: null,
		})),
	};
}
