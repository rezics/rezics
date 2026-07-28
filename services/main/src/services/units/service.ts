import { DevelopmentPreviewCapability } from "@rezics/access";
import { and, desc, eq, exists, isNull, lt, not, or, sql } from "drizzle-orm";
import type { AvatarReference } from "@rezics/avatar";
import {
	PortableTextDocument,
	parseNullableDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import type { Static } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";
import { parseNullablePublicationLicenseId, type PublicationLicenseId } from "@rezics/license";

import type { Authorization } from "../authorization";
import { createCommunityCatalogAccess } from "../authorization/unit/ownership";
import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import { ContentStructureSnapshotSchema } from "../content-structure/contracts";
import { createContentStructureHistory } from "../content-structure/history";
import {
	avatarReferenceFromColumns,
	avatarReferenceToColumns,
	removeUnitLocalization,
	reorderUnitLocalizations,
	resolveUnitLocalizationFromOrdered,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "./localization";
import {
	book,
	catalogUnitContentLicense,
	contentStructure,
	entity,
	software,
	media,
	series,
	unit,
	subjectAssociation,
	unitLink,
	unitLocalization,
	unitProgress,
	unitTag,
	unitTagVoteStat,
	unitVariant,
} from "../database/schema";
import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";
import { ensureImageAssetsAttachable, imageAssetContentUrl } from "../api/image-assets/service";
import { UnitDetailResponse } from "../api/schema/response";
import { UnitChanged, UnitNotFound } from "./errors";
import { recordUnitRevision } from "./history";
import { insertUnit } from "./create";
import { transitionUnitStatus } from "./status";
import {
	getAttributionSummariesByUnitIds,
	getAttributionSummariesWithStatisticsByUnitIds,
} from "./attribution";
import { getUnitVariantContext } from "./variants";
import { ensureUnitVariantLifecycle } from "./variant-policy";
import { presentAvatar } from "./avatar";
import { listPublishedBookContentMetrics } from "../content-metrics/service";
import { getAssociationContextPostsByAssociationIds } from "./association-context";

export type VariantUnitKind = "book" | "software" | "media";
export type CatalogUnitKind = VariantUnitKind | "series";
export type UnitDetail = Static<typeof UnitDetailResponse>;
type StoredUnitLocalization = typeof unitLocalization.$inferSelect;

export interface CreateUnitInput {
	localization: {
		language: ContentLanguage;
		title: string;
		summary?: string;
		description?: PortableTextDocumentValue;
		avatar?: AvatarReference | null;
		bannerAssetId?: string | null;
		coverAssetId?: string | null;
	};
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: PublicationLicenseId | null;
}

export interface UpdateUnitInput {
	updatedAt: string;
	status?: "draft" | "published" | "archived";
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: PublicationLicenseId | null;
	unit?: {
		releasedOn?: string | null;
	};
	details?: {
		isbn13?: string | null;
		publicationDate?: string | null;
		pageCount?: number | null;
		wordCount?: number | null;
		format?: string | null;
		licensed?: boolean;
		versionLabel?: string | null;
		kind?: string;
		runtimeMinutes?: number | null;
		episodeCount?: number | null;
		seasonCount?: number | null;
	};
}

export function presentImageAsset(assetId: string | null, role?: "avatar" | "banner" | "cover") {
	return assetId
		? {
				id: assetId,
				url: role
					? imageAssetPresentationContentUrl(assetId, role)
					: imageAssetContentUrl(assetId),
			}
		: null;
}

export function presentUnitLocalization({
	content: _content,
	contentStatus: _status,
	description,
	avatarType,
	avatarAssetId,
	avatarEmoji,
	avatarIconPrefix,
	avatarIconName,
	bannerAssetId,
	coverAssetId,
	...row
}: StoredUnitLocalization) {
	return {
		...row,
		description: parseNullableDocument(PortableTextDocument, description),
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
	};
}

export async function createUnit(
	kind: VariantUnitKind,
	authorization: Authorization<string>,
	input: CreateUnitInput,
): Promise<UnitDetail> {
	const ownerId = authorization.profileId;
	const unitId = await database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			ownerId,
			unitLocalizationImageAssetReferences(input.localization),
		);
		const created = await insertUnit(tx, {
			kind,
			visibility: input.visibility ?? "public",
			contentRating: input.contentRating ?? "general",
			aiDisclosure: input.aiDisclosure ?? "unknown",
			license: input.license,
			statusActor: { kind: "profile", profileId: ownerId },
		});
		let bookStructure: typeof contentStructure.$inferSelect | undefined;
		if (kind === "book") {
			await tx.insert(book).values({ id: created.id });
			[bookStructure] = await tx
				.insert(contentStructure)
				.values({ ownerUnitId: created.id, kind: "book.contents" })
				.returning();
			if (!bookStructure) throw new Error("Book Content Structure insertion returned no row");
		}
		if (kind === "software") await tx.insert(software).values({ id: created.id });
		if (kind === "media") await tx.insert(media).values({ id: created.id, kind: "other" });
		await tx.insert(unitLocalization).values({
			unitId: created.id,
			...toUnitLocalizationStorage(input.localization),
		});
		await createCommunityCatalogAccess(tx, created.id, ownerId, [
			"unit.update",
			"unit.status.update",
		]);
		const bookStructureSnapshot = bookStructure
			? ContentStructureSnapshotSchema.parse({
					version: 1,
					structure: bookStructure,
					nodes: [],
				})
			: null;
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: ownerId,
			event: "create",
		});
		if (bookStructureSnapshot)
			await createContentStructureHistory(tx, {
				structureId: bookStructureSnapshot.structure.id,
				actorProfileId: ownerId,
				state: bookStructureSnapshot,
			});
		return created.id;
	});
	return getUnit(kind, unitId, authorization);
}

