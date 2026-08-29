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
	tagRelation,
	unit,
	unitContentLanguageSupport,
	unitAlias,
	unitLocalization,
	unitSlugAddress,
	unitTagPathApplication,
	unitTagPathApplicationJudgment,
	unitTag,
	unitTagJudgment,
	unitVariant,
	video,
	vocabularyNode,
	guideNode,
	guideNodeLocalization,
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
import type {
	ContentPackPlan,
	LoadedPack,
	PackObject,
	PackRelations,
	PackStructure,
} from "./contracts";
import { createTagPathInTransaction, createTagPathSenseInTransaction } from "../tag-paths/service";
import {
	createTagExpressionInferenceRuleInTransaction,
	createTagExpressionInTransaction,
	ensureSimpleTagExpressionInTransaction,
} from "../tag-expressions/service";
import { assertContentPackThemeAssets } from "./theme-assets";

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
type PackTagExpression = NonNullable<PackRelations["tagExpressions"]>[number];
type PackTagPathSense = NonNullable<PackRelations["tagPathSenses"]>[number];
type PackTagPathApplication = NonNullable<PackRelations["tagPathApplications"]>[number];

export async function applyContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sourceRoot: string,
): Promise<{ readonly status: "created" | "noop"; readonly created: number }> {
	assertContentPackDocuments(pack);
	await assertContentPackThemeAssets(tx, pack);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`showcase-fixture:${pack.manifest.id}`}::text, 0))`,
	);
	const plan = await planContentPack(tx, pack, sourceRoot);
	if (plan.conflicts.length)
		throw new ContentPackConflict(
			plan.conflicts
				.map(
					(item) => `${item.sourceKey}: ${item.action === "conflict" ? item.reason : "conflict"}`,
				)
				.join("; "),
		);
	assertShowcaseFixtureInstallState(plan);
	await verifyExistingPackObjects(tx, pack, plan.objects);
	if (plan.alreadyInstalled || plan.createCount === 0) return { status: "noop", created: 0 };

	const createKeys = new Set(
		plan.objects.filter((item) => item.action === "create").map((item) => item.sourceKey),
	);
	const objects = [...pack.objects]
		.filter((object) => createKeys.has(object.sourceKey))
		.sort((left, right) => kindRank(left.unit.kind) - kindRank(right.unit.kind));

	for (const object of objects) await importUnit(tx, pack, object);

	await importEntityMeasurements(tx, pack);
	await importVocabularyDefinitions(tx, pack);
	await importRelations(tx, pack, createKeys);
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

export function assertShowcaseFixtureInstallState(
	plan: Pick<ContentPackPlan, "createCount" | "noopCount">,
): void {
	if (plan.createCount > 0 && plan.noopCount > 0)
		throw new ContentPackConflict(
			"A showcase fixture cannot update a partially populated database; reset the local database and load it again",
		);
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
			await tx.insert(vocabularyNode).values({
				id: unitId,
				kind: "concept",
				createdByProfileId: ImportOwnerProfileId,
			});
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

async function importEntityMeasurements(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
	for (const object of pack.objects) {
		if (object.unit.kind !== "entity" || !object.entityMeasurements) continue;
		const entityId = requireId(pack.ids.units, object.sourceKey);
		for (const measurement of object.entityMeasurements) {
			const contextUnitId = measurement.contextUnitSourceKey
				? requireId(pack.ids.units, measurement.contextUnitSourceKey)
				: null;
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
	await importSubjectRelations(tx, pack);
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
	await importUnitTagRelations(tx, pack);
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

async function importUnitTagRelations(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
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

	for (const relation of relations) await importUnitTagRelation(tx, pack, relation);
}

async function importUnitTagRelation(
	tx: DatabaseTransaction,
	pack: LoadedPack,
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
	if (relation.spoilerLevel === undefined || relation.sourceImportedAt === undefined)
		throw new ContentPackInvalid("Incomplete direct Tag judgment reached the showcase loader");
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
			`${relation.unitSourceKey}/${relation.tagSourceKey} has a different showcase judgment`,
		);
}

async function importSubjectRelations(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
	for (const relation of pack.relations.subjects ?? [])
		await importSubjectRelation(tx, pack, relation);
}

async function importSubjectRelation(
	tx: DatabaseTransaction,
	pack: LoadedPack,
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
	if (relation.sourceImportedAt === undefined)
		throw new ContentPackInvalid("Incomplete subject judgment reached the showcase loader");
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
		throw new ContentPackConflict(`${relation.sourceKey} has a different showcase judgment`);
}

function requireVocabularyNodeId(pack: LoadedPack, sourceKey: string): string {
	return pack.ids.units[sourceKey] ?? requireId(pack.ids.guideNodes ?? {}, sourceKey);
}

async function importVocabularyDefinitions(
	tx: DatabaseTransaction,
	pack: LoadedPack,
): Promise<void> {
	await importGuideNodes(tx, pack);
	const actualRelationIds = await importTagRelations(tx, pack);
	const actualExpressionIds = await importTagExpressions(tx, pack);
	for (const object of pack.objects)
		if (object.unit.kind === "tag")
			await ensureSimpleTagExpressionInTransaction(tx, {
				tagId: requireId(pack.ids.units, object.sourceKey),
				profileId: ImportOwnerProfileId,
			});
	const actualPathIds = new Map<string, string>();
	for (const path of pack.relations.tagPaths ?? []) {
		const pathId = await importTagPathDefinition(tx, pack, path, actualRelationIds);
		actualPathIds.set(path.sourceKey, pathId);
	}
	const actualSenseIds = new Map<string, string>();
	for (const sense of pack.relations.tagPathSenses ?? []) {
		const senseId = await importTagPathSense(tx, pack, sense, actualPathIds, actualExpressionIds);
		actualSenseIds.set(sense.sourceKey, senseId);
	}
	for (const rule of pack.relations.tagExpressionInferenceRules ?? []) {
		const sourceExpressionId = actualExpressionIds.get(rule.sourceExpressionSourceKey);
		if (!sourceExpressionId)
			throw new ContentPackInvalid(
				`Unknown inference source Expression ${rule.sourceExpressionSourceKey}`,
			);
		await createTagExpressionInferenceRuleInTransaction(tx, {
			sourceExpressionId,
			targetTagId: rule.targetTagSourceKey
				? requireId(pack.ids.units, rule.targetTagSourceKey)
				: undefined,
			targetExpressionId: rule.targetExpressionSourceKey
				? actualExpressionIds.get(rule.targetExpressionSourceKey)
				: undefined,
			inferenceKind: rule.inferenceKind,
			provenance: {
				sourceUrl: rule.sourceUrl,
				sourceImportedAt: rule.sourceImportedAt,
			},
			profileId: ImportOwnerProfileId,
			createdAt: sourceDate(rule.sourceImportedAt),
		});
	}
	for (const application of pack.relations.tagPathApplications ?? [])
		await importTagPathApplication(tx, pack, application, actualSenseIds);
}

async function importGuideNodes(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
	for (const definition of pack.relations.guideNodes ?? []) {
		const nodeId = requireId(pack.ids.guideNodes ?? {}, definition.sourceKey);
		await tx
			.insert(vocabularyNode)
			.values({
				id: nodeId,
				kind: "guide",
				createdByProfileId: ImportOwnerProfileId,
				createdAt: sourceDate(definition.sourceImportedAt),
			})
			.onConflictDoNothing();
		await tx.insert(guideNode).values({ id: nodeId }).onConflictDoNothing();
		await tx
			.insert(guideNodeLocalization)
			.values(
				definition.localizations.map((localization) => ({
					nodeId,
					language: localization.language,
					title: localization.title,
				})),
			)
			.onConflictDoNothing();
	}
}

async function importTagRelations(
	tx: DatabaseTransaction,
	pack: LoadedPack,
): Promise<Map<string, string>> {
	const actualIds = new Map<string, string>();
	for (const definition of pack.relations.tagRelations ?? []) {
		const declaredId = requireId(pack.ids.tagRelations ?? {}, definition.sourceKey);
		const parentNodeId = requireVocabularyNodeId(pack, definition.parentNodeSourceKey);
		const childNodeId = requireVocabularyNodeId(pack, definition.childNodeSourceKey);
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`tag-relation:${parentNodeId}:${childNodeId}:${definition.relationKind}`}::text, 0))`,
		);
		const [existing] = await tx
			.select({ id: tagRelation.id })
			.from(tagRelation)
			.where(
				and(
					eq(tagRelation.parentNodeId, parentNodeId),
					eq(tagRelation.childNodeId, childNodeId),
					eq(tagRelation.relationKind, definition.relationKind),
					eq(tagRelation.status, "active"),
				),
			)
			.limit(1);
		let relationId = existing?.id;
		if (!relationId) {
			const [created] = await tx
				.insert(tagRelation)
				.values({
					id: declaredId,
					parentNodeId,
					childNodeId,
					relationKind: definition.relationKind,
					provenance: {
						sourceUrl: definition.sourceUrl,
						sourceImportedAt: definition.sourceImportedAt,
					},
					createdByProfileId: ImportOwnerProfileId,
					createdAt: sourceDate(definition.sourceImportedAt),
				})
				.returning({ id: tagRelation.id });
			relationId = created?.id;
		}
		if (!relationId) throw new ContentPackCollision(`Tag relation ${definition.sourceKey} failed`);
		actualIds.set(definition.sourceKey, relationId);
	}
	return actualIds;
}

