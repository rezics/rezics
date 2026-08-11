import { isDeepStrictEqual } from "node:util";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
	UnitReferencedBlockDocument,
	ZonePageBlockHostPolicy,
	assertUnitReferencedBlockDocument,
	parseDocument,
	walkBlockTree,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { ZoneHomePageSlug } from "@rezics/slug";

import { database, type DatabaseTransaction } from "../database";
import {
	contentStructureNode,
	post,
	unit,
	unitOwnership,
	unitLocalization,
	unitRevisionHead,
	unitSlugAddress,
	zonePage,
} from "../database/schema";
import {
	createContentStructure,
	deleteContentStructureNode,
	getContentStructureRevision,
	insertContentStructureNode,
	listContentStructures,
	updateContentStructureNode,
} from "../content-structure/service";
import { resolveUnitLocalizationFromOrdered } from "../units/localization";
import {
	ContentStructureInvalid,
	ContentStructureRevisionConflict,
} from "../content-structure/errors";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { replaceZonePageSlugAddress } from "../units/slug-address";
import { fractionalPositionBetween } from "../ordering/position";

export interface ZonePageLocalizationInput {
	readonly language: ContentLanguage;
	readonly title: string;
	readonly document: UnitReferencedBlockDocumentValue;
}

export interface ZonePageMutationInput {
	readonly zoneId: string;
	readonly pageId?: string;
	readonly slug?: string | null;
	readonly actorProfileId: string;
	readonly localization: ZonePageLocalizationInput;
	readonly baseUnitRevisionId?: string;
	readonly ensureReferences: (
		tx: DatabaseTransaction,
		document: UnitReferencedBlockDocumentValue,
	) => Promise<void>;
}

export interface ZonePagePlacementMutationInput {
	readonly zoneId: string;
	readonly pageId: string;
	readonly actorProfileId: string;
	readonly parentPageId?: string | null;
	readonly position?: string;
	readonly baseStructureRevisionId?: string;
}

interface StoredZonePageLocalization {
	readonly language: ContentLanguage;
	readonly position: string;
	readonly title: string | null;
	readonly content: unknown;
	readonly contentStatus: "draft" | "published" | "archived" | null;
}

function hasFeedBlock(document: UnitReferencedBlockDocumentValue): boolean {
	let found = false;
	walkBlockTree(document, (block) => {
		if (block._type === "feed") found = true;
	});
	return found;
}

function pagesHaveReachableFeed(pages: readonly ZonePageProjection[]): boolean {
	return pages.some(
		(page) =>
			page.placement !== null &&
			page.localizations.some((localization) => hasFeedBlock(localization.document)),
	);
}

export interface ZonePagePlacementProjection {
	readonly structureId: string;
	readonly nodeId: string;
	readonly parentPageId: string | null;
	readonly position: string;
	readonly latestStructureRevisionId: string;
}

export interface ZonePageStructureProjection {
	readonly id: string;
	readonly latestRevisionId: string;
}

