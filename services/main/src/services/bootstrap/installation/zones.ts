import { and, eq, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import {
	contentStructure,
	post,
	realmUnit,
	unitDock,
	unitLocalization,
	unitOwnership,
	unitSlugAddress,
	zone,
	zonePage,
} from "../../database/schema";
import { createNavigationStructure } from "../../content-structure/navigation";
import {
	createContentStructure,
	insertContentStructureNode,
} from "../../content-structure/service";
import { createDockHistory } from "../../api/docks/history";
import { fractionalPositionAt } from "../../ordering/position";
import { insertUnitIfMissing } from "../../units/create";
import { recordUnitRevision } from "../../units/history";
import { recordInitialRealmUnitPublicationEvents } from "../../units/realm-publication";
import { replaceZonePageSlugAddress } from "../../units/slug-address";
import {
	ensureZoneDefaultExperienceInTransaction,
	type ProvisionZoneDefaultExperienceInput,
} from "../../zones/default-experience";
import { OfficialRealmManifest, OfficialZoneManifest, TopLevelSlugNamespaceUnitIds } from "../data";
import {
	bootstrapEpoch,
	ensureBootstrapAddressedUnit,
	ensureOwnership,
	insertStarterLocalization,
} from "./common";

async function ensureOfficialWikiPost(
	tx: DatabaseTransaction,
	value: (typeof OfficialZoneManifest)[number],
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const created = await insertUnitIfMissing(tx, {
		id: value.wikiPost.id,
		kind: "post",
		status: "published",
		visibility: "public",
		publishedAt: createdAt,
		createdAt,
		updatedAt: createdAt,
		statusActor: { kind: "system" },
	});
	await tx
		.insert(post)
		.values({
			id: value.wikiPost.id,
			kind: "wiki",
			subjectUnitId: value.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing();
	if (created)
		for (const [index, localization] of value.wikiPost.localizations.entries())
			await insertStarterLocalization(tx, {
				unitId: value.wikiPost.id,
				language: localization.language,
				position: fractionalPositionAt(index),
				title: localization.title,
				content: localization.body,
				contentStatus: "published",
			});
	await ensureOwnership(tx, value.wikiPost.id, value.ownerProfileId);
	const insertedRealmUnit = await tx
		.insert(realmUnit)
		.values({
			realmId: OfficialRealmManifest.id,
			unitId: value.wikiPost.id,
			status: "visible",
			postTargetingLocked: false,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ realmId: realmUnit.realmId, unitId: realmUnit.unitId });
	await recordInitialRealmUnitPublicationEvents(tx, {
		relations: insertedRealmUnit.map((relation) => ({ ...relation, createdAt })),
		actorProfileId: value.ownerProfileId,
	});
	if (created)
		await recordUnitRevision(tx, {
			unitId: value.wikiPost.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Wiki Post",
		});
	return Boolean(created);
}

async function ensureOfficialZonePage(
	tx: DatabaseTransaction,
	value: (typeof OfficialZoneManifest)[number],
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const created = await insertUnitIfMissing(tx, {
		id: value.homePage.id,
		kind: "zone_page",
		status: "published",
		visibility: "public",
		publishedAt: createdAt,
		createdAt,
		updatedAt: createdAt,
		statusActor: { kind: "system" },
	});
	await tx
		.insert(post)
		.values({
			id: value.homePage.id,
			subjectUnitId: value.id,
			kind: "page",
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing();
	await tx
		.insert(zonePage)
		.values({
			id: value.homePage.id,
			zoneId: value.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing();
	if (created)
		for (const [index, localization] of value.wikiPost.localizations.entries())
			await insertStarterLocalization(tx, {
				unitId: value.homePage.id,
				language: localization.language,
				position: fractionalPositionAt(index),
				title: localization.title,
				content: value.homePage.document,
				contentStatus: "published",
			});
	await ensureOwnership(tx, value.homePage.id, value.ownerProfileId);
	const [address] = await tx
		.select({ id: unitSlugAddress.id })
		.from(unitSlugAddress)
		.where(
			and(
				eq(unitSlugAddress.targetUnitId, value.homePage.id),
				eq(unitSlugAddress.kind, "canonical"),
			),
		)
		.limit(1);
	if (!address)
		await replaceZonePageSlugAddress(tx, {
			zoneId: value.id,
			pageUnitId: value.homePage.id,
			slug: value.homePage.slug,
		});

	const [storedStructure] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, value.id),
				eq(contentStructure.kind, "page-structure"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (storedStructure) {
		if (storedStructure.id !== value.homePage.structureId)
			throw new Error(`Bootstrap Zone ${value.id} has an unexpected pages structure`);
	} else {
		const createdStructure = await createContentStructure(tx, {
			structureId: value.homePage.structureId,
			ownerUnitId: value.id,
			kind: "page-structure",
			actorProfileId: value.ownerProfileId,
			message: "Bootstrap official Zone page structure",
		});
		await insertContentStructureNode(tx, {
			ownerUnitId: value.id,
			structureId: createdStructure.structure.id,
			baseRevisionId: createdStructure.revisionId,
			actorProfileId: value.ownerProfileId,
			contentUnitId: value.homePage.id,
			parentId: null,
			position: fractionalPositionAt(0),
			message: "Bootstrap official Zone home page",
		});
	}
	if (created)
		await recordUnitRevision(tx, {
			unitId: value.homePage.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Page Unit",
		});
	return Boolean(created);
}

export async function ensureOfficialZones(tx: DatabaseTransaction): Promise<readonly string[]> {
	const createdAt = bootstrapEpoch();
	const createdZoneIds: string[] = [];
	for (const value of OfficialZoneManifest) {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${value.id}`}::text, 0))`,
		);
		const createdUnit = await ensureBootstrapAddressedUnit(tx, {
			id: value.id,
			kind: "zone",
			scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
			slug: value.slug,
		});
		await tx
			.insert(zone)
			.values({
				id: value.id,
				filterDocument: value.filterDocument,
				themeDocument: value.themeDocument,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing();
		await ensureOfficialWikiPost(tx, value);
		await ensureOfficialZonePage(tx, value);
		const [storedNavigation] = await tx
			.select({ id: contentStructure.id })
			.from(contentStructure)
			.where(
				and(
					eq(contentStructure.id, value.navigation.id),
					eq(contentStructure.ownerUnitId, value.id),
					eq(contentStructure.kind, "zone.navigation"),
					isNull(contentStructure.deletedAt),
				),
			)
			.limit(1);
		if (!storedNavigation)
			await createNavigationStructure(tx, {
				ownerUnitId: value.id,
				structureId: value.navigation.id,
				kind: "zone.navigation",
				document: value.navigation.document,
				actorProfileId: value.ownerProfileId,
			});
		const [storedDock] = await tx
			.select()
			.from(unitDock)
			.where(
				and(eq(unitDock.unitId, value.id), eq(unitDock.kind, "main"), isNull(unitDock.deletedAt)),
			)
			.limit(1);
		if (!storedDock) {
			const [createdDock] = await tx
				.insert(unitDock)
				.values({
					unitId: value.id,
					kind: "main",
					document: value.mainDockDocument,
					createdAt,
					updatedAt: createdAt,
				})
				.returning();
			if (!createdDock) throw new Error("Official Zone Dock insertion returned no row");
			await createDockHistory(tx, {
				dock: createdDock,
				actorProfileId: value.ownerProfileId,
			});
		}
		if (createdUnit)
			for (const [index, localization] of value.localizations.entries())
				await insertStarterLocalization(tx, {
					unitId: value.id,
					position: fractionalPositionAt(index),
					avatar: value.avatar,
					...localization,
				});
		await ensureOwnership(tx, value.id, value.ownerProfileId);
		const insertedRealmUnit = await tx
			.insert(realmUnit)
			.values({
				realmId: OfficialRealmManifest.id,
				unitId: value.id,
				status: "visible",
				postTargetingLocked: false,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ realmId: realmUnit.realmId, unitId: realmUnit.unitId });
		await recordInitialRealmUnitPublicationEvents(tx, {
			relations: insertedRealmUnit.map((relation) => ({ ...relation, createdAt })),
			actorProfileId: value.ownerProfileId,
		});
		if (createdUnit) {
			createdZoneIds.push(value.id);
			await recordUnitRevision(tx, {
				unitId: value.id,
				actorProfileId: value.ownerProfileId,
				event: "create",
				message: "Bootstrap official Zone",
			});
		}
	}
	return createdZoneIds;
}

async function getZoneDefaultExperienceInput(
	tx: DatabaseTransaction,
	zoneId: string,
): Promise<ProvisionZoneDefaultExperienceInput> {
	const [owner] = await tx
		.select({ profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, zoneId), isNull(unitOwnership.revokedAt)))
		.limit(1);
	const [localization] = await tx
		.select({
			language: unitLocalization.language,
			title: unitLocalization.title,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, zoneId))
		.orderBy(unitLocalization.position, unitLocalization.language)
		.limit(1);
	if (!owner?.profileId || !localization?.title)
		throw new Error(`Zone ${zoneId} cannot be provisioned without an owner and localization`);
	return {
		zoneId,
		actorProfileId: owner.profileId,
		language: localization.language,
		title: localization.title,
	};
}

export async function ensureOfficialZoneExperiences(
	tx: DatabaseTransaction,
	createdZoneIds: readonly string[],
): Promise<void> {
	for (const zoneId of createdZoneIds)
		await ensureZoneDefaultExperienceInTransaction(
			tx,
			await getZoneDefaultExperienceInput(tx, zoneId),
		);
}
