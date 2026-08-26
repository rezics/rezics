import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { assertFilterDocument } from "@rezics/filter";
import { normalizeContentLanguageSupport } from "@rezics/content-language";
import { isLicenseId } from "@rezics/license";
import { TopLevelSlugNamespaceUnitIds, ZoneHomePageSlug } from "@rezics/slug";
import { isContentLanguage } from "@rezics/i18n";

import { OfficialProfileIds } from "../bootstrap/data";
import {
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
} from "../authorization/unit/ownership";
import { applyContentStructureBatch } from "../content-structure/batch";
import { createContentStructure } from "../content-structure/service";
import { createNavigationStructure } from "../content-structure/navigation";
import type { ContentStructureBatchCommand } from "../content-structure/batch-plan";
import type { DatabaseTransaction } from "../database";
import {
	audio,
	book,
	contentStructure,
	collection,
	collectionItem,
	creditAttribution,
	entity,
	entityMeasurement,
	label,
	media,
	contentPackEntityMeasurementEvidence,
	contentPackImport,
	contentPackTagPathDefinitionEvidence,
	contentPackUnitTagPathEvidence,
	contentPackSubjectAssociationEvidence,
	contentPackTagEvidence,
	contentPackUnitTagEvidence,
	post,
	realm,
	realmUnit,
	release,
	series,
	seriesRelease,
	software,
	subjectAssociation,
	subjectAssociationJudgment,
	tag,
	unit,
	unitContentLanguageSupport,
	unitAlias,
	unitLocalization,
	unitSlugAddress,
	unitTagPath,
	unitTagPathJudgment,
	unitTag,
	unitTagJudgment,
	unitVariant,
	video,
	zone,
	zonePage,
	type ContentStructureKind,
	type ContentLanguageSupportUnitKind,
	type VariantCapableUnitKind,
	ContentLanguageSupportUnitKindValues,
	VariantCapableUnitKindValues,
} from "../database/schema";
import { insertLicenseGrants } from "../units/license-grants";
import { recordUnitRevision } from "../units/history";
import { insertUnit } from "../units/create";
import { recordInitialRealmUnitPublicationEvents } from "../units/realm-publication";
import { replaceZonePageSlugAddress } from "../units/slug-address";
import { WorkPolicy } from "../performance/policy";
import { ContentPackCollision, ContentPackConflict, ContentPackInvalid } from "./errors";
import { assertContentPackDocuments } from "./documents";
import { planContentPack } from "./plan";
import type { LoadedPack, PackObject, PackRelations, PackStructure } from "./contracts";
import { createTagPathInTransaction } from "../tag-paths/service";

const ImportOwnerProfileId = OfficialProfileIds.editorial;
const KindOrder: readonly string[] = [
	"tag",
	"entity",
	"label",
	"series",
	"book",
	"media",
	"software",
	"video",
	"audio",
	"release",
	"collection",
	"realm",
	"zone",
	"post",
	"zone_page",
];

const ContentLanguageSupportUnitKindSet: ReadonlySet<string> = new Set(
	ContentLanguageSupportUnitKindValues,
);
const VariantCapableUnitKindSet: ReadonlySet<string> = new Set(VariantCapableUnitKindValues);
const ImportReadBatchSize = 500;
type PackUnitTagRelation = NonNullable<PackRelations["unitTags"]>[number];
type PackSubjectRelation = NonNullable<PackRelations["subjects"]>[number];
type PackTagPath = NonNullable<PackRelations["tagPaths"]>[number];
type PackTagPathApplication = NonNullable<PackRelations["tagPathApplications"]>[number];

