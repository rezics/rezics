import { DevelopmentPreviewCapability } from "@rezics/access";
import { and, desc, eq, exists, gt, isNull, lt, not, or, sql } from "drizzle-orm";
import type { AvatarReference } from "@rezics/avatar";
import type { PortableTextDocument as PortableTextDocumentValue } from "@rezics/block";
import type { Static } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";
import { type LicenseId } from "@rezics/license";

import type { Authorization } from "../authorization";
import { ValidationError } from "../api/errors";
import { OfficialProfileIds } from "../bootstrap/data";
import {
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
} from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { runVoteTransaction } from "../database/vote-admission";
import { toSafeInteger } from "../database/integer";
import { exactCount, lowerBoundCount } from "../counts/contract";
import { WorkPolicy } from "../performance/policy";
import {
	contentRatingAllowlistFromStored,
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	type ContentRatingPolicy,
} from "../content-rating/policy";
import {
	type CreditAttributionRole,
	isCreditAttributionRoleForUnitKind,
	isEntityKind,
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
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "./localization";
import { resolveCanonicalUnitId } from "./merge/canonical";
import {
	book,
	audio,
	contentStructure,
	creditAttribution,
	unitTagJudgmentStat,
	entity,
	software,
	media,
	profilePreference,
	release,
	series,
	unit,
	unitOwnership,
	subjectAssociation,
	subjectAssociationJudgment,
	subjectAssociationJudgmentStat,
	unitLocalization,
	unitProgress,
	unitTag,
	unitVariant,
	video,
} from "../database/schema";
import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";
import { ensureImageAssetsAttachable, imageAssetContentUrl } from "../api/image-assets/service";
import { UnitDetailResponse } from "../api/schema/response";
import { CreditAttributionRoleInvalid } from "../entities/errors";
import { fractionalPositionBetween } from "../ordering/position";
import { presentNullablePortableTextDocument } from "../documents/portable-text-presentation";
import {
	UnitChanged,
	UnitNotFound,
	VideoAudioTrackInvalid,
	UnitVariantKindMismatch,
	UnitVariantMainUnavailable,
	UnitVariantTargetIsVariant,
} from "./errors";
import { recordUnitRevision } from "./history";
import { insertUnit } from "./create";
import { transitionUnitStatus } from "./status";
import {
	cancelBookChapterDraftJobs,
	enqueueBookChapterDraftJobInTransaction,
} from "./book-chapter-draft";
import {
	nextUnitUpdatedAt,
	toBookUpdateValues,
	toMediaUpdateValues,
	toReleaseUpdateValues,
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
import {
	insertLicenseGrants,
	listEffectiveUnitLicenses,
	listOpenUnitLicenseOfferings,
	syncLicenseOfferings,
} from "./license-grants";
import { applyInitialTags } from "../tags/initial-applications";
import { getPendingUnitOwnershipClaim } from "../ownership-claims/service";
import { unitScope } from "../authorization/unit/scope";
import { getUnitExternalLinkPreviewWithSources } from "./external-links";
import type { RevisionContributionInput } from "./revision-contribution";
import {
	ensureMetadataOnlyChangeAllowed,
	isMetadataOnlyUnitKind,
	resolveCreatedMetadataOnly,
} from "./metadata-only";
import {
	getUnitContentLanguageSupport,
	normalizeContentLanguageSupportInput,
	presentContentLanguageSupport,
	replaceUnitContentLanguageSupport,
} from "./content-language-support";
import { getSubjectAssociationExpressionPreviews } from "./subject-association-tags";
import { presentSubjectAssociationSpoiler } from "./subject-association-spoiler";
import {
	listAdaptedAudioUnitIds,
	normalizeAdaptedAudioUnitIds,
	replaceAdaptedAudioUnitTracks,
} from "./video-audio-tracks";

export type VariantUnitKind = "book" | "software" | "media";
export type WorkUnitKind = VariantUnitKind | "series";
export type TimedMediaUnitKind = "video" | "audio";
export type ManageableUnitKind = WorkUnitKind | TimedMediaUnitKind | "release";
export type UnitDetail = Static<typeof UnitDetailResponse>;
type StoredUnitLocalization = typeof unitLocalization.$inferSelect;

function requireEntityKind(value: string) {
	if (!isEntityKind(value)) throw new Error("Persisted Entity kind is not supported");
	return value;
}

const CreditAttributionRequestLifetimeMs = 30 * 24 * 60 * 60 * 1_000;

type CreateUnitAccessInput =
	| {
			readonly ownershipMode: "profile_owned";
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
	revisionContribution?: RevisionContributionInput;
	contentLanguageSupport?: unknown;
	initialTagIds: readonly string[];
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
	licenses?: readonly LicenseId[];
	details:
		| {
				readonly type: "book";
				readonly releaseStatus: WorkReleaseStatus;
				readonly metadataOnly?: boolean;
		  }
		| { readonly type: "software"; readonly metadataOnly?: boolean }
		| {
				readonly type: "media";
				readonly releaseStatus: WorkReleaseStatus;
				readonly metadataOnly?: boolean;
		  };
};

export function presentImageAsset(assetId: string | null, role?: "avatar" | "banner" | "cover") {
	return assetId
		? {
				id: assetId,
				url: role ? imageAssetPresentationContentUrl(assetId, role) : imageAssetContentUrl(assetId),
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
		description: presentNullablePortableTextDocument(description, "unit_localization.description"),
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
	const contentLanguageSupport = normalizeContentLanguageSupportInput(
		input.contentLanguageSupport ?? [],
	);
	const unitId = await runVoteTransaction(
		{ family: "unit_tag", authority: "global" },
		async (tx) => {
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
				statusActor: { kind: "profile", profileId: ownerId },
			});
			let createdStructure: typeof contentStructure.$inferSelect | undefined;
			if (input.details.type === "book") {
				await tx.insert(book).values({
					id: created.id,
					releaseStatus: input.details.releaseStatus,
					metadataOnly: resolveCreatedMetadataOnly(input.ownershipMode, input.details.metadataOnly),
				});
				[createdStructure] = await tx
					.insert(contentStructure)
					.values({ ownerUnitId: created.id, kind: "book.contents" })
					.returning();
				if (!createdStructure) throw new Error("Book Content Structure insertion returned no row");
			}
			if (input.details.type === "software")
				await tx.insert(software).values({
					id: created.id,
					metadataOnly: resolveCreatedMetadataOnly(input.ownershipMode, input.details.metadataOnly),
				});
			if (input.details.type === "media") {
				await tx.insert(media).values({
					id: created.id,
					kind: "other",
					releaseStatus: input.details.releaseStatus,
					metadataOnly: resolveCreatedMetadataOnly(input.ownershipMode, input.details.metadataOnly),
				});
				[createdStructure] = await tx
					.insert(contentStructure)
					.values({ ownerUnitId: created.id, kind: "media.contents" })
					.returning();
				if (!createdStructure) throw new Error("Media Content Structure insertion returned no row");
			}
			await tx.insert(unitLocalization).values({
				unitId: created.id,
				...toUnitLocalizationStorage(input.localization),
			});
			if (contentLanguageSupport.length)
				await replaceUnitContentLanguageSupport(tx, created.id, kind, contentLanguageSupport);
			if (input.ownershipMode === "profile_owned")
				await createProfileOwnedUnitAccess(tx, created.id, ownerId);
			else
				await createPublicEditableUnitAccess(tx, created.id, ["unit.update", "unit.status.update"]);
			if (input.licenses?.length)
				await insertLicenseGrants(tx, {
					unitId: created.id,
					grantedByProfileId: ownerId,
					licenseIds: input.licenses,
					unitKind: kind,
				});
			await applyInitialTags(tx, {
				unitId: created.id,
				profileId: ownerId,
				tagIds: input.initialTagIds,
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
				contribution: input.revisionContribution,
				event: "create",
			});
			if (structureSnapshot)
				await createContentStructureHistory(tx, {
					structureId: structureSnapshot.structure.id,
					actorProfileId: ownerId,
					state: structureSnapshot,
				});
			return created.id;
		},
	);
	return getUnit(kind, unitId, authorization);
}

async function getUnitDetails(
	kind: ManageableUnitKind,
	unitId: string,
): Promise<UnitDetail["details"]> {
	if (kind === "book") {
		const [details] = await database.select().from(book).where(eq(book.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "book",
			releaseStatus: details.releaseStatus,
			metadataOnly: details.metadataOnly,
			isbn13: details.isbn13,
			publicationDate: details.publicationDate,
			pageCount: details.pageCount,
			wordCount: details.wordCount,
			publishedContentMetrics: await listPublishedBookContentMetrics(database, unitId),
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
			metadataOnly: details.metadataOnly,
			releaseDate: details.releaseDate,
			versionLabel: details.versionLabel,
		};
	}
	if (kind === "media") {
		const [details] = await database.select().from(media).where(eq(media.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "media",
			releaseStatus: details.releaseStatus,
			metadataOnly: details.metadataOnly,
			releaseDate: details.releaseDate,
			kind: details.kind,
			runtimeMinutes: details.runtimeMinutes,
			episodeCount: details.episodeCount,
			seasonCount: details.seasonCount,
		};
	}
	if (kind === "video") {
		const [[details], adaptedAudioUnitIds] = await Promise.all([
			database.select().from(video).where(eq(video.id, unitId)).limit(1),
			listAdaptedAudioUnitIds(unitId),
		]);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "video",
			durationSeconds: details.durationSeconds,
			adaptedAudioUnitIds: adaptedAudioUnitIds.length ? [...adaptedAudioUnitIds] : null,
		};
	}
	if (kind === "audio") {
		const [details] = await database.select().from(audio).where(eq(audio.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return { type: "audio", durationSeconds: details.durationSeconds };
	}
	if (kind === "release") {
		const [details] = await database.select().from(release).where(eq(release.id, unitId)).limit(1);
		if (!details) throw new UnitNotFound(kind);
		return {
			type: "release",
			parentUnitId: details.parentUnitId,
			versionLabel: details.versionLabel,
			releasedOn: details.releasedOn,
		};
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
	const canonicalUnitId = await resolveCanonicalUnitId(database, unitId);
	const [base] = await database
		.select()
		.from(unit)
		.where(and(eq(unit.id, canonicalUnitId), eq(unit.kind, kind), isNull(unit.deletedAt)))
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
		(await getAttributionSummariesWithStatisticsByUnitIds([base.id], localizationLanguages)).get(
			base.id,
		) ?? [];
	const [viewerDisplayPreference] = authorization.profileId
		? await database
				.select({
					alwaysShowSpoilers: profilePreference.alwaysShowSpoilers,
					contentRatings: profilePreference.contentRatings,
				})
				.from(profilePreference)
				.where(eq(profilePreference.profileId, authorization.profileId))
				.limit(1)
		: [];
	const subjectAssociationRows = await database
		.select({
			id: subjectAssociation.id,
			entityEntryId: subjectAssociation.entityId,
			entityKind: entity.kind,
			role: subjectAssociation.role,
			position: subjectAssociation.position,
			language: resolvedUnitLocalizationLanguage(
				subjectAssociation.entityId,
				localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(subjectAssociation.entityId, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(subjectAssociation.entityId, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(subjectAssociation.entityId, localizationLanguages),
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				subjectAssociation.entityId,
				"cover",
				localizationLanguages,
			),
			spoilerVoteCount: subjectAssociationJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: subjectAssociationJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: subjectAssociationJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: subjectAssociationJudgmentStat.spoilerMajorCount,
			viewerSpoilerLevel: authorization.profileId
				? sql<number | null>`(
						select judgment.spoiler_level
						from ${subjectAssociationJudgment} judgment
						where judgment.association_id = ${subjectAssociation.id}
							and judgment.profile_id = ${authorization.profileId}::uuid
					)`
				: sql<number | null>`null`,
		})
		.from(subjectAssociation)
		.innerJoin(entity, eq(entity.id, subjectAssociation.entityId))
		.leftJoin(
			subjectAssociationJudgmentStat,
			eq(subjectAssociationJudgmentStat.associationId, subjectAssociation.id),
		)
		.where(eq(subjectAssociation.unitId, base.id))
		.orderBy(subjectAssociation.position, subjectAssociation.id);
	const [contextPosts, entityExpressionPreviews] = await Promise.all([
		getAssociationContextPostsByAssociationIds(
			subjectAssociationRows.map(({ id }) => id),
			localizationLanguages,
			authorization.profileId,
		),
		getSubjectAssociationExpressionPreviews(
			subjectAssociationRows.map(({ entityEntryId }) => entityEntryId),
			localizationLanguages,
			{
				allowedContentRatings: contentRatingAllowlistFromStored(
					viewerDisplayPreference?.contentRatings,
				),
				includeSpoilers: viewerDisplayPreference?.alwaysShowSpoilers ?? false,
			},
		),
	]);
	const subjectAssociations = subjectAssociationRows.map(
		({
			avatar,
			coverAssetId,
			spoilerVoteCount,
			spoilerNoneCount,
			spoilerMinorCount,
			spoilerMajorCount,
			viewerSpoilerLevel,
			...association
		}) => {
			return {
				...association,
				entityKind: requireEntityKind(association.entityKind),
				avatar: presentAvatar(avatar),
				cover: presentImageAsset(coverAssetId, "cover"),
				expressions: [...(entityExpressionPreviews.get(association.entityEntryId) ?? [])],
				contextPost: contextPosts.get(association.id) ?? null,
				spoiler: presentSubjectAssociationSpoiler(
					{
						spoilerVoteCount,
						spoilerNoneCount,
						spoilerMinorCount,
						spoilerMajorCount,
						viewerSpoilerLevel,
					},
					viewerDisplayPreference?.alwaysShowSpoilers ?? false,
				),
			};
		},
	);
	const externalLinks = await getUnitExternalLinkPreviewWithSources({
		unitId: base.id,
		localizationLanguages,
		profileId: authorization.profileId,
	});
	const tags = await database
		.select({
			tagId: unitTag.tagId,
			score: unitTagJudgmentStat.score,
			voteCount: unitTagJudgmentStat.voteCount,
			pinned: unitTag.pinned,
			position: unitTag.position,
			title: resolvedUnitLocalizationTitle(unitTag.tagId, localizationLanguages),
			createdAt: unitTag.createdAt,
			updatedAt: unitTag.updatedAt,
		})
		.from(unitTag)
		.leftJoin(
			unitTagJudgmentStat,
			and(
				eq(unitTagJudgmentStat.unitId, unitTag.unitId),
				eq(unitTagJudgmentStat.tagId, unitTag.tagId),
				gt(unitTagJudgmentStat.voteCount, 0n),
			),
		)
		.where(eq(unitTag.unitId, base.id))
		.orderBy(
			desc(unitTag.pinned),
			sql`case when ${unitTag.pinned} then ${unitTag.position} end asc nulls last`,
			desc(wilsonLowerBoundSql(unitTagJudgmentStat.score, unitTagJudgmentStat.voteCount)),
			desc(unitTagJudgmentStat.score),
			desc(unitTagJudgmentStat.voteCount),
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
		kind === "series" || kind === "video" || kind === "audio" || kind === "release"
			? { role: "standalone" }
			: await getUnitVariantContext(base.id, authorization.profileId, localizationLanguages);
	const [
		canEdit,
		canCurateTags,
		canCurateAliases,
		canCurateExternalLinks,
		canManageRealmPublications,
		metadataOnlyUpdateDecision,
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
			unitScope("references", "external-links"),
		),
		authorization.unit.decide(base.id, "unit.realm-publication.manage"),
		isMetadataOnlyUnitKind(kind)
			? authorization.unit.decide(base.id, "unit.metadata-only.update", ["unit"])
			: Promise.resolve({ allowed: false as const, reason: "ungranted" as const }),
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
	const [details, licenses, licenseOfferings, contentLanguageSupport] = await Promise.all([
		getUnitDetails(kind, base.id),
		listEffectiveUnitLicenses(base.id),
		listOpenUnitLicenseOfferings(base.id),
		getUnitContentLanguageSupport(base.id),
	]);
	return {
		id: base.id,
		type: kind,
		status: base.status,
		visibility: base.visibility,
		language: selectedLocalization.language,
		contentLanguageSupport: presentContentLanguageSupport(contentLanguageSupport),
		contentRating: base.contentRating,
		aiDisclosure: base.aiDisclosure,
		licenses: [...licenses],
		licenseOfferings: [...licenseOfferings],
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
					: details.type === "release"
						? details.releasedOn
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
			resolveUnitLocalizationImageAssetIdFromOrdered(localizations, "cover", localizationLanguages),
			"cover",
		),
		localizations: localizations.map(presentUnitLocalization),
		subjectAssociations,
		externalLinks,
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
			kind === "series" || kind === "video" || kind === "audio" || kind === "release"
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
			canUpdateMetadataOnly: canEdit && metadataOnlyUpdateDecision.allowed,
			canManageAccess: accessDecision.allowed,
			canManageAssociations: associationDecision.allowed,
			canCurateTags: canCurateTags.allowed,
			canCurateReferences: {
				aliases: canCurateAliases.allowed,
				externalLinks: canCurateExternalLinks.allowed,
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
	contentRatingPolicy: ContentRatingPolicy = DefaultContentRatingPolicy,
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
			bannerAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "banner", localizationLanguages),
			coverAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "cover", localizationLanguages),
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
				getContentRatingCondition(contentRatingPolicy),
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

function hasAdaptedAudioRelationUpdate(kind: ManageableUnitKind, body: UpdateUnitInput): boolean {
	const hasUpdate = Object.hasOwn(body.details ?? {}, "adaptedAudioUnitIds");
	if (hasUpdate && kind !== "video")
		throw new VideoAudioTrackInvalid(
			"/details/adaptedAudioUnitIds",
			"is only supported by Video Units",
		);
	return hasUpdate;
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
	const hasAdaptedAudioUpdate = hasAdaptedAudioRelationUpdate(kind, body);
	const updatedAt = nextUnitUpdatedAt(body.expectedUpdatedAt);
	const [updated] = await tx
		.update(unit)
		.set({
			updatedAt,
			visibility: body.visibility,
			contentRating: body.contentRating,
			aiDisclosure: body.aiDisclosure,
		})
		.where(
			and(eq(unit.id, unitId), eq(unit.kind, kind), eq(unit.updatedAt, body.expectedUpdatedAt)),
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
	const bookUpdate = kind === "book" ? toBookUpdateValues(body) : undefined;
	if (bookUpdate) await tx.update(book).set(bookUpdate).where(eq(book.id, unitId));
	const softwareUpdate = kind === "software" ? toSoftwareUpdateValues(body) : undefined;
	if (softwareUpdate) await tx.update(software).set(softwareUpdate).where(eq(software.id, unitId));
	const mediaUpdate = kind === "media" ? toMediaUpdateValues(body) : undefined;
	if (mediaUpdate) await tx.update(media).set(mediaUpdate).where(eq(media.id, unitId));
	const timedMediaUpdate =
		kind === "video" || kind === "audio" ? toTimedMediaUpdateValues(body) : undefined;
	if (kind === "video" && timedMediaUpdate)
		await tx.update(video).set(timedMediaUpdate).where(eq(video.id, unitId));
	if (kind === "audio" && timedMediaUpdate)
		await tx.update(audio).set(timedMediaUpdate).where(eq(audio.id, unitId));
	if (kind === "video" && hasAdaptedAudioUpdate)
		await replaceAdaptedAudioUnitTracks(tx, unitId, body.details?.adaptedAudioUnitIds);
	if (kind === "release") {
		if (body.details?.versionLabel === null)
			throw new ValidationError({ details: { versionLabel: "must not be null" } });
		const releaseUpdate = toReleaseUpdateValues(body);
		if (releaseUpdate) await tx.update(release).set(releaseUpdate).where(eq(release.id, unitId));
	}
	if (Object.hasOwn(body, "licenses")) {
		await syncLicenseOfferings(tx, {
			unitId,
			actorProfileId,
			desired: body.licenses ?? [],
			unitKind: kind,
		});
	}
	if (Object.hasOwn(body, "contentLanguageSupport"))
		await replaceUnitContentLanguageSupport(tx, unitId, kind, body.contentLanguageSupport);
	const seriesUpdate = kind === "series" ? toSeriesUpdateValues(body) : undefined;
	if (seriesUpdate) await tx.update(series).set(seriesUpdate).where(eq(series.id, unitId));
	const revision = await recordUnitRevision(tx, {
		unitId,
		actorProfileId,
		contribution: body.revisionContribution,
		event: "update",
	});
	const changesBookStatus = kind === "book" && body.status && body.status !== updated.status;
	if (changesBookStatus) await cancelBookChapterDraftJobs(tx, unitId);
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
	if (
		changesBookStatus &&
		body.status === "draft" &&
		body.bookChapterDraftScope === "manageable_published_chapters"
	)
		await enqueueBookChapterDraftJobInTransaction(tx, {
			bookId: unitId,
			bookUpdatedAt: updatedAt,
			requestedByProfileId: actorProfileId,
		});
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
	const hasAdaptedAudioUpdate = hasAdaptedAudioRelationUpdate(kind, body);
	if (hasAdaptedAudioUpdate) {
		const targetIds = normalizeAdaptedAudioUnitIds(body.details?.adaptedAudioUnitIds);
		await authorization.unit.ensureCanReadMany(
			targetIds,
			() =>
				new VideoAudioTrackInvalid(
					"/details/adaptedAudioUnitIds",
					"contains an unavailable Audio Unit",
				),
		);
	}
	const statusUpdateDecision = body.status
		? await authorization.unit.decide(unitId, "unit.status.update", ["unit"])
		: undefined;
	await database.transaction(async (tx) => {
		const nextMetadataOnly = body.details?.metadataOnly;
		if (nextMetadataOnly !== undefined && isMetadataOnlyUnitKind(kind))
			await ensureMetadataOnlyChangeAllowed(tx, authorization, kind, unitId, nextMetadataOnly);
		await updateUnitInTransaction(
			tx,
			kind,
			unitId,
			authorization.profileId,
			statusUpdateDecision?.allowed ?? false,
			body,
		);
	});
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
		revisionContribution?: RevisionContributionInput;
	},
): Promise<void> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations", input.language]]);
	await database.transaction(async (tx) => {
		const { revisionContribution, ...localization } = input;
		await ensureImageAssetsAttachable(
			tx,
			authorization.profileId,
			unitLocalizationImageAssetReferences(localization),
		);
		await tx
			.insert(unitLocalization)
			.values({
				unitId,
				...toUnitLocalizationStorage(localization),
			})
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: {
					title: input.title,
					summary: input.summary,
					description: input.description,
					...(Object.hasOwn(input, "avatar") ? avatarReferenceToColumns(input.avatar ?? null) : {}),
					...(Object.hasOwn(input, "bannerAssetId") ? { bannerAssetId: input.bannerAssetId } : {}),
					...(Object.hasOwn(input, "coverAssetId") ? { coverAssetId: input.coverAssetId } : {}),
				},
			});
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			contribution: revisionContribution,
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
		revisionContribution?: RevisionContributionInput;
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
				contribution: input.revisionContribution,
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
	revisionContribution?: RevisionContributionInput,
): Promise<ContentLanguage[]> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations"]]);
	return database.transaction(async (tx) => {
		const languages = await removeUnitLocalization(tx, unitId, language, expectedLanguages);
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			contribution: revisionContribution,
			event: "update",
		});
		return languages;
	});
}
