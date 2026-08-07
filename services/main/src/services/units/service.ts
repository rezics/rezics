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
import {
	parseNullablePublicationLicenseId,
	type PublicationLicenseId,
	type UnitContentLicenseSlug,
} from "@rezics/license";

import type { Authorization } from "../authorization";
import { OfficialProfileIds } from "../bootstrap/manifest";
import {
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
} from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { toSafeInteger } from "../database/integer";
import { exactCount, lowerBoundCount } from "../counts/contract";
import { WorkPolicy } from "../performance/policy";
import {
	type CreditAttributionRole,
	isCreditAttributionRoleForUnitKind,
	type WorkReleaseStatus,
} from "../database/schema/contract-values";
import { ContentStructureSnapshotSchema } from "../content-structure/contracts";
import { createContentStructureHistory } from "../content-structure/history";
import {
	avatarReferenceFromColumns,
	avatarReferenceToColumns,
	removeUnitLocalization,
	reorderUnitLocalizations,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "./localization";
import {
	book,
	audio,
	unitContentLicense,
	contentStructure,
	creditAttribution,
	entity,
	software,
	media,
	profilePreference,
	series,
	unit,
	unitOwnership,
	subjectAssociation,
	unitLocalization,
	unitProgress,
	unitTag,
	unitTagVoteStat,
	unitVariant,
	video,
} from "../database/schema";
import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";
import { ensureImageAssetsAttachable, imageAssetContentUrl } from "../api/image-assets/service";
import { UnitDetailResponse } from "../api/schema/response";
import { CreditAttributionRoleInvalid } from "../entities/errors";
import { fractionalPositionBetween } from "../ordering/position";
import {
	UnitChanged,
	UnitContentLicenseGrantForbidden,
	UnitNotFound,
	UnitVariantKindMismatch,
	UnitVariantMainUnavailable,
	UnitVariantTargetIsVariant,
} from "./errors";
import { recordUnitRevision } from "./history";
import { insertUnit } from "./create";
import { transitionUnitStatus } from "./status";
import {
	nextUnitUpdatedAt,
	toBookUpdateValues,
	toMediaUpdateValues,
	toSeriesUpdateValues,
	toSoftwareUpdateValues,
	toTimedMediaUpdateValues,
	type UpdateUnitInput,
} from "./update-values";
import {
	getAttributionSummariesByUnitIds,
	getAttributionSummariesWithStatisticsByUnitIds,
} from "./attribution";
import { getUnitVariantContext } from "./variants";
import { ensureUnitVariantLifecycle, isDiscoverableVariantUnit } from "./variant-policy";
import { presentAvatar } from "./avatar";
import { listPublishedBookContentMetrics } from "../content-metrics/service";
import { getAssociationContextPostsByAssociationIds } from "./association-context";
import { createAssociationRequestInTransaction } from "./association-proposals";
import {
	type CreditAttributionRequestConsent,
	type EntityCreditAttributionCreationMode,
	ensureCreditAttributionRequestsConfirmed,
	resolveEntityCreditAttributionCreationMode,
} from "./attribution-authorization";
import { wilsonLowerBoundSql } from "../tags/ranking";
import { getPendingUnitOwnershipClaim } from "../ownership-claims/service";
import { unitScope } from "../authorization/unit/scope";
import { getAcceptedUnitSourceLinks } from "./source-links";

export type VariantUnitKind = "book" | "software" | "media";
export type WorkUnitKind = VariantUnitKind | "series";
export type TimedMediaUnitKind = "video" | "audio";
export type ManageableUnitKind = WorkUnitKind | TimedMediaUnitKind;
export type UnitDetail = Static<typeof UnitDetailResponse>;
type StoredUnitLocalization = typeof unitLocalization.$inferSelect;
const CreditAttributionRequestLifetimeMs = 30 * 24 * 60 * 60 * 1_000;

type CreateUnitAccessInput =
	| {
			readonly ownershipMode: "profile_owned";
			readonly contentLicense?: {
				readonly referenceLicenseSlug: UnitContentLicenseSlug;
			};
			readonly creditAttributions: readonly {
				readonly entityId: string;
				readonly role: CreditAttributionRole;
			}[];
	  }
	| {
			readonly ownershipMode: "community_owned";
			readonly creditAttributions: readonly {
				readonly entityId: string;
				readonly role: CreditAttributionRole;
			}[];
	  };

export type CreateUnitInput = CreateUnitAccessInput & {
	creditAttributionRequestConsent: CreditAttributionRequestConsent;
	version: { readonly kind: "main" } | { readonly kind: "variant"; readonly mainUnitId: string };
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
	details:
		| { readonly type: "book"; readonly releaseStatus: WorkReleaseStatus }
		| { readonly type: "software" }
		| { readonly type: "media"; readonly releaseStatus: WorkReleaseStatus };
};

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
	authorization: Authorization<string>,
	input: CreateUnitInput,
): Promise<UnitDetail> {
	const kind = input.details.type;
	const ownerId = authorization.profileId;
	const unitId = await database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			ownerId,
			unitLocalizationImageAssetReferences(input.localization),
		);
		const resolvedCreditAttributions: {
			readonly entityId: string;
			readonly role: CreditAttributionRole;
			readonly creationMode: EntityCreditAttributionCreationMode;
		}[] = [];
		for (const attribution of input.creditAttributions) {
			if (!isCreditAttributionRoleForUnitKind(kind, attribution.role))
				throw new CreditAttributionRoleInvalid(kind, attribution.role);
			resolvedCreditAttributions.push({
				...attribution,
				creationMode: await resolveEntityCreditAttributionCreationMode(
					authorization,
					tx,
					attribution.entityId,
				),
			});
		}
		ensureCreditAttributionRequestsConfirmed(
			input.creditAttributionRequestConsent,
			resolvedCreditAttributions,
		);
		const created = await insertUnit(tx, {
			kind,
			visibility: input.visibility ?? "public",
			contentRating: input.contentRating ?? "general",
			aiDisclosure: input.aiDisclosure ?? "unknown",
			license: input.license,
			statusActor: { kind: "profile", profileId: ownerId },
		});
		let createdStructure: typeof contentStructure.$inferSelect | undefined;
		if (input.details.type === "book") {
			await tx
				.insert(book)
				.values({ id: created.id, releaseStatus: input.details.releaseStatus });
			[createdStructure] = await tx
				.insert(contentStructure)
				.values({ ownerUnitId: created.id, kind: "book.contents" })
				.returning();
			if (!createdStructure)
				throw new Error("Book Content Structure insertion returned no row");
		}
		if (input.details.type === "software") await tx.insert(software).values({ id: created.id });
		if (input.details.type === "media") {
			await tx.insert(media).values({
				id: created.id,
				kind: "other",
				releaseStatus: input.details.releaseStatus,
			});
			[createdStructure] = await tx
				.insert(contentStructure)
				.values({ ownerUnitId: created.id, kind: "media.contents" })
				.returning();
			if (!createdStructure)
				throw new Error("Media Content Structure insertion returned no row");
		}
		await tx.insert(unitLocalization).values({
			unitId: created.id,
			...toUnitLocalizationStorage(input.localization),
		});
		if (input.ownershipMode === "profile_owned")
			await createProfileOwnedUnitAccess(tx, created.id, ownerId);
		else
			await createPublicEditableUnitAccess(tx, created.id, [
				"unit.update",
				"unit.status.update",
			]);
		if (input.ownershipMode === "profile_owned" && input.contentLicense)
			await tx.insert(unitContentLicense).values({
				unitId: created.id,
				grantedByProfileId: ownerId,
				referenceLicenseSlug: input.contentLicense.referenceLicenseSlug,
			});
		if (input.version.kind === "variant") {
			const [main] = await tx
				.select({
					id: unit.id,
					kind: unit.kind,
					status: unit.status,
					visibility: unit.visibility,
					moderationStatus: unit.moderationStatus,
					deletedAt: unit.deletedAt,
					parentMainUnitId: unitVariant.mainUnitId,
				})
				.from(unit)
				.leftJoin(unitVariant, eq(unitVariant.variantUnitId, unit.id))
				.where(eq(unit.id, input.version.mainUnitId))
				.limit(1);
			if (!main || main.deletedAt) throw new UnitVariantMainUnavailable();
			if (main.kind !== kind) throw new UnitVariantKindMismatch();
			if (main.parentMainUnitId) throw new UnitVariantTargetIsVariant();
			const decision = await authorization.unit.decideInTransaction(tx, main.id, "unit.read");
			if (!decision.allowed) throw new UnitVariantMainUnavailable();
			if (isDiscoverableVariantUnit(created) && !isDiscoverableVariantUnit(main))
				throw new UnitVariantMainUnavailable();
			await tx.insert(unitVariant).values({
				variantUnitId: created.id,
				mainUnitId: main.id,
				unitKind: kind,
			});
		}
		let lastCreditAttributionPosition: string | undefined;
		for (const attribution of resolvedCreditAttributions) {
			const position = fractionalPositionBetween(lastCreditAttributionPosition, null);
			lastCreditAttributionPosition = position;
			if (attribution.creationMode === "direct")
				await tx.insert(creditAttribution).values({
					sourceUnitId: created.id,
					creditedUnitId: attribution.entityId,
					role: attribution.role,
					position,
				});
			else
				await createAssociationRequestInTransaction(tx, authorization, ownerId, {
					sourceUnitId: created.id,
					targetUnitId: attribution.entityId,
					kind: "credit",
					role: attribution.role,
					expiresAt: new Date(Date.now() + CreditAttributionRequestLifetimeMs),
				});
		}
		const structureSnapshot = createdStructure
			? ContentStructureSnapshotSchema.parse({
					version: 1,
					structure: createdStructure,
					nodes: [],
				})
			: null;
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: ownerId,
			event: "create",
		});
		if (structureSnapshot)
			await createContentStructureHistory(tx, {
				structureId: structureSnapshot.structure.id,
				actorProfileId: ownerId,
				state: structureSnapshot,
			});
		return created.id;
	});
	return getUnit(kind, unitId, authorization);
}