async function importTagExpressions(
	tx: DatabaseTransaction,
	pack: LoadedPack,
): Promise<Map<string, string>> {
	const actualIds = new Map<string, string>();
	for (const definition of pack.relations.tagExpressions ?? []) {
		const expressionId = await importTagExpression(tx, pack, definition);
		actualIds.set(definition.sourceKey, expressionId);
	}
	return actualIds;
}

async function importTagExpression(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	definition: PackTagExpression,
): Promise<string> {
	const declaredExpressionId = requireId(pack.ids.tagExpressions ?? {}, definition.sourceKey);
	const result = await createTagExpressionInTransaction(tx, {
		expressionId: declaredExpressionId,
		expressionKind: definition.expressionKind,
		canonicalClaimKey: definition.canonicalClaimKey,
		focusTagId: requireId(pack.ids.units, definition.focusTagSourceKey),
		arguments: definition.arguments.map((argument) => ({
			role: argument.role,
			ordinal: argument.ordinal,
			tagId: requireId(pack.ids.units, argument.tagSourceKey),
		})),
		labelComponents: definition.labelComponents.map((component) => ({
			tagId: requireId(pack.ids.units, component.tagSourceKey),
			semanticRole: component.semanticRole,
			componentKind: component.componentKind,
		})),
		groupKey: definition.groupKey
			? {
					tagId: requireId(pack.ids.units, definition.groupKey.tagSourceKey),
					semanticRole: definition.groupKey.semanticRole,
				}
			: null,
		profileId: ImportOwnerProfileId,
		createdAt: sourceDate(definition.sourceImportedAt),
	});
	return result.expressionId;
}

