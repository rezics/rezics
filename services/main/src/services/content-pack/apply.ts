import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { assertFilterDocument } from "@rezics/filter";
import { isPublicationLicenseId, type PublicationLicenseId } from "@rezics/license";
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
	book,
	collection,
	collectionItem,
	creditAttribution,
	entity,
	label,
	media,
	post,
	realm,
	realmUnit,
	series,
	seriesRelease,
	subjectAssociation,
	tag,
	unitAlias,
	unitLocalization,
	unitSlugAddress,
	unitTag,
	zone,
	zonePage,
	AliasKindValues,
	RealmJoinPolicyValues,
	type CreditAttributionRole,
	type RealmPageKind,
	type SubjectAssociationRole,
	type UnitKind,
} from "../database/schema";
import { recordUnitRevision } from "../units/history";
import { insertUnit } from "../units/create";
import { recordInitialRealmUnitPublicationEvents } from "../units/realm-publication";
import { replaceZonePageSlugAddress } from "../units/slug-address";
import { ContentPackCollision, ContentPackConflict, ContentPackInvalid } from "./errors";
import { planContentPack } from "./plan";
import type { LoadedPack, PackObject, PackStructure } from "./contracts";

const ImportOwnerProfileId = OfficialProfileIds.editorial;
const KindOrder: readonly string[] = [
	"tag",
	"entity",
	"label",
	"series",
	"book",
	"media",
	"collection",
	"realm",
	"zone",
	"post",
	"zone_page",
];