export interface ZonePageProjection {
	readonly id: string;
	readonly zoneId: string;
	readonly slug: string | null;
	readonly home: boolean;
	readonly placement: ZonePagePlacementProjection | null;
	readonly language: ContentLanguage;
	readonly title: string;
	readonly document: UnitReferencedBlockDocumentValue;
	readonly localizations: {
		readonly language: ContentLanguage;
		readonly title: string;
		readonly document: UnitReferencedBlockDocumentValue;
		readonly contentStatus: "draft" | "published" | "archived";
	}[];
	readonly latestUnitRevisionId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface ZonePageAddressProjection {
	readonly id: string;
	readonly zoneId: string;
	readonly slug: string | null;
	readonly redirected: boolean;
}

/**
 * Loads one Page address through the Zone Page primary key and optional canonical-target index.
 * The number of rows examined and returned is bounded independently of the number of Pages in the
 * Zone and of the 500,000,000 / 3,000,000 Unit capacity targets.
 */
export async function getZonePageAddressById(
	tx: DatabaseTransaction,
	zoneId: string,
	pageId: string,
): Promise<ZonePageAddressProjection | null> {
	const [address] = await tx
		.select({
			id: zonePage.id,
			zoneId: zonePage.zoneId,
			slug: unitSlugAddress.slug,
		})
		.from(zonePage)
		.leftJoin(
			unitSlugAddress,
			and(
				eq(unitSlugAddress.kind, "canonical"),
				eq(unitSlugAddress.scopeUnitId, zoneId),
				eq(unitSlugAddress.targetUnitId, zonePage.id),
			),
		)
		.where(and(eq(zonePage.id, pageId), eq(zonePage.zoneId, zoneId)))
		.limit(1);
	return address ? { ...address, redirected: false } : null;
}

/** Resolves one canonical or retained Page label with two bounded indexed address reads. */
export async function resolveZonePageAddressBySlug(
	tx: DatabaseTransaction,
	zoneId: string,
	slug: string,
): Promise<ZonePageAddressProjection | null> {
	const [address] = await tx
		.select({ id: zonePage.id, zoneId: zonePage.zoneId, addressKind: unitSlugAddress.kind })
		.from(unitSlugAddress)
		.innerJoin(
			zonePage,
			and(eq(zonePage.id, unitSlugAddress.targetUnitId), eq(zonePage.zoneId, zoneId)),
		)
		.where(and(eq(unitSlugAddress.scopeUnitId, zoneId), eq(unitSlugAddress.slug, slug)))
		.limit(1);
	if (!address) return null;

	const [canonical] = await tx
		.select({ slug: unitSlugAddress.slug })
		.from(unitSlugAddress)
		.where(
			and(
				eq(unitSlugAddress.kind, "canonical"),
				eq(unitSlugAddress.scopeUnitId, zoneId),
				eq(unitSlugAddress.targetUnitId, address.id),
			),
		)
		.limit(1);
	if (!canonical) return null;
	return {
		id: address.id,
		zoneId: address.zoneId,
		slug: canonical.slug,
		redirected: address.addressKind === "redirect" || canonical.slug !== slug,
	};
}

function parseLocalization(row: StoredZonePageLocalization) {
	if (!row.title || !row.content || !row.contentStatus)
		throw new ContentStructureInvalid("Zone Page Unit localization is incomplete");
	return {
		language: row.language,
		title: row.title,
		document: parseDocument(UnitReferencedBlockDocument, row.content),
		contentStatus: row.contentStatus,
	};
}

/**
 * Lists every Page owned by a Zone.
 *
 * Ownership comes from `zone_page` and is mirrored by a `post(kind = page)`
 * whose subject is the Zone. A slug address and page-structure placement are
 * independent, optional projections.
 */
export async function listZonePageUnits(
	tx: DatabaseTransaction,
	zoneId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<ZonePageProjection[]> {
	const pages = await tx
		.select({
			id: unit.id,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(zonePage)
		.innerJoin(unit, eq(unit.id, zonePage.id))
		.innerJoin(
			post,
			and(
				eq(post.id, zonePage.id),
				eq(post.kind, "page"),
				eq(post.subjectUnitId, zonePage.zoneId),
			),
		)
		.where(and(eq(zonePage.zoneId, zoneId), eq(unit.kind, "zone_page"), isNull(unit.deletedAt)))
		.orderBy(asc(unit.createdAt), asc(unit.id));
	if (!pages.length) return [];

	const pageIds = pages.map((page) => page.id);
	const addresses = await tx
		.select({ targetUnitId: unitSlugAddress.targetUnitId, slug: unitSlugAddress.slug })
		.from(unitSlugAddress)
		.where(
			and(
				eq(unitSlugAddress.kind, "canonical"),
				eq(unitSlugAddress.scopeUnitId, zoneId),
				inArray(unitSlugAddress.targetUnitId, pageIds),
			),
		);
	const localizationRows = await tx
		.select({
			unitId: unitLocalization.unitId,
			language: unitLocalization.language,
			position: unitLocalization.position,
			title: unitLocalization.title,
			content: unitLocalization.content,
			contentStatus: unitLocalization.contentStatus,
		})
		.from(unitLocalization)
		.where(inArray(unitLocalization.unitId, pageIds))
		.orderBy(
			asc(unitLocalization.unitId),
			asc(unitLocalization.position),
			asc(unitLocalization.language),
		);
	const revisionHeads = await tx
		.select({
			unitId: unitRevisionHead.unitId,
			revisionId: unitRevisionHead.revisionId,
		})
		.from(unitRevisionHead)
		.where(inArray(unitRevisionHead.unitId, pageIds));
	const structures = await listContentStructures(tx, zoneId, "page-structure");

	const [structure] = structures;
	const nodes = structure
		? await tx
				.select()
				.from(contentStructureNode)
				.where(
					and(
						eq(contentStructureNode.structureId, structure.id),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id))
		: [];
	const latestStructureRevisionId = structure
		? await getContentStructureRevision(tx, zoneId, structure.id)
		: null;
	if (structure && !latestStructureRevisionId)
		throw new ContentStructureInvalid("Zone page-structure has no history head");

	const addressById = new Map(addresses.map((address) => [address.targetUnitId, address.slug]));
	const revisionById = new Map(revisionHeads.map((head) => [head.unitId, head.revisionId]));
	const nodeByPageId = new Map(nodes.map((node) => [node.contentUnitId, node]));
	const pageIdByNodeId = new Map(nodes.map((node) => [node.id, node.contentUnitId]));

	return pages.map((page) => {
		const slug = addressById.get(page.id) ?? null;
		const latestUnitRevisionId = revisionById.get(page.id);
		const localizations = localizationRows
			.filter((row) => row.unitId === page.id)
			.map(parseLocalization);
		const selected = resolveUnitLocalizationFromOrdered(localizations, localizationLanguages);
		if (!latestUnitRevisionId || !selected)
			throw new ContentStructureInvalid("Zone Page Unit is incomplete");
		const node = nodeByPageId.get(page.id);
		const placement =
			node && structure && latestStructureRevisionId
				? {
						structureId: structure.id,
						nodeId: node.id,
						parentPageId: node.parentId
							? (pageIdByNodeId.get(node.parentId) ?? null)
							: null,
						position: node.position,
						latestStructureRevisionId,
					}
				: null;
		return {
			id: page.id,
			zoneId,
			slug,
			home: slug === ZoneHomePageSlug,
			placement,
			language: selected.language,
			title: selected.title,
			document: selected.document,
			localizations,
			latestUnitRevisionId,
			createdAt: page.createdAt,
			updatedAt: page.updatedAt,
		};
	});
}

export async function getZonePageUnitBySlug(
	tx: DatabaseTransaction,
	zoneId: string,
	slug: string,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<ZonePageProjection | null> {
	const pages = await listZonePageUnits(tx, zoneId, localizationLanguages);
	return pages.find((page) => page.slug === slug) ?? null;
}

export async function getZonePageUnitById(
	tx: DatabaseTransaction,
	zoneId: string,
	pageId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<ZonePageProjection | null> {
	const pages = await listZonePageUnits(tx, zoneId, localizationLanguages);
	return pages.find((page) => page.id === pageId) ?? null;
}

export async function getZonePageStructureProjection(
	tx: DatabaseTransaction,
	zoneId: string,
): Promise<ZonePageStructureProjection | null> {
	const [structure] = await listContentStructures(tx, zoneId, "page-structure");
	if (!structure) return null;
	const latestRevisionId = await getContentStructureRevision(tx, zoneId, structure.id);
	if (!latestRevisionId)
		throw new ContentStructureInvalid("Zone page-structure has no history head");
	return { id: structure.id, latestRevisionId };
}

async function loadOrCreatePageStructure(
	tx: DatabaseTransaction,
	input: { readonly zoneId: string; readonly actorProfileId: string },
) {
	const [existing] = await listContentStructures(tx, input.zoneId, "page-structure");
	if (existing) {
		const revisionId = await getContentStructureRevision(tx, input.zoneId, existing.id);
		if (!revisionId)
			throw new ContentStructureInvalid("Zone page-structure has no history head");
		return { structure: existing, revisionId, created: false as const };
	}
	const created = await createContentStructure(tx, {
		ownerUnitId: input.zoneId,
		kind: "page-structure",
		actorProfileId: input.actorProfileId,
	});
	return { structure: created.structure, revisionId: created.revisionId, created: true as const };
}

async function nodeForPageId(tx: DatabaseTransaction, structureId: string, pageId: string) {
	return (
		await tx
			.select()
			.from(contentStructureNode)
			.where(
				and(
					eq(contentStructureNode.structureId, structureId),
					eq(contentStructureNode.contentUnitId, pageId),
					isNull(contentStructureNode.deletedAt),
				),
			)
			.limit(1)
	)[0];
}

export async function upsertZonePageUnit(input: ZonePageMutationInput) {
	assertUnitReferencedBlockDocument(input.localization.document, ZonePageBlockHostPolicy);
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${input.zoneId}`}::text, 0))`,
		);
		const [identifiedPage] = input.pageId
			? await tx
					.select({ id: zonePage.id })
					.from(zonePage)
					.innerJoin(unit, eq(unit.id, zonePage.id))
					.innerJoin(
						post,
						and(
							eq(post.id, zonePage.id),
							eq(post.kind, "page"),
							eq(post.subjectUnitId, zonePage.zoneId),
						),
					)
					.where(
						and(
							eq(zonePage.id, input.pageId),
							eq(zonePage.zoneId, input.zoneId),
							eq(unit.kind, "zone_page"),
							isNull(unit.deletedAt),
						),
					)
					.limit(1)
			: [];
		if (input.pageId && !identifiedPage)
			throw new ContentStructureInvalid("Zone Page Unit is outside this Zone");

		let pageId = identifiedPage?.id;
		if (!pageId) {
			const created = await insertUnit(tx, {
				kind: "zone_page",
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
				statusActor: { kind: "profile", profileId: input.actorProfileId },
			});
			pageId = created.id;
			await tx.insert(post).values({ id: pageId, subjectUnitId: input.zoneId, kind: "page" });
			await tx.insert(zonePage).values({ id: pageId, zoneId: input.zoneId });
			if (input.slug !== undefined && input.slug !== null)
				await replaceZonePageSlugAddress(tx, {
					zoneId: input.zoneId,
					pageUnitId: pageId,
					slug: input.slug,
				});
			await input.ensureReferences(tx, input.localization.document);
			await tx.insert(unitLocalization).values({
				unitId: pageId,
				language: input.localization.language,
				title: input.localization.title,
				content: input.localization.document,
				contentStatus: "published",
			});
			await tx.insert(unitOwnership).values({
				unitId: pageId,
				profileId: input.actorProfileId,
				assignedByProfileId: input.actorProfileId,
			});
			await recordUnitRevision(tx, {
				unitId: pageId,
				actorProfileId: input.actorProfileId,
				event: "create",
			});
		} else {
			const [currentAddress] = await tx
				.select({ slug: unitSlugAddress.slug })
				.from(unitSlugAddress)
				.where(
					and(
						eq(unitSlugAddress.kind, "canonical"),
						eq(unitSlugAddress.scopeUnitId, input.zoneId),
						eq(unitSlugAddress.targetUnitId, pageId),
					),
				)
				.limit(1);
			const [currentLocalization] = await tx
				.select({
					title: unitLocalization.title,
					content: unitLocalization.content,
					contentStatus: unitLocalization.contentStatus,
				})
				.from(unitLocalization)
				.where(
					and(
						eq(unitLocalization.unitId, pageId),
						eq(unitLocalization.language, input.localization.language),
					),
				)
				.limit(1);
			const slugChanged =
				input.slug !== undefined && (currentAddress?.slug ?? null) !== input.slug;
			const localizationChanged =
				!currentLocalization ||
				currentLocalization.title !== input.localization.title ||
				currentLocalization.contentStatus !== "published" ||
				!isDeepStrictEqual(currentLocalization.content, input.localization.document);
			if (slugChanged || localizationChanged) {
				if (!input.baseUnitRevisionId)
					throw new ContentStructureInvalid(
						"Updating a Zone Page Unit requires a base revision",
					);
				if (slugChanged)
					await replaceZonePageSlugAddress(tx, {
						zoneId: input.zoneId,
						pageUnitId: pageId,
						slug: input.slug ?? null,
					});
				if (localizationChanged) {
					await input.ensureReferences(tx, input.localization.document);
					const [lastLocalization] = await tx
						.select({ position: unitLocalization.position })
						.from(unitLocalization)
						.where(eq(unitLocalization.unitId, pageId))
						.orderBy(desc(unitLocalization.position), desc(unitLocalization.language))
						.limit(1);
					await tx
						.insert(unitLocalization)
						.values({
							unitId: pageId,
							language: input.localization.language,
							position: fractionalPositionBetween(
								lastLocalization?.position ?? null,
								null,
							),
							title: input.localization.title,
							content: input.localization.document,
							contentStatus: "published",
						})
						.onConflictDoUpdate({
							target: [unitLocalization.unitId, unitLocalization.language],
							set: {
								title: input.localization.title,
								content: input.localization.document,
								contentStatus: "published",
								updatedAt: new Date(),
							},
						});
				}
				await recordUnitRevision(tx, {
					unitId: pageId,
					actorProfileId: input.actorProfileId,
					event: "update",
					baseRevisionId: input.baseUnitRevisionId,
				});
			}
		}

		const zonePages = await listZonePageUnits(tx, input.zoneId);
		if (!pagesHaveReachableFeed(zonePages))
			throw new ContentStructureInvalid("Every Zone requires at least one Feed Page");
		const saved = await getZonePageUnitById(tx, input.zoneId, pageId, [
			input.localization.language,
		]);
		if (!saved) throw new Error("Zone Page Unit upsert did not produce a projection");
		return saved;
	});
}

export async function upsertZonePagePlacement(input: ZonePagePlacementMutationInput) {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${input.zoneId}`}::text, 0))`,
		);
		const page = await getZonePageUnitById(tx, input.zoneId, input.pageId);
		if (!page) throw new ContentStructureInvalid("Zone Page Unit is outside this Zone");
		const structure = await loadOrCreatePageStructure(tx, input);
		let node = await nodeForPageId(tx, structure.structure.id, input.pageId);
		const requireStructureBase = () => {
			if (
				input.baseStructureRevisionId === undefined
					? !structure.created
					: input.baseStructureRevisionId !== structure.revisionId
			)
				throw new ContentStructureRevisionConflict(structure.revisionId);
			return structure.revisionId;
		};
		const parentNode =
			typeof input.parentPageId === "string"
				? await nodeForPageId(tx, structure.structure.id, input.parentPageId)
				: undefined;
		if (input.parentPageId && !parentNode)
			throw new ContentStructureInvalid("Parent Page is not indexed by page-structure");

		let revisionId = structure.revisionId;
		if (!node) {
			revisionId = structure.created ? structure.revisionId : requireStructureBase();
			const inserted = await insertContentStructureNode(tx, {
				ownerUnitId: input.zoneId,
				structureId: structure.structure.id,
				baseRevisionId: revisionId,
				actorProfileId: input.actorProfileId,
				contentUnitId: input.pageId,
				parentId: parentNode?.id ?? null,
				position: input.position,
			});
			node = inserted.node;
			revisionId = inserted.revisionId;
		} else {
			const parentId =
				input.parentPageId === undefined ? node.parentId : (parentNode?.id ?? null);
			const changed =
				parentId !== node.parentId ||
				(input.position !== undefined && input.position !== node.position);
			if (changed) {
				revisionId = requireStructureBase();
				const updated = await updateContentStructureNode(tx, {
					ownerUnitId: input.zoneId,
					structureId: structure.structure.id,
					nodeId: node.id,
					baseRevisionId: revisionId,
					actorProfileId: input.actorProfileId,
					parentId,
					position: input.position,
				});
				node = updated.node;
				revisionId = updated.revisionId;
			}
		}

		const saved = await getZonePageUnitById(tx, input.zoneId, input.pageId);
		if (!saved?.placement)
			throw new Error("Zone Page placement mutation did not produce a placement");
		return {
			...saved,
			placement: { ...saved.placement, latestStructureRevisionId: revisionId },
		};
	});
}