async function importTagPathDefinition(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	path: PackTagPath,
	actualRelationIds: ReadonlyMap<string, string>,
): Promise<string> {
	const declaredPathId = requireId(pack.ids.tagPaths ?? {}, path.sourceKey);
	const sourceImportedAt = sourceDate(path.sourceImportedAt);
	const result = await createTagPathInTransaction(tx, {
		pathId: declaredPathId,
		memberNodeIds: path.memberNodeSourceKeys.map((sourceKey) =>
			requireVocabularyNodeId(pack, sourceKey),
		),
		relationIds: path.relationSourceKeys.map((sourceKey) => {
			const relationId = actualRelationIds.get(sourceKey);
			if (!relationId) throw new ContentPackInvalid(`Unknown Tag relation ${sourceKey}`);
			return relationId;
		}),
		profileId: ImportOwnerProfileId,
		createdAt: sourceImportedAt,
	});
	return result.pathId;
}

async function importTagPathSense(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sense: PackTagPathSense,
	actualPathIds: ReadonlyMap<string, string>,
	actualExpressionIds: ReadonlyMap<string, string>,
): Promise<string> {
	const pathId = actualPathIds.get(sense.pathSourceKey);
	const expressionId = actualExpressionIds.get(sense.expressionSourceKey);
	if (!pathId || !expressionId)
		throw new ContentPackInvalid(`Tag Path Sense ${sense.sourceKey} has an unknown definition`);
	const declaredSenseId = requireId(pack.ids.tagPathSenses ?? {}, sense.sourceKey);
	const result = await createTagPathSenseInTransaction(tx, {
		senseId: declaredSenseId,
		pathId,
		expressionId,
		scope: "global",
		bindings: sense.bindings,
		provenance: {
			sourceUrl: sense.sourceUrl,
			sourceImportedAt: sense.sourceImportedAt,
		},
		profileId: ImportOwnerProfileId,
		createdAt: sourceDate(sense.sourceImportedAt),
	});
	return result.senseId;
}