async function getUnitDetails(
	kind: ManageableUnitKind,
	unitId: string,
): Promise<UnitDetail["details"]> {
	const contentLicense =
		kind === "book" || kind === "software" || kind === "media"
			? ((
					await database
						.select({
							referenceLicenseSlug: unitContentLicense.referenceLicenseSlug,
							grantedByProfileId: unitContentLicense.grantedByProfileId,
							grantedAt: unitContentLicense.grantedAt,
						})
						.from(unitContentLicense)
						.where(
							and(
								eq(unitContentLicense.unitId, unitId),
								eq(unitContentLicense.status, "active"),
							),
						)
						.limit(1)
				)[0] ?? null)
			: null;
	if (kind === "book") {
		const [details] = await database.select().from(book).where(eq(book.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "book",
			releaseStatus: details.releaseStatus,
			isbn13: details.isbn13,
			publicationDate: details.publicationDate,
			pageCount: details.pageCount,
			wordCount: details.wordCount,
			publishedContentMetrics: await listPublishedBookContentMetrics(database, unitId),
			format: details.format,
			contentLicense,
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
			contentLicense,
		};
	}
	if (kind === "media") {
		const [details] = await database.select().from(media).where(eq(media.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "media",
			releaseStatus: details.releaseStatus,
			releaseDate: details.releaseDate,
			kind: details.kind,
			runtimeMinutes: details.runtimeMinutes,
			episodeCount: details.episodeCount,
			seasonCount: details.seasonCount,
			contentLicense,
		};
	}
	if (kind === "video" || kind === "audio") {
		const table = kind === "video" ? video : audio;
		const [details] = await database.select().from(table).where(eq(table.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return { type: kind, durationSeconds: details.durationSeconds };
	}
	const [details] = await database.select().from(series).where(eq(series.id, unitId)).limit(1);
	if (!details) throw new UnitNotFound(kind);
	return { type: "series", kind: details.kind };
}

export async function getUnit(
	kind: ManageableUnitKind,
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
	const links = await getAcceptedUnitSourceLinks(base.id, authorization.profileId);
	const tags = await database
		.select({
			tagId: unitTag.tagId,
			score: unitTagVoteStat.score,
			voteCount: unitTagVoteStat.voteCount,
			pinned: unitTag.pinned,
			position: unitTag.position,
			title: resolvedUnitLocalizationTitle(unitTag.tagId, localizationLanguages),
			createdAt: unitTag.createdAt,
			updatedAt: unitTag.updatedAt,
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
		.orderBy(
			desc(unitTag.pinned),
			sql`case when ${unitTag.pinned} then ${unitTag.position} end asc nulls last`,
			desc(wilsonLowerBoundSql(unitTagVoteStat.score, unitTagVoteStat.voteCount)),
			desc(unitTagVoteStat.score),
			desc(unitTagVoteStat.voteCount),
			unitTag.tagId,
		);
	const visibleProgressRows = await database
		.select({ status: unitProgress.status })
		.from(unitProgress)
		.innerJoin(profilePreference, eq(profilePreference.profileId, unitProgress.profileId))
		.where(
			and(
				eq(unitProgress.unitId, base.id),
				isNull(unitProgress.deletedAt),
				eq(profilePreference.progressVisibility, "public"),
				eq(unitProgress.visibility, "public"),
			),
		)
		.orderBy(unitProgress.profileId)
		.limit(WorkPolicy.count.maxPublicProgressCountScan);
	const progressCountIsExact =
		visibleProgressRows.length < WorkPolicy.count.maxPublicProgressCountScan;
	const progressCount = (status: "active" | "backlog") => {
		const value = visibleProgressRows.filter((row) => row.status === status).length;
		return progressCountIsExact ? exactCount(value) : lowerBoundCount(value);
	};
	const variantContext: UnitDetail["variantContext"] =
		kind === "series" || kind === "video" || kind === "audio"
			? { role: "standalone" }
			: await getUnitVariantContext(base.id, authorization.profileId, localizationLanguages);
	const [
		canEdit,
		canCurateTags,
		canCurateAliases,
		canCurateSourceLinks,
		canManageRealmPublications,
		accessDecision,
		associationDecision,
		hasDevelopmentPreviewAccess,
		ownershipClaim,
		activeOwnership,
	] = await Promise.all([
		authorization.unit.canUpdate(base.id),
		authorization.unit.decide(base.id, "unit.tag-curation.manage"),
		authorization.unit.decide(
			base.id,
			"unit.reference-curation.manage",
			unitScope("references", "aliases"),
		),
		authorization.unit.decide(
			base.id,
			"unit.reference-curation.manage",
			unitScope("references", "source-links"),
		),
		authorization.unit.decide(base.id, "unit.realm-publication.manage"),
		authorization.unit.decide(base.id, "unit.access.manage"),
		authorization.unit.decide(base.id, "unit.association.manage"),
		authorization.platform.hasCapability(DevelopmentPreviewCapability),
		getPendingUnitOwnershipClaim(base.id, authorization.profileId),
		database
			.select({ profileId: unitOwnership.profileId })
			.from(unitOwnership)
			.where(and(eq(unitOwnership.unitId, base.id), isNull(unitOwnership.revokedAt)))
			.limit(1)
			.then(([row]) => row ?? null),
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
			resolveUnitLocalizationAvatarFromOrdered(localizations, localizationLanguages),
		),
		banner: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(
				localizations,
				"banner",
				localizationLanguages,
			),
			"banner",
		),
		cover: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(
				localizations,
				"cover",
				localizationLanguages,
			),
			"cover",
		),
		localizations: localizations.map(presentUnitLocalization),
		subjectAssociations,
		links,
		tags: tags.map((tag) => ({
			...tag,
			id: tag.tagId,
			realmId: null,
			score: toSafeInteger(tag.score ?? 0n, "tag vote score"),
			voteCount: toSafeInteger(tag.voteCount ?? 0n, "tag vote count"),
		})),
		progressStatistics:
			visibleProgressRows.length < 5
				? null
				: {
						active: progressCount("active"),
						backlog: progressCount("backlog"),
					},
		versions:
			kind === "series" || kind === "video" || kind === "audio"
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
		ownershipMode:
			activeOwnership?.profileId === OfficialProfileIds.community
				? "community_owned"
				: "profile_owned",
		ownershipClaim: ownershipClaim ? { ...ownershipClaim, state: "pending" as const } : null,
		capabilities: {
			canEdit,
			canManageAccess: accessDecision.allowed,
			canManageAssociations: associationDecision.allowed,
			canCurateTags: canCurateTags.allowed,
			canCurateReferences: {
				aliases: canCurateAliases.allowed,
				sourceLinks: canCurateSourceLinks.allowed,
			},
			canManageRealmPublications: canManageRealmPublications.allowed,
			hasDevelopmentPreviewAccess,
		},
	};
}

export async function listUnits(
	kind: WorkUnitKind,
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
			avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
			bannerAssetId: resolvedUnitLocalizationImageAssetId(
				unit.id,
				"banner",
				localizationLanguages,
			),
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				unit.id,
				"cover",
				localizationLanguages,
			),
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
		rows.map(async ({ avatar, bannerAssetId, coverAssetId, ...row }) => ({
			...row,
			attributions: attributions.get(row.id) ?? [],
			avatar: presentAvatar(avatar),
			banner: presentImageAsset(bannerAssetId, "banner"),
			cover: presentImageAsset(coverAssetId, "cover"),
		})),
	);
}

/** Executes one authorized Unit aggregate update inside its owning transaction. @internal */
export async function updateUnitInTransaction(
	tx: DatabaseTransaction,
	kind: ManageableUnitKind,
	unitId: string,
	actorProfileId: string,
	statusUpdateAllowed: boolean,
	body: UpdateUnitInput,
): Promise<void> {
	const updatedAt = nextUnitUpdatedAt(body.expectedUpdatedAt);
	const [updated] = await tx
		.update(unit)
		.set({
			updatedAt,
			visibility: body.visibility,
			contentRating: body.contentRating,
			aiDisclosure: body.aiDisclosure,
			...(Object.hasOwn(body, "license") ? { license: body.license } : {}),
		})
		.where(
			and(
				eq(unit.id, unitId),
				eq(unit.kind, kind),
				eq(unit.updatedAt, body.expectedUpdatedAt),
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
	if (details.contentLicense !== undefined) {
		const [activeOwnership] = await tx
			.select({ profileId: unitOwnership.profileId })
			.from(unitOwnership)
			.where(and(eq(unitOwnership.unitId, unitId), isNull(unitOwnership.revokedAt)))
			.limit(1);
		if (activeOwnership?.profileId === OfficialProfileIds.community)
			throw new UnitContentLicenseGrantForbidden();
	}
	const bookUpdate = kind === "book" ? toBookUpdateValues(body) : undefined;
	if (bookUpdate) await tx.update(book).set(bookUpdate).where(eq(book.id, unitId));
	const softwareUpdate = kind === "software" ? toSoftwareUpdateValues(body) : undefined;
	if (softwareUpdate)
		await tx.update(software).set(softwareUpdate).where(eq(software.id, unitId));
	const mediaUpdate = kind === "media" ? toMediaUpdateValues(body) : undefined;
	if (mediaUpdate) await tx.update(media).set(mediaUpdate).where(eq(media.id, unitId));
	const timedMediaUpdate =
		kind === "video" || kind === "audio" ? toTimedMediaUpdateValues(body) : undefined;
	if (kind === "video" && timedMediaUpdate)
		await tx.update(video).set(timedMediaUpdate).where(eq(video.id, unitId));
	if (kind === "audio" && timedMediaUpdate)
		await tx.update(audio).set(timedMediaUpdate).where(eq(audio.id, unitId));
	if (
		(kind === "book" || kind === "software" || kind === "media") &&
		details.contentLicense !== undefined
	)
		await tx
			.insert(unitContentLicense)
			.values({
				unitId,
				grantedByProfileId: actorProfileId,
				referenceLicenseSlug: details.contentLicense.referenceLicenseSlug,
			})
			.onConflictDoNothing();
	const seriesUpdate = kind === "series" ? toSeriesUpdateValues(body) : undefined;
	if (seriesUpdate) await tx.update(series).set(seriesUpdate).where(eq(series.id, unitId));
	const revision = await recordUnitRevision(tx, {
		unitId,
		actorProfileId,
		event: "update",
	});
	if (body.status) {
		await transitionUnitStatus(tx, {
			unitId,
			toStatus: body.status,
			actor: { kind: "profile", profileId: actorProfileId },
			authorization: {
				kind: "interactive",
				statusUpdateAllowed,
			},
			revisionId: revision.revisionId,
		});
	}
	if (kind === "book" || kind === "software" || kind === "media")
		await ensureUnitVariantLifecycle(tx, unitId);
}

export async function updateUnit(
	kind: ManageableUnitKind,
	unitId: string,
	authorization: Authorization<string>,
	body: UpdateUnitInput,
): Promise<UnitDetail> {
	await authorization.unit.ensureCanUpdate(unitId, [["unit"], [kind]]);
	const statusUpdateDecision = body.status
		? await authorization.unit.decide(unitId, "unit.status.update", ["unit"])
		: undefined;
	await database.transaction((tx) =>
		updateUnitInTransaction(
			tx,
			kind,
			unitId,
			authorization.profileId,
			statusUpdateDecision?.allowed ?? false,
			body,
		),
	);
	return getUnit(kind, unitId, authorization);
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
