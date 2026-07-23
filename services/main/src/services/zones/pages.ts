import { isDeepStrictEqual } from "node:util";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
	UnitReferencedBlockDocument,
	ZonePageBlockHostPolicy,
	assertUnitReferencedBlockDocument,
	parseDocument,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import { database, type DatabaseTransaction } from "../database";
import {
	contentStructureNode,
	unit,
	unitAccessBinding,
	unitLocalization,
	unitRevisionHead,
	unitSlugAddress,
} from "../database/schema";
import {
	createContentStructure,
	deleteContentStructureNode,
	getContentStructureRevision,
	insertContentStructureNode,
	listContentStructures,
	rerootZonePagesContentStructure,
	updateContentStructureNode,
} from "../content-structure/service";
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
	readonly slug: string;
	readonly pageId?: string;
	readonly actorProfileId: string;
	readonly localization: ZonePageLocalizationInput;
	readonly parentPageId?: string | null;
	readonly position?: string;
	readonly home: boolean;
	readonly baseStructureRevisionId?: string;
	readonly baseUnitRevisionId?: string;
	readonly ensureReferences: (
		tx: DatabaseTransaction,
		document: UnitReferencedBlockDocumentValue,
	) => Promise<void>;
}

interface StoredZonePageLocalization {
	readonly language: ContentLanguage;
	readonly position: string;
	readonly title: string | null;
	readonly content: unknown;
	readonly contentStatus: "draft" | "published" | "archived" | null;
}