async function getUnitDetails(
	kind: CatalogUnitKind,
	unitId: string,
): Promise<UnitDetail["details"]> {
	const contentLicensed =
		kind !== "series" &&
		(
			await database
				.select({ unitId: catalogUnitContentLicense.unitId })
				.from(catalogUnitContentLicense)
				.where(eq(catalogUnitContentLicense.unitId, unitId))
				.limit(1)
		)[0] !== undefined;
	if (kind === "book") {
		const [details] = await database.select().from(book).where(eq(book.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "book",
			isbn13: details.isbn13,
			publicationDate: details.publicationDate,
			pageCount: details.pageCount,
			wordCount: details.wordCount,
			publishedContentMetrics: await listPublishedBookContentMetrics(database, unitId),
			format: details.format,
			licensed: contentLicensed,
		};
	}
	if (kind === "software") {
		const [details] = await database
			.select()
			.from(software)
			.where(eq(software.id, unitId))
			.limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "software",
			releaseDate: details.releaseDate,
			versionLabel: details.versionLabel,
			licensed: contentLicensed,
		};
	}
	if (kind === "media") {
		const [details] = await database.select().from(media).where(eq(media.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "media",
			releaseDate: details.releaseDate,
			kind: details.kind,
			runtimeMinutes: details.runtimeMinutes,
			episodeCount: details.episodeCount,
			seasonCount: details.seasonCount,
			licensed: contentLicensed,
		};
	}
	const [details] = await database.select().from(series).where(eq(series.id, unitId)).limit(1);
	if (!details) throw new UnitNotFound(kind);
	return { type: "series", kind: details.kind };
}

export async function getUnit(
	kind: CatalogUnitKind,
	unitId: string,
	authorization: Authorization,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<UnitDetail> {
	const [base] = await database
		.select()
		.from(unit)
		.where(and(eq(unit.id, unitId), eq(unit.kind, kind), isNull(unit.deletedAt)))
		.limit(1);
	if (!base) throw new UnitNotFound(kind);
	await authorization.unit.ensureCanRead(base.id, () => new UnitNotFound(kind));

	const localizations = await database
		.select()
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, base.id))
		.orderBy(unitLocalization.position, unitLocalization.language);
	const resolvedLocalization = resolveUnitLocalizationFromOrdered(
		localizations,
		localizationLanguages,
	);
	if (!resolvedLocalization) throw new UnitNotFound();
	const selectedLocalization = resolvedLocalization;
	const attributions =
		(
			await getAttributionSummariesWithStatisticsByUnitIds([base.id], localizationLanguages)
		).get(base.id) ?? [];
	const subjectAssociationRows = await database
		.select({
			id: subjectAssociation.id,
			entityEntryId: subjectAssociation.entityId,
			role: subjectAssociation.role,
			position: subjectAssociation.position,
			title: resolvedUnitLocalizationTitle(
				subjectAssociation.entityId,
				localizationLanguages,
			),
		})
		.from(subjectAssociation)
		.innerJoin(entity, eq(entity.id, subjectAssociation.entityId))
		.where(eq(subjectAssociation.unitId, base.id))
		.orderBy(subjectAssociation.position, subjectAssociation.id);
	const contextPosts = await getAssociationContextPostsByAssociationIds(
		subjectAssociationRows.map(({ id }) => id),
		localizationLanguages,
		authorization.profileId,
	);
	const subjectAssociations = subjectAssociationRows.map((association) => ({
		...association,
		contextPost: contextPosts.get(association.id) ?? null,
	}));
	const links = await database
		.select()
		.from(unitLink)
		.where(eq(unitLink.unitId, base.id))
		.orderBy(unitLink.position, unitLink.id);
	const tags = await database
		.select({
			tagId: unitTag.tagId,
			score: unitTagVoteStat.score,
			voteCount: unitTagVoteStat.voteCount,
			pinned: unitTag.pinned,
			position: unitTag.position,
			title: resolvedUnitLocalizationTitle(unitTag.tagId, localizationLanguages),
		})
		.from(unitTag)
		.leftJoin(
			unitTagVoteStat,
			and(
				eq(unitTagVoteStat.unitId, unitTag.unitId),
				eq(unitTagVoteStat.tagId, unitTag.tagId),
			),
		)
		.where(eq(unitTag.unitId, base.id))
		.orderBy(desc(unitTag.pinned), unitTag.position, unitTag.tagId);
	const [progressCounts] = await database
		.select({
			active: sql<unknown>`count(*) filter (where ${unitProgress.status} = 'active')`,
			backlog: sql<unknown>`count(*) filter (where ${unitProgress.status} = 'backlog')`,
		})
		.from(unitProgress)
		.where(and(eq(unitProgress.unitId, base.id), isNull(unitProgress.deletedAt)));
	const variantContext: UnitDetail["variantContext"] =
		kind === "series"
			? { role: "standalone" }
			: await getUnitVariantContext(base.id, authorization.profileId);
	const [canEdit, accessDecision, associationDecision, hasDevelopmentPreviewAccess] =
		await Promise.all([
			authorization.unit.canUpdate(base.id),
			authorization.unit.decide(base.id, "unit.access.manage"),
			authorization.unit.decide(base.id, "unit.association.manage"),
			authorization.platform.hasCapability(DevelopmentPreviewCapability),
		]);
	const details = await getUnitDetails(kind, base.id);
	return {
		id: base.id,
		type: kind,
		status: base.status,
		visibility: base.visibility,
		language: selectedLocalization.language,
		contentRating: base.contentRating,
		aiDisclosure: base.aiDisclosure,
		license: parseNullablePublicationLicenseId(base.license),
		postTargetingLocked: base.postTargetingLocked,
		publishedAt: base.publishedAt,
		attributions,
		createdAt: base.createdAt,
		updatedAt: base.updatedAt,
		releasedOn:
			details.type === "book"
				? details.publicationDate
				: details.type === "software" || details.type === "media"
					? details.releaseDate
					: null,
		details,
		avatar: presentAvatar(
			avatarReferenceFromColumns({
				avatarType: selectedLocalization.avatarType,
				avatarAssetId: selectedLocalization.avatarAssetId,
				avatarEmoji: selectedLocalization.avatarEmoji,
				avatarIconPrefix: selectedLocalization.avatarIconPrefix,
				avatarIconName: selectedLocalization.avatarIconName,
			}),
		),
		banner: presentImageAsset(selectedLocalization.bannerAssetId, "banner"),
		cover: presentImageAsset(selectedLocalization.coverAssetId, "cover"),
		localizations: localizations.map(presentUnitLocalization),
		subjectAssociations,
		links: links.map((link) => ({
			...link,
			kind: link.role,
			sourceEntityEntryId: link.sourceEntityId,
		})),
		tags: tags.map((tag) => ({
			...tag,
			id: tag.tagId,
			realmId: null,
			score: toSafeInteger(tag.score ?? 0n, "tag vote score"),
			voteCount: toSafeInteger(tag.voteCount ?? 0n, "tag vote count"),
		})),
		progressStatistics: {
			active: toSafeInteger(progressCounts?.active ?? 0, "active progress count"),
			backlog: toSafeInteger(progressCounts?.backlog ?? 0, "backlog progress count"),
		},
		versions:
			kind === "series"
				? []
				: variantContext.role === "standalone"
					? [{ id: base.id, kind: "primary", canonicalUnitId: null }]
					: variantContext.role === "main"
						? [
								{ id: base.id, kind: "primary", canonicalUnitId: null },
								...variantContext.variants.map(({ id }) => ({
									id,
									kind: "version",
									canonicalUnitId: base.id,
								})),
							]
						: variantContext.main.state === "available"
							? [
									{
										id: base.id,
										kind: "version",
										canonicalUnitId: variantContext.main.unit.id,
									},
								]
							: [],
		variantContext,
		capabilities: {
			canEdit,
			canManageAccess: accessDecision.allowed,
			canManageAssociations: associationDecision.allowed,
			hasDevelopmentPreviewAccess,
		},
	};
}