async function importTagPathApplication(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	application: PackTagPathApplication,
	actualSenseIds: ReadonlyMap<string, string>,
): Promise<void> {
	const unitId = requireId(pack.ids.units, application.unitSourceKey);
	const senseId = actualSenseIds.get(application.senseSourceKey);
	if (!senseId)
		throw new ContentPackInvalid(
			`Tag Path application references unknown Sense ${application.senseSourceKey}`,
		);
	const sourceImportedAt = sourceDate(application.sourceImportedAt);
	await tx
		.insert(unitTagPathApplication)
		.values({
			unitId,
			senseId,
			createdByProfileId: ImportOwnerProfileId,
			pinned: false,
			position: null,
			createdAt: sourceImportedAt,
			updatedAt: sourceImportedAt,
		})
		.onConflictDoNothing()
		.returning({ id: unitTagPathApplication.id });
	const [actualApplication] = await tx
		.select({ id: unitTagPathApplication.id })
		.from(unitTagPathApplication)
		.where(
			and(eq(unitTagPathApplication.unitId, unitId), eq(unitTagPathApplication.senseId, senseId)),
		)
		.limit(1);
	if (!actualApplication)
		throw new ContentPackCollision(
			`${application.unitSourceKey}/${application.senseSourceKey} application was not created`,
		);
	await tx
		.insert(unitTagPathApplicationJudgment)
		.values({
			applicationId: actualApplication.id,
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
			fitVote: unitTagPathApplicationJudgment.fitVote,
			spoilerLevel: unitTagPathApplicationJudgment.spoilerLevel,
			fitUpdatedAt: unitTagPathApplicationJudgment.fitUpdatedAt,
			spoilerUpdatedAt: unitTagPathApplicationJudgment.spoilerUpdatedAt,
		})
		.from(unitTagPathApplicationJudgment)
		.where(
			and(
				eq(unitTagPathApplicationJudgment.applicationId, actualApplication.id),
				eq(unitTagPathApplicationJudgment.profileId, ImportOwnerProfileId),
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
			`${application.unitSourceKey}/${application.senseSourceKey} has a different showcase judgment`,
		);
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

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
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

function sourceDate(value: string): Date {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime()))
		throw new ContentPackInvalid(`Invalid source import timestamp ${value}`);
	return date;
}

function fractionalFromIndex(index: number): string {
	return index === 0 ? "a0" : `a${index.toString(36)}`;
}