export interface ZonePageProjection {
	readonly id: string;
	readonly zoneId: string;
	readonly slug: string;
	readonly structureId: string;
	readonly nodeId: string;
	readonly parentPageId: string | null;
	readonly position: string;
	readonly home: boolean;
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
	readonly latestStructureRevisionId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
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

export async function listZonePageUnits(
	tx: DatabaseTransaction,
	zoneId: string,
	preferredLanguage?: ContentLanguage,
): Promise<ZonePageProjection[]> {
	const [structure] = await listContentStructures(tx, zoneId, "zone.pages");
	if (!structure) return [];
	const nodes = await tx
		.select()
		.from(contentStructureNode)
		.where(
			and(
				eq(contentStructureNode.structureId, structure.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
	if (!nodes.length) return [];
	const pageIds = nodes.map((node) => node.contentUnitId);
	const [latestStructureRevisionId, pages, localizationRows, revisionHeads, addresses] =
		await Promise.all([
			getContentStructureRevision(tx, zoneId, structure.id),
			tx
				.select({ id: unit.id, createdAt: unit.createdAt, updatedAt: unit.updatedAt })
				.from(unit)
				.where(
					and(
						inArray(unit.id, pageIds),
						eq(unit.kind, "zone_page"),
						isNull(unit.deletedAt),
					),
				),
			tx
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
				),
			tx
				.select({
					unitId: unitRevisionHead.unitId,
					revisionId: unitRevisionHead.revisionId,
				})
				.from(unitRevisionHead)
				.where(inArray(unitRevisionHead.unitId, pageIds)),
			tx
				.select({ targetUnitId: unitSlugAddress.targetUnitId, slug: unitSlugAddress.slug })
				.from(unitSlugAddress)
				.where(
					and(
						eq(unitSlugAddress.kind, "canonical"),
						eq(unitSlugAddress.scopeUnitId, zoneId),
						inArray(unitSlugAddress.targetUnitId, pageIds),
					),
				),
		]);
	if (!latestStructureRevisionId)
		throw new ContentStructureInvalid("Zone pages tree has no history head");
	const pageById = new Map(pages.map((page) => [page.id, page]));
	const revisionById = new Map(revisionHeads.map((head) => [head.unitId, head.revisionId]));
	const slugById = new Map(addresses.map((address) => [address.targetUnitId, address.slug]));
	return nodes.map((node) => {
		const page = pageById.get(node.contentUnitId);
		const slug = slugById.get(node.contentUnitId);
		const latestUnitRevisionId = revisionById.get(node.contentUnitId);
		const localizations = localizationRows
			.filter((row) => row.unitId === node.contentUnitId)
			.map(parseLocalization);
		const selected =
			(preferredLanguage
				? localizations.find((localization) => localization.language === preferredLanguage)
				: undefined) ?? localizations[0];
		if (!page || !slug || !latestUnitRevisionId || !selected)
			throw new ContentStructureInvalid("Zone pages tree references an incomplete Page Unit");
		return {
			id: page.id,
			zoneId,
			slug,
			structureId: structure.id,
			nodeId: node.id,
			parentPageId: node.parentId
				? (nodes.find((candidate) => candidate.id === node.parentId)?.contentUnitId ?? null)
				: null,
			position: node.position,
			home: node.parentId === null,
			language: selected.language,
			title: selected.title,
			document: selected.document,
			localizations,
			latestUnitRevisionId,
			latestStructureRevisionId,
			createdAt: page.createdAt,
			updatedAt: page.updatedAt,
		};
	});
}

export async function getZonePageUnitBySlug(
	tx: DatabaseTransaction,
	zoneId: string,
	slug: string | undefined,
	preferredLanguage?: ContentLanguage,
): Promise<ZonePageProjection | null> {
	const pages = await listZonePageUnits(tx, zoneId, preferredLanguage);
	return slug
		? (pages.find((page) => page.slug === slug) ?? null)
		: (pages.find((page) => page.home) ?? null);
}

async function loadOrCreatePagesStructure(
	tx: DatabaseTransaction,
	input: { readonly zoneId: string; readonly actorProfileId: string },
) {
	const [existing] = await listContentStructures(tx, input.zoneId, "zone.pages");
	if (existing) {
		const revisionId = await getContentStructureRevision(tx, input.zoneId, existing.id);
		if (!revisionId) throw new ContentStructureInvalid("Zone pages tree has no history head");
		return { structure: existing, revisionId, created: false as const };
	}
	const created = await createContentStructure(tx, {
		ownerUnitId: input.zoneId,
		kind: "zone.pages",
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
		const tree = await loadOrCreatePagesStructure(tx, input);
		const [address] = await tx
			.select({ pageId: unitSlugAddress.targetUnitId })
			.from(unitSlugAddress)
			.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
			.where(
				and(
					eq(unitSlugAddress.kind, "canonical"),
					eq(unitSlugAddress.scopeUnitId, input.zoneId),
					eq(unitSlugAddress.slug, input.slug),
					eq(unit.kind, "zone_page"),
					isNull(unit.deletedAt),
				),
			)
			.limit(1);
		if (input.pageId && address && address.pageId !== input.pageId)
			throw new ContentStructureInvalid("Zone Page slug is already in use");
		const [identifiedPage] = input.pageId
			? await tx
					.select({ id: unit.id })
					.from(unit)
					.where(
						and(
							eq(unit.id, input.pageId),
							eq(unit.kind, "zone_page"),
							isNull(unit.deletedAt),
						),
					)
					.limit(1)
			: [];
		if (input.pageId && !identifiedPage)
			throw new ContentStructureInvalid("Zone Page Unit does not exist");
		let pageId = input.pageId ?? address?.pageId;
		let node = pageId ? await nodeForPageId(tx, tree.structure.id, pageId) : undefined;
		if (input.pageId && !node)
			throw new ContentStructureInvalid("Zone Page Unit is outside this Zone");
		let revisionId = tree.revisionId;

		if (!pageId) {
			const created = await insertUnit(tx, {
				kind: "zone_page",
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
				statusActor: { kind: "profile", profileId: input.actorProfileId },
			});
			pageId = created.id;
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
			await tx.insert(unitAccessBinding).values({
				unitId: pageId,
				subjectKind: "profile",
				profileId: input.actorProfileId,
				role: "owner",
				scope: [],
				grantedByProfileId: input.actorProfileId,
			});
			await recordUnitRevision(tx, {
				unitId: pageId,
				actorProfileId: input.actorProfileId,
				event: "create",
			});
		} else {
			const [[currentAddress], [currentLocalization]] = await Promise.all([
				tx
					.select({ slug: unitSlugAddress.slug })
					.from(unitSlugAddress)
					.where(
						and(
							eq(unitSlugAddress.kind, "canonical"),
							eq(unitSlugAddress.scopeUnitId, input.zoneId),
							eq(unitSlugAddress.targetUnitId, pageId),
						),
					)
					.limit(1),
				tx
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
					.limit(1),
			]);
			const slugChanged = currentAddress?.slug !== input.slug;
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
						slug: input.slug,
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

		const activeNodes = await tx
			.select()
			.from(contentStructureNode)
			.where(
				and(
					eq(contentStructureNode.structureId, tree.structure.id),
					isNull(contentStructureNode.deletedAt),
				),
			);
		const currentRoot = activeNodes.find((candidate) => candidate.parentId === null);
		if (!currentRoot && activeNodes.length)
			throw new ContentStructureInvalid("Zone pages tree has no root page");
		if (!currentRoot && !node && !input.home)
			throw new ContentStructureInvalid("The first Zone Page must be the home page");
		const requireStructureBase = () => {
			if (
				input.baseStructureRevisionId === undefined
					? activeNodes.length > 0
					: input.baseStructureRevisionId !== tree.revisionId
			)
				throw new ContentStructureRevisionConflict(tree.revisionId);
			return tree.revisionId;
		};
		const parentNode =
			input.parentPageId === undefined || input.parentPageId === null
				? undefined
				: activeNodes.find((candidate) => candidate.contentUnitId === input.parentPageId);
		if (input.parentPageId && !parentNode)
			throw new ContentStructureInvalid("Zone Page parent does not exist");
		if (!node) {
			revisionId = requireStructureBase();
			const parentId = currentRoot
				? input.home
					? currentRoot.id
					: (parentNode?.id ?? currentRoot.id)
				: null;
			const inserted = await insertContentStructureNode(tx, {
				ownerUnitId: input.zoneId,
				structureId: tree.structure.id,
				baseRevisionId: revisionId,
				actorProfileId: input.actorProfileId,
				contentUnitId: pageId,
				parentId,
				position: input.position,
			});
			node = inserted.node;
			revisionId = inserted.revisionId;
			if (input.home && currentRoot) {
				const moved = await rerootZonePagesContentStructure(tx, {
					ownerUnitId: input.zoneId,
					structureId: tree.structure.id,
					nodeId: node.id,
					baseRevisionId: revisionId,
					actorProfileId: input.actorProfileId,
					position: input.position,
				});
				revisionId = moved.revisionId;
			}
		} else if (input.home && node.parentId !== null) {
			revisionId = requireStructureBase();
			const promoted = await rerootZonePagesContentStructure(tx, {
				ownerUnitId: input.zoneId,
				structureId: tree.structure.id,
				nodeId: node.id,
				baseRevisionId: revisionId,
				actorProfileId: input.actorProfileId,
				position: input.position,
			});
			revisionId = promoted.revisionId;
		} else {
			if (!input.home && node.parentId === null && !parentNode)
				throw new ContentStructureInvalid("A non-home Zone Page requires a parent");
			const parentId = input.home ? null : (parentNode?.id ?? node.parentId);
			const structureChanged =
				parentId !== node.parentId ||
				(input.position !== undefined && input.position !== node.position);
			if (structureChanged) {
				revisionId = requireStructureBase();
				const updated = await updateContentStructureNode(tx, {
					ownerUnitId: input.zoneId,
					structureId: tree.structure.id,
					nodeId: node.id,
					baseRevisionId: revisionId,
					actorProfileId: input.actorProfileId,
					parentId,
					position: input.position,
				});
				revisionId = updated.revisionId;
			}
		}

		const pages = await listZonePageUnits(tx, input.zoneId, input.localization.language);
		const saved = pages.find((page) => page.id === pageId);
		if (!saved) throw new Error("Zone Page Unit upsert did not produce a projection");
		return { ...saved, latestStructureRevisionId: revisionId };
	});
}

export async function deleteZonePageUnit(input: {
	readonly zoneId: string;
	readonly pageId: string;
	readonly actorProfileId: string;
	readonly baseStructureRevisionId: string;
	readonly ensureNotReferenced?: (tx: DatabaseTransaction) => Promise<void>;
}) {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${input.zoneId}`}::text, 0))`,
		);
		const [structure] = await listContentStructures(tx, input.zoneId, "zone.pages");
		if (!structure) throw new ContentStructureInvalid("Zone pages tree does not exist");
		const node = await nodeForPageId(tx, structure.id, input.pageId);
		if (!node) throw new ContentStructureInvalid("Zone Page Unit is outside this Zone");
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
		if (child) throw new ContentStructureInvalid("Move child pages before deleting this page");
		await input.ensureNotReferenced?.(tx);
		await deleteContentStructureNode(tx, {
			ownerUnitId: input.zoneId,
			structureId: structure.id,
			nodeId: node.id,
			baseRevisionId: input.baseStructureRevisionId,
			actorProfileId: input.actorProfileId,
		});
		await tx.update(unit).set({ deletedAt: new Date() }).where(eq(unit.id, input.pageId));
		await recordUnitRevision(tx, {
			unitId: input.pageId,
			actorProfileId: input.actorProfileId,
			event: "delete",
		});
	});
}