export async function listUnits(
	kind: CatalogUnitKind,
	cursor?: [string, string],
	limit = 20,
	localizationLanguages: readonly ContentLanguage[] = [],
) {
	const rows = await database
		.select({
			id: unit.id,
			language: unitLocalization.language,
			contentRating: unit.contentRating,
			publishedAt: unit.publishedAt,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
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
		.from(unit)
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
		.where(
			and(
				eq(unit.kind, kind),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				not(
					exists(
						database
							.select({ id: unitVariant.variantUnitId })
							.from(unitVariant)
							.where(eq(unitVariant.variantUnitId, unit.id)),
					),
				),
				cursor
					? or(
							lt(unit.createdAt, new Date(cursor[0])),
							and(eq(unit.createdAt, new Date(cursor[0])), lt(unit.id, cursor[1])),
						)
					: undefined,
			),
		)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(limit + 1);
	const attributions = await getAttributionSummariesByUnitIds(
		rows.map(({ id }) => id),
		localizationLanguages,
	);
	return Promise.all(
		rows.map(
			async ({
				avatarType,
				avatarAssetId,
				avatarEmoji,
				avatarIconPrefix,
				avatarIconName,
				bannerAssetId,
				coverAssetId,
				...row
			}) => ({
				...row,
				attributions: attributions.get(row.id) ?? [],
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
	);
}

export async function updateUnit(
	kind: CatalogUnitKind,
	unitId: string,
	authorization: Authorization<string>,
	body: UpdateUnitInput,
): Promise<UnitDetail> {
	await authorization.unit.ensureCanUpdate(unitId, [["unit"], [kind]]);
	const statusUpdateDecision = body.status
		? await authorization.unit.decide(unitId, "unit.status.update", ["unit"])
		: undefined;
	await database.transaction(async (tx) => {
		const [updated] = await tx
			.update(unit)
			.set({
				visibility: body.visibility,
				contentRating: body.contentRating,
				aiDisclosure: body.aiDisclosure,
				...(Object.hasOwn(body, "license") ? { license: body.license } : {}),
			})
			.where(
				and(
					eq(unit.id, unitId),
					eq(unit.kind, kind),
					eq(unit.updatedAt, new Date(body.updatedAt)),
				),
			)
			.returning({ id: unit.id, status: unit.status });
		if (!updated) {
			const [current] = await tx
				.select({ updatedAt: unit.updatedAt })
				.from(unit)
				.where(eq(unit.id, unitId))
				.limit(1);
			if (!current) throw new UnitNotFound(kind);
			throw new UnitChanged(current.updatedAt);
		}
		const details = body.details ?? {};
		const common = body.unit ?? {};
		const releasedOn =
			common.releasedOn === undefined
				? undefined
				: common.releasedOn === null
					? null
					: common.releasedOn;
		if (kind === "book")
			await tx
				.update(book)
				.set({
					isbn13: details.isbn13,
					publicationDate:
						details.publicationDate === undefined
							? releasedOn
							: details.publicationDate,
					pageCount: details.pageCount,
					wordCount: details.wordCount,
					format: details.format,
				})
				.where(eq(book.id, unitId));
		if (kind === "software")
			await tx
				.update(software)
				.set({
					releaseDate: releasedOn,
					versionLabel: details.versionLabel,
				})
				.where(eq(software.id, unitId));
		if (kind === "media")
			await tx
				.update(media)
				.set({
					releaseDate: releasedOn,
					kind: details.kind,
					runtimeMinutes: details.runtimeMinutes,
					episodeCount: details.episodeCount,
					seasonCount: details.seasonCount,
				})
				.where(eq(media.id, unitId));
		if (kind !== "series" && details.licensed !== undefined) {
			if (details.licensed)
				await tx
					.insert(catalogUnitContentLicense)
					.values({ unitId, unitKind: kind })
					.onConflictDoNothing();
			else
				await tx
					.delete(catalogUnitContentLicense)
					.where(eq(catalogUnitContentLicense.unitId, unitId));
		}
		if (kind === "series" && details.kind !== undefined)
			await tx.update(series).set({ kind: details.kind }).where(eq(series.id, unitId));
		const revision = await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
		if (body.status) {
			await transitionUnitStatus(tx, {
				unitId,
				toStatus: body.status,
				actor: { kind: "profile", profileId: authorization.profileId },
				authorization: {
					kind: "interactive",
					statusUpdateAllowed: statusUpdateDecision?.allowed ?? false,
				},
				revisionId: revision.revisionId,
			});
		}
		if (kind !== "series") await ensureUnitVariantLifecycle(tx, unitId);
	});
	return getUnit(kind, unitId, authorization);
}

export async function deleteUnit(
	kind: CatalogUnitKind,
	unitId: string,
	authorization: Authorization<string>,
): Promise<void> {
	await authorization.unit.ensure(unitId, "unit.delete");
	await database.transaction(async (tx) => {
		const [deleted] = await tx
			.update(unit)
			.set({ deletedAt: new Date() })
			.where(and(eq(unit.id, unitId), eq(unit.kind, kind)))
			.returning({ id: unit.id });
		if (!deleted) throw new UnitNotFound(kind);
		if (kind !== "series") await ensureUnitVariantLifecycle(tx, unitId);
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "delete",
		});
	});
}

export async function upsertLocalization(
	unitId: string,
	authorization: Authorization<string>,
	input: {
		language: ContentLanguage;
		title: string;
		summary?: string;
		description?: PortableTextDocumentValue;
		avatar?: AvatarReference | null;
		bannerAssetId?: string | null;
		coverAssetId?: string | null;
	},
): Promise<void> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations", input.language]]);
	await database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			authorization.profileId,
			unitLocalizationImageAssetReferences(input),
		);
		await tx
			.insert(unitLocalization)
			.values({
				unitId,
				...toUnitLocalizationStorage(input),
			})
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: {
					title: input.title,
					summary: input.summary,
					description: input.description,
					...(Object.hasOwn(input, "avatar")
						? avatarReferenceToColumns(input.avatar ?? null)
						: {}),
					...(Object.hasOwn(input, "bannerAssetId")
						? { bannerAssetId: input.bannerAssetId }
						: {}),
					...(Object.hasOwn(input, "coverAssetId")
						? { coverAssetId: input.coverAssetId }
						: {}),
				},
			});
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
	});
}