export async function applyContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sourceRoot: string,
): Promise<{ readonly status: "created" | "noop"; readonly created: number }> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`content-pack:${pack.manifest.id}`}::text, 0))`,
	);
	const plan = await planContentPack(tx, pack, sourceRoot);
	if (plan.conflicts.length)
		throw new ContentPackConflict(
			plan.conflicts
				.map((item) => `${item.sourceKey}: ${item.action === "conflict" ? item.reason : "conflict"}`)
				.join("; "),
		);
	if (plan.alreadyInstalled || plan.createCount === 0)
		return { status: "noop", created: 0 };

	const createKeys = new Set(
		plan.objects.filter((item) => item.action === "create").map((item) => item.sourceKey),
	);
	const objects = [...pack.objects]
		.filter((object) => createKeys.has(object.sourceKey))
		.sort((left, right) => kindRank(left.unit.kind) - kindRank(right.unit.kind));

	for (const object of objects) await importUnit(tx, pack, object);

	await importRelations(tx, pack, createKeys);
	await importStructures(tx, pack);
	await importSlugs(tx, pack);

	for (const object of objects) {
		await recordUnitRevision(tx, {
			unitId: requireId(pack.ids.units, object.sourceKey),
			actorProfileId: ImportOwnerProfileId,
			event: "create",
		});
	}
	return { status: "created", created: objects.length };
}

function kindRank(kind: string): number {
	const index = KindOrder.indexOf(kind);
	return index === -1 ? KindOrder.length : index;
}

async function importUnit(tx: DatabaseTransaction, pack: LoadedPack, object: PackObject): Promise<void> {
	const unitId = requireId(pack.ids.units, object.sourceKey);
	const license =
		object.unit.license && isPublicationLicenseId(object.unit.license)
			? (object.unit.license as PublicationLicenseId)
			: null;
	await insertUnit(tx, {
		id: unitId,
		kind: object.unit.kind as UnitKind,
		status: object.unit.status,
		visibility: object.unit.visibility,
		contentRating: object.unit.contentRating,
		aiDisclosure: object.unit.aiDisclosure as "none",
		license,
		moderationStatus: object.unit.moderationStatus,
		postTargetingLocked: object.unit.postTargetingLocked,
		publishedAt: object.unit.status === "published" ? new Date() : null,
		statusActor: { kind: "import" },
	});
	if (object.import.ownershipMode === "community_owned")
		await createPublicEditableUnitAccess(tx, unitId, ["unit.update", "unit.status.update"]);
	else await createProfileOwnedUnitAccess(tx, unitId, ImportOwnerProfileId);

	await insertDetail(tx, pack, object, unitId);
	await tx.insert(unitLocalization).values(
		object.localizations.map((localization, index) => {
			if (!isContentLanguage(localization.language))
				throw new ContentPackInvalid(`${object.sourceKey} has invalid language ${localization.language}`);
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
				kind: alias.kind as (typeof AliasKindValues)[number],
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
			await tx.insert(tag).values({ id: unitId });
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
				kind: object.media.kind,
				releaseStatus: object.media.releaseStatus,
				releaseDate: object.media.releaseDate ?? null,
				episodeCount: object.media.episodeCount ?? null,
				seasonCount: object.media.seasonCount ?? null,
				runtimeMinutes: object.media.runtimeMinutes ?? null,
			});
			return;
		case "collection":
			await tx.insert(collection).values({ id: unitId });
			return;
		case "realm":
			if (!object.realm) throw new ContentPackInvalid(`${object.sourceKey} missing realm`);
			await tx.insert(realm).values({
				id: unitId,
				joinPolicy: object.realm.joinPolicy as (typeof RealmJoinPolicyValues)[number],
				realmTagVotingEnabled: object.realm.realmTagVotingEnabled,
				enabledPages: [...object.realm.enabledPages] as RealmPageKind[],
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
				kind: object.post.kind as "wiki" | "page" | "chapter",
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

async function importRelations(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	_createKeys: ReadonlySet<string>,
): Promise<void> {
	const { relations, ids } = pack;
	if (relations.credits?.length)
		await tx.insert(creditAttribution).values(
			relations.credits.map((item) => ({
				id: ids.credits?.[item.sourceKey],
				sourceUnitId: requireId(ids.units, item.sourceUnitSourceKey),
				creditedUnitId: requireId(ids.units, item.creditedUnitSourceKey),
				role: item.role as CreditAttributionRole,
				position: item.position,
			})),
		);
	if (relations.subjects?.length)
		await tx.insert(subjectAssociation).values(
			relations.subjects.map((item) => ({
				id: ids.subjects?.[item.sourceKey],
				unitId: requireId(ids.units, item.unitSourceKey),
				entityId: requireId(ids.units, item.entitySourceKey),
				role: item.role as SubjectAssociationRole,
				contextPostId: item.contextPostSourceKey
					? requireId(ids.units, item.contextPostSourceKey)
					: null,
				position: item.position,
			})),
		);
	if (relations.seriesReleases?.length)
		await tx.insert(seriesRelease).values(
			relations.seriesReleases.map((item) => ({
				seriesId: requireId(ids.units, item.seriesSourceKey),
				releaseUnitId: requireId(ids.units, item.releaseUnitSourceKey),
				position: item.position,
				releasedOn: item.releasedOn,
			})),
		);
	if (relations.collectionItems?.length)
		await tx.insert(collectionItem).values(
			relations.collectionItems.map((item) => ({
				collectionId: requireId(ids.units, item.collectionSourceKey),
				unitId: requireId(ids.units, item.unitSourceKey),
				position: item.position,
				addedByProfileId: ImportOwnerProfileId,
			})),
		);
	if (relations.unitTags?.length)
		await tx.insert(unitTag).values(
			relations.unitTags.map((item) => ({
				unitId: requireId(ids.units, item.unitSourceKey),
				tagId: requireId(ids.units, item.tagSourceKey),
				pinned: item.pinned,
				position: item.position,
				createdByProfileId: ImportOwnerProfileId,
			})),
		);
	if (relations.realmUnits?.length) {
		const rows = relations.realmUnits.map((item) => ({
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

async function importStructures(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
	for (const structure of pack.structures) {
		const ownerUnitId = requireId(pack.ids.units, structure.ownerUnitSourceKey);
		const structureId = pack.ids.structures?.[structure.sourceKey];
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
			kind: structure.kind as "book.contents" | "page-structure",
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
				target: { kind: "unit" as const, unitId: requireId(pack.ids.units, node.targetUnitSourceKey) },
			};
		}),
	};
}

async function importSlugs(tx: DatabaseTransaction, pack: LoadedPack): Promise<void> {
	for (const object of pack.objects) {
		if (object.unit.kind !== "zone_page" || !object.zonePage) continue;
		await replaceZonePageSlugAddress(tx, {
			zoneId: requireId(pack.ids.units, object.zonePage.zoneSourceKey),
			pageUnitId: requireId(pack.ids.units, object.sourceKey),
			slug: ZoneHomePageSlug,
		});
	}
	for (const slug of pack.relations.slugs ?? []) {
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

function fractionalFromIndex(index: number): string {
	return index === 0 ? "a0" : `a${index.toString(36)}`;
}