export async function deleteZonePagePlacement(input: {
	readonly zoneId: string;
	readonly pageId: string;
	readonly actorProfileId: string;
	readonly baseStructureRevisionId: string;
}) {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${input.zoneId}`}::text, 0))`,
		);
		const [structure] = await listContentStructures(tx, input.zoneId, "page-structure");
		if (!structure) return;
		const node = await nodeForPageId(tx, structure.id, input.pageId);
		if (!node) return;
		const [child] = await tx
			.select({ id: contentStructureNode.id })
			.from(contentStructureNode)
			.where(
				and(
					eq(contentStructureNode.structureId, structure.id),
					eq(contentStructureNode.parentId, node.id),
					isNull(contentStructureNode.deletedAt),
				),
			)
			.limit(1);
		if (child) throw new ContentStructureInvalid("Move child Pages before removing this index");
		const remainingReachablePages = (await listZonePageUnits(tx, input.zoneId)).filter(
			(page) => page.id !== input.pageId,
		);
		if (!pagesHaveReachableFeed(remainingReachablePages))
			throw new ContentStructureInvalid("Every Zone requires at least one Feed Page");
		await deleteContentStructureNode(tx, {
			ownerUnitId: input.zoneId,
			structureId: structure.id,
			nodeId: node.id,
			baseRevisionId: input.baseStructureRevisionId,
			actorProfileId: input.actorProfileId,
		});
	});
}