export async function updateUnitLocalizationOrder(
	unitId: string,
	authorization: Authorization<string>,
	input: {
		expectedLanguages: readonly ContentLanguage[];
		languages: readonly ContentLanguage[];
	},
): Promise<ContentLanguage[]> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations"]]);
	await database.transaction(async (tx) => {
		const changed = await reorderUnitLocalizations(
			tx,
			unitId,
			input.expectedLanguages,
			input.languages,
		);
		if (changed)
			await recordUnitRevision(tx, {
				unitId,
				actorProfileId: authorization.profileId,
				event: "update",
			});
	});
	return [...input.languages];
}

export async function getUnitLocalizationOrder(
	unitId: string,
	authorization: Authorization,
): Promise<ContentLanguage[]> {
	await authorization.unit.ensureCanRead(unitId);
	const localizations = await database
		.select({ language: unitLocalization.language })
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.position, unitLocalization.language);
	if (!localizations.length) throw new UnitNotFound();
	return localizations.map(({ language }) => language);
}

export async function deleteUnitContentLanguage(
	unitId: string,
	language: ContentLanguage,
	authorization: Authorization<string>,
	expectedLanguages: readonly ContentLanguage[],
): Promise<ContentLanguage[]> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations"]]);
	return database.transaction(async (tx) => {
		const languages = await removeUnitLocalization(tx, unitId, language, expectedLanguages);
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
		return languages;
	});
}
