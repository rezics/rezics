import { and, asc, desc, eq, sql } from "drizzle-orm";
import { t, type UnwrapSchema } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";
import {
	CollectionDefinitionDocument,
	CollectionPresentationDocument,
	createCollectionPresentationDocument,
	createSystemCollectionDefinitionDocument,
	parseDocument,
} from "@rezics/block";

import type { Authorization } from "../../authorization";
import { database } from "../../database";
import {
	avatarReferenceFromColumns,
	resolveUnitLocalizationFromOrdered,
	resolvedUnitLocalizationLanguage,
} from "../../units/localization";
import {
	collection as collectionTable,
	collectionItem,
	unit,
	unitOwnership,
	unitLocalization,
	unitRevisionHead,
} from "../../database/schema";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { DefaultContentLanguage } from "../../database/schema/contract-values";
import { CollectionNotFound } from "./errors";
import { CollectionContentResponse, CollectionDetailResponse } from "../schema/response";
import { presentImageAsset } from "../../units/service";
import { presentAvatar } from "../../units/avatar";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { hydrateFeedItems } from "../feed";
import { FeedContentKindValues } from "../feed/schema";

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
			await tx.insert(unitOwnership).values({
				unitId: created.id,
				profileId: ownerId,
				assignedByProfileId: ownerId,
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
	authorization: Authorization,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<UnwrapSchema<typeof CollectionDetailResponse>> {
	const [record] = await database
		.select({
			id: unit.id,
			status: unit.status,
			visibility: unit.visibility,
			ownerId: collectionTable.ownerProfileId,
			source: collectionTable.source,
			systemKey: collectionTable.systemKey,
			definitionDocument: collectionTable.definitionDocument,
			presentationDocument: collectionTable.presentationDocument,
			itemCount: sql<number>`(select count(*) from ${collectionItem} where ${collectionItem.collectionId} = ${collectionTable.id})::int`,
			latestRevisionId: unitRevisionHead.revisionId,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(collectionTable)
		.innerJoin(unit, eq(unit.id, collectionTable.id))
		.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
		.where(eq(collectionTable.id, collectionId))
		.limit(1);
	if (!record) throw new CollectionNotFound();
	const readDecision = await authorization.unit.decide(collectionId, "unit.read");
	if (!readDecision.allowed) throw new CollectionNotFound();
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
		.orderBy(unitLocalization.position, unitLocalization.language);
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
	const ordinaryCollection = record.systemKey === null;
	const canUpdate = updateDecision.allowed && ordinaryCollection;
	return {
		...record,
		language: selectedLocalization.language,
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
			canManageItems: canUpdate && record.source === "manual",
			canEditPresentation: canUpdate,
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
	const order = collection.presentationDocument.order;
	const orderBy =
		order === "name"
			? [asc(unitLocalization.title), asc(collectionItem.unitId)]
			: order === "added-at"
				? [desc(collectionItem.createdAt), desc(collectionItem.unitId)]
				: [asc(collectionItem.position), asc(collectionItem.unitId)];
	const memberships = await database
		.select({
			targetId: collectionItem.unitId,
			role: collectionItem.role,
			parentTargetId: collectionItem.parentUnitId,
			position: collectionItem.position,
			createdAt: collectionItem.createdAt,
		})
		.from(collectionItem)
		.innerJoin(unit, eq(unit.id, collectionItem.unitId))
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
		.where(eq(collectionItem.collectionId, collectionId))
		.orderBy(...orderBy)
		.offset(offset)
		.limit(limit + 1);
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
