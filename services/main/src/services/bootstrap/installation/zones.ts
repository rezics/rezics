import { and, eq, isNull, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import {
	contentStructure,
	contentStructureNode,
	post,
	realmUnit,
	unitDock,
	unitLocalization,
	unitOwnership,
	unitSlugAddress,
	zone,
	zonePage,
} from "../../database/schema";
import {
	createNavigationStructure,
	presentNavigationStructure,
	replaceNavigationStructure,
} from "../../content-structure/navigation";
import {
	createContentStructure,
	getContentStructureRevision,
	insertContentStructureNode,
} from "../../content-structure/service";
import {
	createDockHistory,
	getDockRevisionId,
	lockDockHistory,
	updateDockHistory,
} from "../../api/docks/history";
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
	ensureLocalization,
	ensureOwnership,
} from "./common";
import { bootstrapValuesEqual } from "../value-comparison";

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
	const insertedPost = await tx
		.insert(post)
		.values({
			id: value.wikiPost.id,
			kind: "wiki",
			subjectUnitId: value.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: post.id });
	let changed = Boolean(created) || insertedPost.length > 0;
	for (const [index, localization] of value.wikiPost.localizations.entries()) {
		changed =
			(await ensureLocalization(tx, {
				unitId: value.wikiPost.id,
				language: localization.language,
				position: fractionalPositionAt(index),
				title: localization.title,
				content: localization.body,
				contentStatus: "published",
			})) || changed;
	}
	changed = (await ensureOwnership(tx, value.wikiPost.id, value.ownerProfileId)) || changed;
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
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.wikiPost.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Wiki Post",
		});
	return changed;
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
	let changed = Boolean(created);
	const [pagePost] = await tx
		.insert(post)
		.values({
			id: value.homePage.id,
			subjectUnitId: value.id,
			kind: "page",
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: post.id });
	changed = Boolean(pagePost) || changed;
	const [pageOwnership] = await tx
		.insert(zonePage)
		.values({
			id: value.homePage.id,
			zoneId: value.id,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing()
		.returning({ id: zonePage.id });
	changed = Boolean(pageOwnership) || changed;
	for (const [index, localization] of value.wikiPost.localizations.entries()) {
		changed =
			(await ensureLocalization(tx, {
				unitId: value.homePage.id,
				language: localization.language,
				position: fractionalPositionAt(index),
				title: localization.title,
				content: value.homePage.document,
				contentStatus: "published",
			})) || changed;
	}
	changed = (await ensureOwnership(tx, value.homePage.id, value.ownerProfileId)) || changed;
	const [address] = await tx
		.select({ slug: unitSlugAddress.slug, scopeUnitId: unitSlugAddress.scopeUnitId })
		.from(unitSlugAddress)
		.where(
			and(
				eq(unitSlugAddress.targetUnitId, value.homePage.id),
				eq(unitSlugAddress.kind, "canonical"),
			),
		)
		.limit(1);
	if (address?.scopeUnitId !== value.id || address.slug !== value.homePage.slug) {
		await replaceZonePageSlugAddress(tx, {
			zoneId: value.id,
			pageUnitId: value.homePage.id,
			slug: value.homePage.slug,
		});
		changed = true;
	}

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
	let structureId = storedStructure?.id;
	let revisionId: string;
	if (structureId) {
		if (structureId !== value.homePage.structureId)
			throw new Error(`Bootstrap Zone ${value.id} has an unexpected pages structure`);
		const currentRevisionId = await getContentStructureRevision(tx, value.id, structureId);
		if (!currentRevisionId) throw new Error("Official Zone page structure has no revision");
		revisionId = currentRevisionId;
	} else {
		const createdStructure = await createContentStructure(tx, {
			structureId: value.homePage.structureId,
			ownerUnitId: value.id,
			kind: "page-structure",
			actorProfileId: value.ownerProfileId,
			message: "Bootstrap official Zone page structure",
		});
		structureId = createdStructure.structure.id;
		revisionId = createdStructure.revisionId;
		changed = true;
	}
	const [storedNode] = await tx
		.select({ id: contentStructureNode.id })
		.from(contentStructureNode)
		.where(
			and(
				eq(contentStructureNode.structureId, structureId),
				eq(contentStructureNode.contentUnitId, value.homePage.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.limit(1);
	if (!storedNode) {
		await insertContentStructureNode(tx, {
			ownerUnitId: value.id,
			structureId,
			baseRevisionId: revisionId,
			actorProfileId: value.ownerProfileId,
			contentUnitId: value.homePage.id,
			parentId: null,
			position: fractionalPositionAt(0),
			message: "Bootstrap official Zone home page",
		});
		changed = true;
	}
	if (changed)
		await recordUnitRevision(tx, {
			unitId: value.homePage.id,
			actorProfileId: value.ownerProfileId,
			event: "create",
			message: "Bootstrap official Zone Page Unit",
		});
	return changed;
}

export async function ensureOfficialZones(tx: DatabaseTransaction): Promise<void> {
	const createdAt = bootstrapEpoch();
	for (const value of OfficialZoneManifest) {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${value.id}`}::text, 0))`,
		);
		let changed = await ensureBootstrapAddressedUnit(tx, {
			id: value.id,
			kind: "zone",
			scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
			slug: value.slug,
		});
		const [storedZone] = await tx
			.select({
				filterDocument: zone.filterDocument,
				themeDocument: zone.themeDocument,
			})
			.from(zone)
			.where(eq(zone.id, value.id))
			.limit(1);
		if (storedZone) {
			if (
				!bootstrapValuesEqual(storedZone.filterDocument, value.filterDocument) ||
				!bootstrapValuesEqual(storedZone.themeDocument, value.themeDocument)
			) {
				await tx
					.update(zone)
					.set({
						filterDocument: value.filterDocument,
						themeDocument: value.themeDocument,
						updatedAt: createdAt,
					})
					.where(eq(zone.id, value.id));
				changed = true;
			}
		} else {
			await tx.insert(zone).values({
				id: value.id,
				filterDocument: value.filterDocument,
				themeDocument: value.themeDocument,
				createdAt,
				updatedAt: createdAt,
			});
			changed = true;
		}
		changed = (await ensureOfficialWikiPost(tx, value)) || changed;
		changed = (await ensureOfficialZonePage(tx, value)) || changed;
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
		if (storedNavigation) {
			const current = await presentNavigationStructure(tx, {
				ownerUnitId: value.id,
				structureId: value.navigation.id,
				kind: "zone.navigation",
			});
			if (!bootstrapValuesEqual(current.document, value.navigation.document)) {
				const revisionId = await getContentStructureRevision(tx, value.id, value.navigation.id);
				if (!revisionId) throw new Error("Official Zone navigation has no component revision");
				await replaceNavigationStructure(tx, {
					ownerUnitId: value.id,
					structureId: value.navigation.id,
					kind: "zone.navigation",
					document: value.navigation.document,
					actorProfileId: value.ownerProfileId,
					baseRevisionId: revisionId,
				});
				changed = true;
			}
		} else {
			await createNavigationStructure(tx, {
				ownerUnitId: value.id,
				structureId: value.navigation.id,
				kind: "zone.navigation",
				document: value.navigation.document,
				actorProfileId: value.ownerProfileId,
			});
			changed = true;
		}
		const [storedDock] = await tx
			.select()
			.from(unitDock)
			.where(
				and(eq(unitDock.unitId, value.id), eq(unitDock.kind, "main"), isNull(unitDock.deletedAt)),
			)
			.limit(1);
		if (storedDock) {
			if (!bootstrapValuesEqual(storedDock.document, value.mainDockDocument)) {
				await lockDockHistory(tx, storedDock.id);
				const [updatedDock] = await tx
					.update(unitDock)
					.set({ document: value.mainDockDocument, updatedAt: createdAt })
					.where(eq(unitDock.id, storedDock.id))
					.returning();
				if (!updatedDock) throw new Error("Official Zone Dock update returned no row");
				const revisionId = await getDockRevisionId(tx, storedDock.id);
				if (revisionId)
					await updateDockHistory(tx, {
						dock: updatedDock,
						baseRevisionId: revisionId,
						actorProfileId: value.ownerProfileId,
					});
				else
					await createDockHistory(tx, {
						dock: updatedDock,
						actorProfileId: value.ownerProfileId,
					});
				changed = true;
			} else if (!(await getDockRevisionId(tx, storedDock.id)))
				await createDockHistory(tx, {
					dock: storedDock,
					actorProfileId: value.ownerProfileId,
				});
		} else {
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
			changed = true;
		}
		for (const [index, localization] of value.localizations.entries()) {
			changed =
				(await ensureLocalization(tx, {
					unitId: value.id,
					position: fractionalPositionAt(index),
					avatar: value.avatar,
					...localization,
				})) || changed;
		}
		changed = (await ensureOwnership(tx, value.id, value.ownerProfileId)) || changed;
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
		changed ||= insertedRealmUnit.length > 0;
		if (changed)
			await recordUnitRevision(tx, {
				unitId: value.id,
				actorProfileId: value.ownerProfileId,
				event: "create",
				message: "Bootstrap official Zone",
			});
	}
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

export async function ensureOfficialZoneExperiences(tx: DatabaseTransaction): Promise<void> {
	for (const { id } of OfficialZoneManifest)
		await ensureZoneDefaultExperienceInTransaction(tx, await getZoneDefaultExperienceInput(tx, id));
}