export async function applyContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sourceRoot: string,
): Promise<{ readonly status: "created" | "noop"; readonly created: number }> {
	assertContentPackDocuments(pack);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`content-pack:${pack.manifest.id}`}::text, 0))`,
	);
	const [existingImport] = await tx
		.select({ checksum: contentPackImport.checksum })
		.from(contentPackImport)
		.where(
			and(
				eq(contentPackImport.packId, pack.manifest.id),
				eq(contentPackImport.version, pack.manifest.version),
			),
		)
		.limit(1);
	if (existingImport?.checksum === pack.checksum) return { status: "noop", created: 0 };
	if (existingImport)
		throw new ContentPackConflict("A different checksum is already recorded for this pack version");
	const plan = await planContentPack(tx, pack, sourceRoot);
	if (plan.conflicts.length)
		throw new ContentPackConflict(
			plan.conflicts
				.map(
					(item) => `${item.sourceKey}: ${item.action === "conflict" ? item.reason : "conflict"}`,
				)
				.join("; "),
		);
	await verifyExistingPackObjects(tx, pack, plan.objects);

	const importId = await insertImportLedger(tx, pack);

	const createKeys = new Set(
		plan.objects.filter((item) => item.action === "create").map((item) => item.sourceKey),
	);
	const objects = [...pack.objects]
		.filter((object) => createKeys.has(object.sourceKey))
		.sort((left, right) => kindRank(left.unit.kind) - kindRank(right.unit.kind));

	for (const object of objects) await importUnit(tx, pack, object);

	await importTagEvidence(tx, pack, importId);
	await importEntityMeasurements(tx, pack, imported.id);
	await importRelations(tx, pack, createKeys, importId);
	await importTagPaths(tx, pack, importId);
	await importStructures(tx, pack);
	await importSlugs(tx, pack, createKeys);

	for (const object of objects) {
		await recordUnitRevision(tx, {
			unitId: requireId(pack.ids.units, object.sourceKey),
			actorProfileId: ImportOwnerProfileId,
			event: "create",
		});
	}
	return { status: "created", created: objects.length };
}

async function insertImportLedger(tx: DatabaseTransaction, pack: LoadedPack): Promise<string> {
	const [created] = await tx
		.insert(contentPackImport)
		.values({
			packId: pack.manifest.id,
			version: pack.manifest.version,
			checksum: pack.checksum,
			sourceLockKind: pack.sourceLock.kind,
			manifestSnapshot: pack.manifest,
			sourceLockSnapshot: pack.sourceLock,
			rightsSnapshot: [...pack.rights],
			bindingsSnapshot: [...pack.bindings],
			importerProfileId: ImportOwnerProfileId,
		})
		.returning({ id: contentPackImport.id });
	if (!created) throw new ContentPackConflict("The content-pack import ledger row was not created");
	return created.id;
}

async function verifyExistingPackObjects(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	planned: readonly { readonly sourceKey: string; readonly action: string }[],
): Promise<void> {
	const existingSourceKeys = planned
		.filter((item) => item.action === "noop")
		.map((item) => item.sourceKey);
	if (!existingSourceKeys.length) return;
	const expectedById = new Map(
		pack.objects
			.filter((object) => existingSourceKeys.includes(object.sourceKey))
			.map((object) => [requireId(pack.ids.units, object.sourceKey), object] as const),
	);
	const records = [];
	for (const ids of chunks([...expectedById.keys()], ImportReadBatchSize))
		records.push(
			...(await tx
				.select({
					id: unit.id,
					kind: unit.kind,
					status: unit.status,
					visibility: unit.visibility,
					contentRating: unit.contentRating,
					aiDisclosure: unit.aiDisclosure,
					moderationStatus: unit.moderationStatus,
					postTargetingLocked: unit.postTargetingLocked,
					deletedAt: unit.deletedAt,
				})
				.from(unit)
				.where(inArray(unit.id, ids))),
		);
	for (const record of records) {
		const expected = expectedById.get(record.id);
		if (!expected) throw new ContentPackCollision(`Unexpected existing Unit ${record.id}`);
		if (
			record.kind !== expected.unit.kind ||
			record.status !== expected.unit.status ||
			record.visibility !== expected.unit.visibility ||
			record.contentRating !== expected.unit.contentRating ||
			record.aiDisclosure !== expected.unit.aiDisclosure ||
			record.moderationStatus !== expected.unit.moderationStatus ||
			record.postTargetingLocked !== expected.unit.postTargetingLocked ||
			record.deletedAt !== null
		)
			throw new ContentPackCollision(
				`${expected.sourceKey} collides with a different existing Unit`,
			);
	}
	if (records.length !== expectedById.size)
		throw new ContentPackCollision("A planned existing Unit disappeared before import");
}

function chunks<T>(values: readonly T[], size: number): readonly T[][] {
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += size)
		result.push(values.slice(index, index + size));
	return result;
}

function kindRank(kind: string): number {
	const index = KindOrder.indexOf(kind);
	return index === -1 ? KindOrder.length : index;
}

async function importUnit(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	object: PackObject,
): Promise<void> {
	const unitId = requireId(pack.ids.units, object.sourceKey);
	const license = object.unit.license;
	if (license !== null && !isLicenseId(license))
		throw new ContentPackInvalid(`${object.sourceKey} has an unknown license identifier`);
	await insertUnit(tx, {
		id: unitId,
		kind: object.unit.kind,
		status: object.unit.status,
		visibility: object.unit.visibility,
		contentRating: object.unit.contentRating,
		aiDisclosure: object.unit.aiDisclosure,
		moderationStatus: object.unit.moderationStatus,
		postTargetingLocked: object.unit.postTargetingLocked,
		publishedAt: object.unit.status === "published" ? new Date() : null,
		statusActor: { kind: "import" },
	});
	if (object.import.ownershipMode === "community_owned")
		await createPublicEditableUnitAccess(tx, unitId, ["unit.update", "unit.status.update"]);
	else await createProfileOwnedUnitAccess(tx, unitId, ImportOwnerProfileId);
	if (license)
		await insertLicenseGrants(tx, {
			unitId,
			grantedByProfileId: ImportOwnerProfileId,
			licenseIds: [license],
			unitKind: object.unit.kind,
		});

	await insertDetail(tx, pack, object, unitId, object.import.ownershipMode === "community_owned");
	await insertContentLanguageSupport(tx, object, unitId);
	await tx.insert(unitLocalization).values(
		object.localizations.map((localization, index) => {
			if (!isContentLanguage(localization.language))
				throw new ContentPackInvalid(
					`${object.sourceKey} has invalid language ${localization.language}`,
				);
			return {
				unitId,
				language: localization.language,
				position: fractionalFromIndex(index),
				title: localization.title,
				summary: localization.summary ?? null,
				description: localization.description ?? null,
				content: localization.content ?? null,
				contentStatus: localization.contentStatus ?? (localization.content ? "published" : null),
			};
		}),
	);
	if (object.aliases?.length)
		await tx.insert(unitAlias).values(
			object.aliases.map((alias) => ({
				id: pack.ids.aliases?.[alias.sourceKey],
				unitId,
				term: alias.term,
				normalizedTerm: alias.normalizedTerm,
				language: alias.language && isContentLanguage(alias.language) ? alias.language : null,
				kind: alias.kind,
				pinned: alias.pinned,
				position: alias.pinned ? "a0" : null,
				createdByProfileId: ImportOwnerProfileId,
			})),
		);
}

async function insertDetail(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	object: PackObject,
	unitId: string,
	metadataOnly: boolean,
): Promise<void> {
	switch (object.unit.kind) {
		case "entity":
			if (!object.entity) throw new ContentPackInvalid(`${object.sourceKey} missing entity`);
			await tx.insert(entity).values({
				id: unitId,
				kind: object.entity.kind,
				verified: object.entity.verified,
			});
			return;
		case "tag":
			if (!object.tag) throw new ContentPackInvalid(`${object.sourceKey} missing tag`);
			await tx.insert(tag).values(
				"directlyApplicable" in object.tag
					? {
							id: unitId,
							directlyApplicable: object.tag.directlyApplicable,
							defaultSpoilerLevel: object.tag.defaultSpoilerLevel,
						}
					: { id: unitId },
			);
			return;
		case "label":
			await tx.insert(label).values({ id: unitId });
			return;
		case "series":
			if (!object.series) throw new ContentPackInvalid(`${object.sourceKey} missing series`);
			await tx.insert(series).values({ id: unitId, kind: object.series.kind });
			return;
		case "book":
			if (!object.book) throw new ContentPackInvalid(`${object.sourceKey} missing book`);
			await tx.insert(book).values({
				id: unitId,
				metadataOnly,
				releaseStatus: object.book.releaseStatus,
				isbn13: object.book.isbn13 ?? null,
				publicationDate: object.book.publicationDate ?? null,
				pageCount: object.book.pageCount ?? null,
			});
			return;
		case "media":
			if (!object.media) throw new ContentPackInvalid(`${object.sourceKey} missing media`);
			await tx.insert(media).values({
				id: unitId,
				metadataOnly,
				kind: object.media.kind,
				releaseStatus: object.media.releaseStatus,
				releaseDate: object.media.releaseDate ?? null,
				episodeCount: object.media.episodeCount ?? null,
				seasonCount: object.media.seasonCount ?? null,
				runtimeMinutes: object.media.runtimeMinutes ?? null,
			});
			return;
		case "software":
			if (!object.software) throw new ContentPackInvalid(object.sourceKey + " missing software");
			await tx.insert(software).values({
				id: unitId,
				metadataOnly: object.software.metadataOnly,
				releaseDate: object.software.releaseDate ?? null,
				versionLabel: object.software.versionLabel ?? null,
			});
			return;
		case "release":
			if (!object.release) throw new ContentPackInvalid(object.sourceKey + " missing release");
			await tx.insert(release).values({
				id: unitId,
				parentUnitId: requireId(pack.ids.units, object.release.parentUnitSourceKey),
				versionLabel: object.release.versionLabel,
				releasedOn: object.release.releasedOn ?? null,
			});
			return;
		case "video":
			if (!object.video) throw new ContentPackInvalid(object.sourceKey + " missing video");
			await tx.insert(video).values({
				id: unitId,
				durationSeconds: object.video.durationSeconds ?? null,
			});
			return;
		case "audio":
			if (!object.audio) throw new ContentPackInvalid(object.sourceKey + " missing audio");
			await tx.insert(audio).values({
				id: unitId,
				durationSeconds: object.audio.durationSeconds ?? null,
			});
			return;
		case "collection":
			await tx.insert(collection).values({ id: unitId });
			return;
		case "realm":
			if (!object.realm) throw new ContentPackInvalid(`${object.sourceKey} missing realm`);
			await tx.insert(realm).values({
				id: unitId,
				joinPolicy: object.realm.joinPolicy,
				realmTagVotingEnabled: object.realm.realmTagVotingEnabled,
				enabledPages: [...object.realm.enabledPages],
			});
			return;
		case "zone": {
			const compiled = object.compiledZone;
			if (!compiled) throw new ContentPackInvalid(`${object.sourceKey} missing compiled zone`);
			assertFilterDocument(compiled.filterDocument);
			await tx.insert(zone).values({
				id: unitId,
				filterDocument: compiled.filterDocument,
				themeDocument: compiled.themeDocument,
				localRuleRealmId: requireId(pack.ids.units, compiled.localRuleRealmSourceKey),
			});
			return;
		}
		case "post":
			if (!object.post) throw new ContentPackInvalid(`${object.sourceKey} missing post`);
			await tx.insert(post).values({
				id: unitId,
				kind: object.post.kind,
				subjectUnitId: object.post.subjectSourceKey
					? requireId(pack.ids.units, object.post.subjectSourceKey)
					: null,
			});
			return;
		case "zone_page": {
			if (!object.zonePage || !object.post)
				throw new ContentPackInvalid(`${object.sourceKey} missing zone page`);
			const zoneId = requireId(pack.ids.units, object.zonePage.zoneSourceKey);
			await tx.insert(post).values({
				id: unitId,
				kind: "page",
				subjectUnitId: zoneId,
			});
			await tx.insert(zonePage).values({ id: unitId, zoneId });
			return;
		}
		default:
			throw new ContentPackInvalid(`Unsupported unit kind ${object.unit.kind}`);
	}
}

async function importTagEvidence(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
): Promise<void> {
	for (const object of pack.objects) {
		if (object.unit.kind !== "tag" || !object.tag || !("directlyApplicable" in object.tag))
			continue;
		const tagId = requireId(pack.ids.units, object.sourceKey);
		const [actual] = await tx
			.select({
				id: tag.id,
				directlyApplicable: tag.directlyApplicable,
				defaultSpoilerLevel: tag.defaultSpoilerLevel,
			})
			.from(tag)
			.where(eq(tag.id, tagId))
			.limit(1);
		if (!actual)
			throw new ContentPackCollision(`${object.sourceKey} does not resolve to an existing Tag`);
		if (
			actual.directlyApplicable !== object.tag.directlyApplicable ||
			actual.defaultSpoilerLevel !== object.tag.defaultSpoilerLevel
		)
			throw new ContentPackCollision(
				`${object.sourceKey} collides with different existing Tag policies`,
			);
		await tx.insert(contentPackTagEvidence).values({
			importId,
			sourceFingerprint: sourceFingerprint("tag", object.sourceKey),
			tagId,
			tagSourceKey: object.sourceKey,
			directlyApplicable: object.tag.directlyApplicable,
			defaultSpoilerLevel: object.tag.defaultSpoilerLevel,
			sourceCategory: object.tag.sourceCategory ?? null,
			parentSourceKeys: [...object.tag.parentSourceKeys],
			primaryParentSourceKey: object.tag.primaryParentSourceKey,
			sourceUrl: object.tag.sourceUrl,
			sourceImportedAt: sourceDate(object.tag.sourceImportedAt),
		});
	}
}

async function importEntityMeasurements(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
): Promise<void> {
	for (const object of pack.objects) {
		if (object.unit.kind !== "entity" || !object.entityMeasurements) continue;
		const entityId = requireId(pack.ids.units, object.sourceKey);
		for (const measurement of object.entityMeasurements) {
			const contextUnitId = measurement.contextUnitSourceKey
				? requireId(pack.ids.units, measurement.contextUnitSourceKey)
				: null;
			const sourceImportedAt = sourceDate(measurement.sourceImportedAt);
			await tx
				.insert(entityMeasurement)
				.values({
					entityId,
					contextUnitId,
					heightMillimetres: measurement.heightMillimetres ?? null,
					weightGrams: measurement.weightGrams ?? null,
					bustMillimetres: measurement.bustMillimetres ?? null,
					waistMillimetres: measurement.waistMillimetres ?? null,
					hipsMillimetres: measurement.hipsMillimetres ?? null,
				})
				.onConflictDoNothing();
			const [actual] = await tx
				.select({
					id: entityMeasurement.id,
					heightMillimetres: entityMeasurement.heightMillimetres,
					weightGrams: entityMeasurement.weightGrams,
					bustMillimetres: entityMeasurement.bustMillimetres,
					waistMillimetres: entityMeasurement.waistMillimetres,
					hipsMillimetres: entityMeasurement.hipsMillimetres,
				})
				.from(entityMeasurement)
				.where(
					and(
						eq(entityMeasurement.entityId, entityId),
						contextUnitId === null
							? isNull(entityMeasurement.contextUnitId)
							: eq(entityMeasurement.contextUnitId, contextUnitId),
					),
				)
				.limit(1);
			if (
				!actual ||
				actual.heightMillimetres !== (measurement.heightMillimetres ?? null) ||
				actual.weightGrams !== (measurement.weightGrams ?? null) ||
				actual.bustMillimetres !== (measurement.bustMillimetres ?? null) ||
				actual.waistMillimetres !== (measurement.waistMillimetres ?? null) ||
				actual.hipsMillimetres !== (measurement.hipsMillimetres ?? null)
			)
				throw new ContentPackCollision(
					`${object.sourceKey} measurement collides with different existing facts`,
				);
			await tx.insert(contentPackEntityMeasurementEvidence).values({
				importId,
				sourceFingerprint: sourceFingerprint(
					"entity-measurement",
					object.sourceKey,
					measurement.contextUnitSourceKey ?? "",
				),
				measurementId: actual.id,
				entitySourceKey: object.sourceKey,
				contextUnitSourceKey: measurement.contextUnitSourceKey ?? null,
				sourceUrl: measurement.sourceUrl,
				sourceObservedAt: sourceImportedAt,
				provenance: measurement.sourceProvenance,
			});
		}
	}
}

async function insertContentLanguageSupport(
	tx: DatabaseTransaction,
	object: PackObject,
	unitId: string,
): Promise<void> {
	if (object.contentLanguageSupport === undefined) return;
	if (!isContentLanguageSupportUnitKind(object.unit.kind))
		throw new ContentPackInvalid(
			object.sourceKey + " cannot declare content-consumption language support",
		);
	let value: ReturnType<typeof normalizeContentLanguageSupport>;
	try {
		value = normalizeContentLanguageSupport(object.contentLanguageSupport);
	} catch (error) {
		throw new ContentPackInvalid(
			object.sourceKey +
				" has invalid content language support: " +
				(error instanceof Error ? error.message : "unknown validation failure"),
		);
	}
	if (!value.length) return;
	await tx.insert(unitContentLanguageSupport).values({
		unitId,
		unitKind: object.unit.kind,
		value,
	});
}

function isContentLanguageSupportUnitKind(kind: string): kind is ContentLanguageSupportUnitKind {
	return ContentLanguageSupportUnitKindSet.has(kind);
}

function isVariantCapableUnitKind(kind: string): kind is VariantCapableUnitKind {
	return VariantCapableUnitKindSet.has(kind);
}

function touchesCreated(
	createKeys: ReadonlySet<string>,
	sourceKeys: readonly (string | null | undefined)[],
): boolean {
	return sourceKeys.some((key) => Boolean(key && createKeys.has(key)));
}

async function importRelations(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	createKeys: ReadonlySet<string>,
	importId: string,
): Promise<void> {
	const { relations, ids } = pack;
	const objectBySourceKey = new Map(
		pack.objects.map((object) => [object.sourceKey, object] as const),
	);
	const unitVariants = (relations.unitVariants ?? []).filter((item) =>
		touchesCreated(createKeys, [item.mainUnitSourceKey, item.variantUnitSourceKey]),
	);
	if (unitVariants.length) {
		const variantCountByMain = new Map<string, number>();
		const rows = unitVariants.map((item) => {
			if (!isVariantCapableUnitKind(item.unitKind))
				throw new ContentPackInvalid("Unsupported variant kind " + item.unitKind);
			const nextCount = (variantCountByMain.get(item.mainUnitSourceKey) ?? 0) + 1;
			if (nextCount > WorkPolicy.variant.maxGroupSize)
				throw new ContentPackInvalid("Unit Variant group exceeds the supported size");
			variantCountByMain.set(item.mainUnitSourceKey, nextCount);
			const variantObject = objectBySourceKey.get(item.variantUnitSourceKey);
			const mainObject = objectBySourceKey.get(item.mainUnitSourceKey);
			if (item.unitKind === "entity") {
				const variantEntityKind = variantObject?.entity?.kind;
				const mainEntityKind = mainObject?.entity?.kind;
				if (!variantEntityKind || variantEntityKind !== mainEntityKind)
					throw new ContentPackInvalid("Entity variant relations require matching Entity kinds");
			}
			return {
				mainUnitId: requireId(ids.units, item.mainUnitSourceKey),
				variantUnitId: requireId(ids.units, item.variantUnitSourceKey),
				unitKind: item.unitKind,
			};
		});
		await tx.insert(unitVariant).values(rows);
	}
	const credits = (relations.credits ?? []).filter((item) =>
		touchesCreated(createKeys, [item.sourceUnitSourceKey, item.creditedUnitSourceKey]),
	);
	if (credits.length)
		await tx.insert(creditAttribution).values(
			credits.map((item) => ({
				id: ids.credits?.[item.sourceKey],
				sourceUnitId: requireId(ids.units, item.sourceUnitSourceKey),
				creditedUnitId: requireId(ids.units, item.creditedUnitSourceKey),
				role: item.role,
				position: item.position,
			})),
		);
	await importSubjectRelations(tx, pack, importId);
	const seriesReleases = (relations.seriesReleases ?? []).filter((item) =>
		touchesCreated(createKeys, [item.seriesSourceKey, item.releaseUnitSourceKey]),
	);
	if (seriesReleases.length)
		await tx.insert(seriesRelease).values(
			seriesReleases.map((item) => ({
				seriesId: requireId(ids.units, item.seriesSourceKey),
				releaseUnitId: requireId(ids.units, item.releaseUnitSourceKey),
				position: item.position,
				releasedOn: item.releasedOn,
			})),
		);
	const collectionItems = (relations.collectionItems ?? []).filter((item) =>
		touchesCreated(createKeys, [item.collectionSourceKey, item.unitSourceKey]),
	);
	if (collectionItems.length)
		await tx.insert(collectionItem).values(
			collectionItems.map((item) => ({
				collectionId: requireId(ids.units, item.collectionSourceKey),
				unitId: requireId(ids.units, item.unitSourceKey),
				position: item.position,
				addedByProfileId: ImportOwnerProfileId,
			})),
		);
	await importUnitTagRelations(tx, pack, importId);
	const realmUnits = (relations.realmUnits ?? []).filter((item) =>
		touchesCreated(createKeys, [item.realmSourceKey, item.unitSourceKey]),
	);
	if (realmUnits.length) {
		const rows = realmUnits.map((item) => ({
			realmId: requireId(ids.units, item.realmSourceKey),
			unitId: requireId(ids.units, item.unitSourceKey),
			status: item.status,
			publicationState: item.publicationState,
		}));
		await tx.insert(realmUnit).values(rows);
		await recordInitialRealmUnitPublicationEvents(tx, {
			relations: rows.map((row) => ({ realmId: row.realmId, unitId: row.unitId })),
			actorProfileId: ImportOwnerProfileId,
		});
	}
}

async function importUnitTagRelations(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
): Promise<void> {
	const relations = pack.relations.unitTags ?? [];
	if (!relations.length) return;
	const uniqueTagIds = [
		...new Set(relations.map((relation) => requireId(pack.ids.units, relation.tagSourceKey))),
	];
	const policies = [];
	for (const ids of chunks(uniqueTagIds, ImportReadBatchSize))
		policies.push(
			...(await tx
				.select({ id: tag.id, directlyApplicable: tag.directlyApplicable })
				.from(tag)
				.where(inArray(tag.id, ids))),
		);
	const policyById = new Map(policies.map((policy) => [policy.id, policy] as const));
	for (const tagId of uniqueTagIds) {
		const policy = policyById.get(tagId);
		if (!policy) throw new ContentPackInvalid(`Direct Tag target ${tagId} does not exist`);
		if (!policy.directlyApplicable)
			throw new ContentPackInvalid(`Tag ${tagId} is not directly applicable`);
	}

	for (const relation of relations) await importUnitTagRelation(tx, pack, importId, relation);
}

async function importUnitTagRelation(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
	relation: PackUnitTagRelation,
): Promise<void> {
	const unitId = requireId(pack.ids.units, relation.unitSourceKey);
	const tagId = requireId(pack.ids.units, relation.tagSourceKey);
	await tx
		.insert(unitTag)
		.values({
			unitId,
			tagId,
			pinned: relation.pinned,
			position: relation.position,
			createdByProfileId: ImportOwnerProfileId,
		})
		.onConflictDoNothing();
	const [actualApplication] = await tx
		.select({ pinned: unitTag.pinned, position: unitTag.position })
		.from(unitTag)
		.where(and(eq(unitTag.unitId, unitId), eq(unitTag.tagId, tagId)))
		.limit(1);
	if (
		!actualApplication ||
		actualApplication.pinned !== relation.pinned ||
		actualApplication.position !== relation.position
	)
		throw new ContentPackCollision(
			`${relation.unitSourceKey}/${relation.tagSourceKey} collides with a different Tag application`,
		);

	if (relation.fitVote === undefined) return;
	if (
		relation.spoilerLevel === undefined ||
		relation.sourceUrl === undefined ||
		relation.sourceImportedAt === undefined ||
		relation.sourceAggregate === undefined
	)
		throw new ContentPackInvalid("Incomplete direct Tag judgment evidence reached the importer");
	const sourceImportedAt = sourceDate(relation.sourceImportedAt);
	await tx
		.insert(unitTagJudgment)
		.values({
			unitId,
			tagId,
			profileId: ImportOwnerProfileId,
			fitVote: relation.fitVote,
			spoilerLevel: relation.spoilerLevel,
			fitUpdatedAt: sourceImportedAt,
			spoilerUpdatedAt: relation.spoilerLevel === null ? null : sourceImportedAt,
			createdAt: sourceImportedAt,
			updatedAt: sourceImportedAt,
		})
		.onConflictDoNothing();
	const [actualJudgment] = await tx
		.select({
			fitVote: unitTagJudgment.fitVote,
			spoilerLevel: unitTagJudgment.spoilerLevel,
			fitUpdatedAt: unitTagJudgment.fitUpdatedAt,
			spoilerUpdatedAt: unitTagJudgment.spoilerUpdatedAt,
		})
		.from(unitTagJudgment)
		.where(
			and(
				eq(unitTagJudgment.unitId, unitId),
				eq(unitTagJudgment.tagId, tagId),
				eq(unitTagJudgment.profileId, ImportOwnerProfileId),
			),
		)
		.limit(1);
	if (
		!actualJudgment ||
		actualJudgment.fitVote !== relation.fitVote ||
		actualJudgment.spoilerLevel !== relation.spoilerLevel ||
		actualJudgment.fitUpdatedAt?.getTime() !== sourceImportedAt.getTime() ||
		actualJudgment.spoilerUpdatedAt?.getTime() !==
			(relation.spoilerLevel === null ? undefined : sourceImportedAt.getTime())
	)
		throw new ContentPackConflict(
			`${relation.unitSourceKey}/${relation.tagSourceKey} has a different importer judgment`,
		);
	await tx.insert(contentPackUnitTagEvidence).values({
		importId,
		sourceFingerprint: sourceFingerprint("unit-tag", relation.unitSourceKey, relation.tagSourceKey),
		unitId,
		tagId,
		profileId: ImportOwnerProfileId,
		unitSourceKey: relation.unitSourceKey,
		tagSourceKey: relation.tagSourceKey,
		sourceFitVote: relation.fitVote,
		sourceSpoilerLevel: relation.spoilerLevel,
		sourceUrl: relation.sourceUrl,
		sourceImportedAt,
		sourceAggregate: relation.sourceAggregate,
	});
}

async function importSubjectRelations(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
): Promise<void> {
	for (const relation of pack.relations.subjects ?? [])
		await importSubjectRelation(tx, pack, importId, relation);
}

async function importSubjectRelation(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
	relation: PackSubjectRelation,
): Promise<void> {
	const declaredAssociationId = requireId(pack.ids.subjects ?? {}, relation.sourceKey);
	const unitId = requireId(pack.ids.units, relation.unitSourceKey);
	const entityId = requireId(pack.ids.units, relation.entitySourceKey);
	const contextPostId = relation.contextPostSourceKey
		? requireId(pack.ids.units, relation.contextPostSourceKey)
		: null;
	let [actual] = await tx
		.select()
		.from(subjectAssociation)
		.where(eq(subjectAssociation.id, declaredAssociationId))
		.limit(1);
	if (!actual)
		[actual] = await tx
			.select()
			.from(subjectAssociation)
			.where(
				and(
					eq(subjectAssociation.unitId, unitId),
					eq(subjectAssociation.entityId, entityId),
					eq(subjectAssociation.role, relation.role),
				),
			)
			.limit(1);
	if (!actual) {
		await tx
			.insert(subjectAssociation)
			.values({
				id: declaredAssociationId,
				unitId,
				entityId,
				role: relation.role,
				contextPostId,
				position: relation.position,
			})
			.onConflictDoNothing();
		[actual] = await tx
			.select()
			.from(subjectAssociation)
			.where(
				and(
					eq(subjectAssociation.unitId, unitId),
					eq(subjectAssociation.entityId, entityId),
					eq(subjectAssociation.role, relation.role),
				),
			)
			.limit(1);
	}
	if (
		!actual ||
		actual.unitId !== unitId ||
		actual.entityId !== entityId ||
		actual.role !== relation.role ||
		actual.contextPostId !== contextPostId ||
		actual.position !== relation.position
	)
		throw new ContentPackCollision(`${relation.sourceKey} collides with another subject relation`);
	if (relation.spoilerLevel === undefined) return;
	if (relation.sourceUrl === undefined || relation.sourceImportedAt === undefined)
		throw new ContentPackInvalid("Incomplete subject evidence reached the importer");
	const sourceImportedAt = sourceDate(relation.sourceImportedAt);
	await tx
		.insert(subjectAssociationJudgment)
		.values({
			associationId: actual.id,
			profileId: ImportOwnerProfileId,
			spoilerLevel: relation.spoilerLevel,
			createdAt: sourceImportedAt,
			updatedAt: sourceImportedAt,
		})
		.onConflictDoNothing();
	const [actualJudgment] = await tx
		.select({ spoilerLevel: subjectAssociationJudgment.spoilerLevel })
		.from(subjectAssociationJudgment)
		.where(
			and(
				eq(subjectAssociationJudgment.associationId, actual.id),
				eq(subjectAssociationJudgment.profileId, ImportOwnerProfileId),
			),
		)
		.limit(1);
	if (actualJudgment?.spoilerLevel !== relation.spoilerLevel)
		throw new ContentPackConflict(`${relation.sourceKey} has a different importer judgment`);
	await tx.insert(contentPackSubjectAssociationEvidence).values({
		importId,
		sourceFingerprint: sourceFingerprint("subject", relation.sourceKey),
		associationId: actual.id,
		profileId: ImportOwnerProfileId,
		declaredAssociationId,
		subjectSourceKey: relation.sourceKey,
		sourceSpoilerLevel: relation.spoilerLevel,
		sourceUrl: relation.sourceUrl,
		sourceImportedAt,
	});
}

async function importTagPaths(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
): Promise<void> {
	const actualPathIds = new Map<string, string>();
	for (const path of pack.relations.tagPaths ?? []) {
		const pathId = await importTagPathDefinition(tx, pack, importId, path);
		actualPathIds.set(path.sourceKey, pathId);
	}
	for (const application of pack.relations.tagPathApplications ?? [])
		await importTagPathApplication(tx, pack, importId, application, actualPathIds);
}

async function importTagPathDefinition(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
	path: PackTagPath,
): Promise<string> {
	const declaredPathId = requireId(pack.ids.tagPaths ?? {}, path.sourceKey);
	const sourceImportedAt = sourceDate(path.sourceImportedAt);
	const result = await createTagPathInTransaction(tx, {
		pathId: declaredPathId,
		memberTagIds: path.memberTagSourceKeys.map((sourceKey) => requireId(pack.ids.units, sourceKey)),
		profileId: ImportOwnerProfileId,
		createdAt: sourceImportedAt,
	});
	await tx.insert(contentPackTagPathDefinitionEvidence).values({
		importId,
		sourceFingerprint: sourceFingerprint("tag-path", path.sourceKey),
		pathId: result.pathId,
		profileId: ImportOwnerProfileId,
		declaredPathId,
		pathSourceKey: path.sourceKey,
		memberTagSourceKeys: [...path.memberTagSourceKeys],
		sourceVote: 1,
		sourceUrl: path.sourceUrl,
		sourceImportedAt,
	});
	return result.pathId;
}

async function importTagPathApplication(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	importId: string,
	application: PackTagPathApplication,
	actualPathIds: ReadonlyMap<string, string>,
): Promise<void> {
	const unitId = requireId(pack.ids.units, application.unitSourceKey);
	const declaredPathId = requireId(pack.ids.tagPaths ?? {}, application.pathSourceKey);
	const pathId = actualPathIds.get(application.pathSourceKey);
	if (!pathId)
		throw new ContentPackInvalid(
			`Tag Path application references unknown path ${application.pathSourceKey}`,
		);
	const sourceImportedAt = sourceDate(application.sourceImportedAt);
	await tx
		.insert(unitTagPath)
		.values({
			unitId,
			pathId,
			createdByProfileId: ImportOwnerProfileId,
			pinned: false,
			position: null,
			createdAt: sourceImportedAt,
			updatedAt: sourceImportedAt,
		})
		.onConflictDoNothing();
	const [actualApplication] = await tx
		.select({ unitId: unitTagPath.unitId })
		.from(unitTagPath)
		.where(and(eq(unitTagPath.unitId, unitId), eq(unitTagPath.pathId, pathId)))
		.limit(1);
	if (!actualApplication)
		throw new ContentPackCollision(
			`${application.unitSourceKey}/${application.pathSourceKey} application was not created`,
		);
	await tx
		.insert(unitTagPathJudgment)
		.values({
			unitId,
			pathId,
			profileId: ImportOwnerProfileId,
			fitVote: application.fitVote,
			spoilerLevel: application.spoilerLevel,
			fitUpdatedAt: sourceImportedAt,
			spoilerUpdatedAt: application.spoilerLevel === null ? null : sourceImportedAt,
			createdAt: sourceImportedAt,
			updatedAt: sourceImportedAt,
		})
		.onConflictDoNothing();
	const [actualJudgment] = await tx
		.select({
			fitVote: unitTagPathJudgment.fitVote,
			spoilerLevel: unitTagPathJudgment.spoilerLevel,
			fitUpdatedAt: unitTagPathJudgment.fitUpdatedAt,
			spoilerUpdatedAt: unitTagPathJudgment.spoilerUpdatedAt,
		})
		.from(unitTagPathJudgment)
		.where(
			and(
				eq(unitTagPathJudgment.unitId, unitId),
				eq(unitTagPathJudgment.pathId, pathId),
				eq(unitTagPathJudgment.profileId, ImportOwnerProfileId),
			),
		)
		.limit(1);
	if (
		!actualJudgment ||
		actualJudgment.fitVote !== application.fitVote ||
		actualJudgment.spoilerLevel !== application.spoilerLevel ||
		actualJudgment.fitUpdatedAt?.getTime() !== sourceImportedAt.getTime() ||
		actualJudgment.spoilerUpdatedAt?.getTime() !==
			(application.spoilerLevel === null ? undefined : sourceImportedAt.getTime())
	)
		throw new ContentPackConflict(
			`${application.unitSourceKey}/${application.pathSourceKey} has a different importer judgment`,
		);
	await tx.insert(contentPackUnitTagPathEvidence).values({
		importId,
		sourceFingerprint: sourceFingerprint(
			"tag-path-application",
			application.unitSourceKey,
			application.pathSourceKey,
		),
		unitId,
		pathId,
		profileId: ImportOwnerProfileId,
		unitSourceKey: application.unitSourceKey,
		pathSourceKey: application.pathSourceKey,
		declaredPathId,
		sourceFitVote: application.fitVote,
		sourceSpoilerLevel: application.spoilerLevel,
		sourceUrl: application.sourceUrl,
		sourceImportedAt,
		sourceAggregate: application.sourceAggregate,
	});
}

async function importStructures(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
	for (const structure of pack.structures) {
		const ownerUnitId = requireId(pack.ids.units, structure.ownerUnitSourceKey);
		const structureId = pack.ids.structures?.[structure.sourceKey];
		if (await contentStructureAlreadyPresent(tx, ownerUnitId, structure.kind, structureId))
			continue;
		if (structure.kind === "zone.navigation" || structure.kind === "wiki.navigation") {
			await createNavigationStructure(tx, {
				ownerUnitId,
				structureId,
				kind: structure.kind,
				document: navigationDocumentFrom(pack, structure),
				actorProfileId: ImportOwnerProfileId,
			});
			continue;
		}
		const created = await createContentStructure(tx, {
			ownerUnitId,
			structureId,
			kind: structure.kind,
			actorProfileId: ImportOwnerProfileId,
		});
		if (!structure.nodes.length) continue;
		const commands: ContentStructureBatchCommand[] = structure.nodes.map((node) => ({
			opId: node.sourceKey,
			type: "node.create",
			nodeId: requireId(pack.ids.nodes ?? {}, node.sourceKey),
			parentId: node.parentSourceKey ? requireId(pack.ids.nodes ?? {}, node.parentSourceKey) : null,
			contentUnitId: requireId(pack.ids.units, node.contentUnitSourceKey),
			target:
				node.targetKind === "unit" && node.targetUnitSourceKey
					? { kind: "unit", unitId: requireId(pack.ids.units, node.targetUnitSourceKey) }
					: { kind: node.targetKind === "none" ? "none" : "content" },
			position: node.position,
		}));
		await applyContentStructureBatch(tx, {
			ownerUnitId,
			structureId: created.structure.id,
			baseRevisionId: created.revisionId,
			actorProfileId: ImportOwnerProfileId,
			commands,
		});
	}
}

function navigationDocumentFrom(pack: LoadedPack, structure: PackStructure) {
	return {
		_type: "navigation-document" as const,
		_key: sha256Hex(structure.sourceKey).slice(0, 12),
		items: structure.nodes.map((node) => {
			if (!node.targetUnitSourceKey)
				throw new ContentPackInvalid(`${node.sourceKey} navigation node needs a target unit`);
			return {
				_key: sha256Hex(node.sourceKey).slice(0, 12),
				labelUnitId: requireId(pack.ids.units, node.contentUnitSourceKey),
				target: {
					kind: "unit" as const,
					unitId: requireId(pack.ids.units, node.targetUnitSourceKey),
				},
			};
		}),
	};
}

async function contentStructureAlreadyPresent(
	tx: DatabaseTransaction,
	ownerUnitId: string,
	kind: ContentStructureKind,
	structureId: string | undefined,
): Promise<boolean> {
	if (structureId) {
		const [byId] = await tx
			.select({ id: contentStructure.id })
			.from(contentStructure)
			.where(and(eq(contentStructure.id, structureId), isNull(contentStructure.deletedAt)))
			.limit(1);
		if (byId) return true;
	}
	const [byOwner] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, ownerUnitId),
				eq(contentStructure.kind, kind),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	return Boolean(byOwner);
}

async function importSlugs(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	createKeys: ReadonlySet<string>,
): Promise<void> {
	for (const object of pack.objects) {
		if (object.unit.kind !== "zone_page" || !object.zonePage) continue;
		if (!createKeys.has(object.sourceKey)) continue;
		await replaceZonePageSlugAddress(tx, {
			zoneId: requireId(pack.ids.units, object.zonePage.zoneSourceKey),
			pageUnitId: requireId(pack.ids.units, object.sourceKey),
			slug: ZoneHomePageSlug,
		});
	}
	for (const slug of pack.relations.slugs ?? []) {
		if (!createKeys.has(slug.targetSourceKey)) continue;
		const scopeUnitId = TopLevelSlugNamespaceUnitIds[slug.scope];
		if (!scopeUnitId) throw new ContentPackInvalid(`Unknown slug scope ${slug.scope}`);
		await tx.insert(unitSlugAddress).values({
			kind: "canonical",
			scopeUnitId,
			slug: slug.slug,
			targetUnitId: requireId(pack.ids.units, slug.targetSourceKey),
		});
	}
}

function requireId(map: Record<string, string>, sourceKey: string): string {
	const id = map[sourceKey];
	if (!id) throw new ContentPackCollision(`Missing id for ${sourceKey}`);
	return id;
}

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function sourceFingerprint(kind: string, ...sourceKeys: readonly string[]): string {
	return sha256Hex(stableJson([kind, ...sourceKeys]));
}

function sourceDate(value: string): Date {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime()))
		throw new ContentPackInvalid(`Invalid source import timestamp ${value}`);
	return date;
}

function stableJson(value: unknown): string {
	const serialized = JSON.stringify(value, (_key, nested) => {
		if (nested === null || typeof nested !== "object" || Array.isArray(nested)) return nested;
		return Object.fromEntries(
			Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)),
		);
	});
	if (serialized === undefined)
		throw new ContentPackInvalid("A source evidence value cannot be serialized as JSON");
	return serialized;
}

function fractionalFromIndex(index: number): string {
	return index === 0 ? "a0" : `a${index.toString(36)}`;
}
