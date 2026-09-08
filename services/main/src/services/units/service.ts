import { presentImageAsset } from "../api/image-assets/presentation";
import { AuthenticationRequired } from "../auth/errors";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { DevelopmentPreviewCapability } from "@rezics/access";
import type { AvatarReference } from "@rezics/avatar";
import type { PortableTextDocument as PortableTextDocumentValue } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { StaticDecode } from "typebox";
import { selfAuthUserIdForEntity } from "../participation/account-query";

import { ValidationError } from "../api/errors";

import {ensureImageAssetsAttachable} from "../api/image-assets/service";
import { UnitDetailResponse } from "../api/schema/response";
import type { Authorization } from "../authorization";
import { createProfileOwnedUnitAccess } from "../authorization/unit/ownership";
import { unitScope } from "../authorization/unit/scope";
import { OfficialProfileIds } from "../bootstrap/data";

import {
	contentRatingAllowlistFromStored,
	DefaultContentRatingPolicy,
	getContentRatingCondition,
	type ContentRatingPolicy,
} from "../content-rating/policy";

import { exactCount, lowerBoundCount } from "../counts/contract";
import { database, type DatabaseTransaction } from "../database";
import { toSafeInteger } from "../database/integer";
import {
	accountPreference,
	audio,
	entityIdentity,
	subjectAssociation,
	subjectAssociationJudgment,
	subjectAssociationJudgmentStat,
	authEntity,
	unitLocalization,
	unitOwnership,
	unitProgress,
	unitTag,
	unitTagJudgmentStat,
	video,
} from "../database/schema";
import { isEntityKind } from "../database/schema/contract-values";

import { presentNullablePortableTextDocument } from "../documents/portable-text-presentation";

import { getPendingUnitOwnershipClaim } from "../ownership-claims/service";
import { WorkPolicy } from "../performance/policy";

import { wilsonLowerBoundSql } from "../tags/ranking";
import { getAssociationContextPostsByAssociationIds } from "./association-context";

import {
	getAttributionSummariesByUnitIds,
	getAttributionSummariesWithStatisticsByUnitIds,
} from "./attribution";

import { presentAvatar } from "./avatar";

import {
	getUnitContentLanguageSupport,
	presentContentLanguageSupport,
	replaceUnitContentLanguageSupport,
} from "./content-language-support";
import { insertPlatformUnit } from "./create";
import { UnitChanged, UnitNotFound, VideoAudioTrackInvalid } from "./errors";
import { getUnitExternalLinkPreviewWithSources } from "./external-links";
import { recordUnitRevision } from "./history";
import {
	listEffectiveUnitLicenses,
	listOpenUnitLicenseOfferings,
	syncLicenseOfferings,
} from "./license-grants";
import {
	avatarReferenceFromColumns,
	avatarReferenceToColumns,
	removeUnitLocalization,
	reorderUnitLocalizations,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "./localization";
import { resolveCanonicalUnitId } from "./merge/canonical";

import type { RevisionContributionInput } from "./revision-contribution";
import { transitionUnitStatus } from "./status";
import { presentSubjectAssociationSpoiler } from "./subject-association-spoiler";
import { getSubjectAssociationExpressionPreviews } from "./subject-association-tags";
import { nextUnitUpdatedAt, toTimedMediaUpdateValues, type UpdateUnitInput } from "./update-values";

import {
	listAdaptedAudioUnitIds,
	normalizeAdaptedAudioUnitIds,
	replaceAdaptedAudioUnitTracks,
} from "./video-audio-tracks";

export type TimedMediaUnitKind = "video" | "audio";
export type ManageableUnitKind = TimedMediaUnitKind;
export type UnitDetail = StaticDecode<typeof UnitDetailResponse>;
type StoredUnitLocalization = typeof unitLocalization.$inferSelect;

function requireEntityKind(value: string) {
	if (!isEntityKind(value)) throw new Error("Persisted Entity kind is not supported");
	return value;
}

export type CreateTimedMediaUnitInput =
	| {
			readonly owner: "audio";
			readonly durationSeconds?: number | null;
	  }
	| {
			readonly owner: "video";
			readonly durationSeconds?: number | null;
			readonly adaptedAudioUnitIds?: readonly string[];
	  };
export type TimedMediaCreation = CreateTimedMediaUnitInput & {
	readonly localization: {
		readonly language: ContentLanguage;
		readonly title: string;
		readonly summary?: string;
		readonly description?: PortableTextDocumentValue;
		readonly avatar?: AvatarReference | null;
		readonly bannerAssetId?: string | null;
		readonly coverAssetId?: string | null;
	};
	readonly visibility?: "public" | "unlisted" | "private";
	readonly contentRating?: "general" | "r15" | "r18" | "r18g";
	readonly aiDisclosure?:
		| "unknown"
		| "none"
		| "ai_assisted"
		| "ai_originated"
		| "machine_generated";
	readonly revisionContribution?: RevisionContributionInput;
};

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

export async function createTimedMediaUnit(
	authorization: Authorization<string>,
	input: TimedMediaCreation,
): Promise<UnitDetail> {
	if (!authorization.authUserId) throw new AuthenticationRequired();
	const authUserId = authorization.authUserId;
	if (
		input.durationSeconds != null &&
		(!Number.isSafeInteger(input.durationSeconds) ||
			input.durationSeconds <= 0 ||
			input.durationSeconds > 2147483647)
	)
		throw new ValidationError({ details: { durationSeconds: "must be a positive integer" } });
	if (input.owner === "video" && input.adaptedAudioUnitIds?.length)
		await authorization.unit.ensureCanReadMany(input.adaptedAudioUnitIds);
	const id = await database.transaction(async (tx) => {
		await ensureAccountAuthenticationAllowed(authUserId, tx);
		await authorization.account.ensureCanWrite(tx);
		const [binding] = await tx
			.select({ id: authEntity.entityId })
			.from(authEntity)
			.where(
				and(
					eq(authEntity.authUserId, authUserId),
					eq(authEntity.entityId, authorization.profileId),
					eq(authEntity.state, "active"),
				),
			)
			.limit(1)
			.for("share");
		if (!binding) throw new AuthenticationRequired();
		await ensureImageAssetsAttachable(
			tx,
			authUserId,
			unitLocalizationImageAssetReferences(input.localization),
		);
		const created = await insertPlatformUnit(tx, {
			owner: input.owner,
			values: {
				createdByAuthUserId: authUserId,
				durationSeconds: input.durationSeconds,
				visibility: input.visibility,
				contentRating: input.contentRating,
				aiDisclosure: input.aiDisclosure,
			},
			statusActor: { kind: "profile", profileId: authorization.profileId },
		});
		await createProfileOwnedUnitAccess(tx, created.id, authorization.profileId);
		await tx
			.insert(unitLocalization)
			.values({ unitId: created.id, ...toUnitLocalizationStorage(input.localization) });
		if (input.owner === "video")
			await replaceAdaptedAudioUnitTracks(tx, created.id, input.adaptedAudioUnitIds);
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: authorization.profileId,
			contribution: input.revisionContribution,
			event: "create",
		});
		return created.id;
	});
	return getUnit(input.owner, id, authorization);
}

async function getUnitDetails(
	kind: ManageableUnitKind,
	unitId: string,
): Promise<UnitDetail["details"]> {
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
	throw new UnitNotFound(kind);
}

export async function getUnit(
	kind: ManageableUnitKind,
	unitId: string,
	authorization: Authorization,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<UnitDetail> {
	const canonicalUnitId = await resolveCanonicalUnitId(database, unitId);
	const unit = kind === "audio" ? audio : video;
	const [base] = await database
		.select()
		.from(unit)
		.where(and(eq(unit.id, canonicalUnitId), isNull(unit.deletedAt)))
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
					alwaysShowSpoilers: accountPreference.alwaysShowSpoilers,
					contentRatings: accountPreference.contentRatings,
				})
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, selfAuthUserIdForEntity(authorization.profileId)))
				.limit(1)
		: [];
	const subjectAssociationRows = await database
		.select({
			id: subjectAssociation.id,
			entityEntryId: subjectAssociation.entityId,
			entityKind: entityIdentity.shape,
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
		.innerJoin(entityIdentity, eq(entityIdentity.id, subjectAssociation.entityId))
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
		.innerJoin(accountPreference, eq(accountPreference.authUserId, unitProgress.authUserId))
		.where(
			and(
				eq(unitProgress.unitId, base.id),
				isNull(unitProgress.deletedAt),
				eq(accountPreference.progressVisibility, "public"),
				eq(unitProgress.visibility, "public"),
			),
		)
		.orderBy(unitProgress.authUserId)
		.limit(WorkPolicy.count.maxPublicProgressCountScan);
	const progressCountIsExact =
		visibleProgressRows.length < WorkPolicy.count.maxPublicProgressCountScan;
	const progressCount = (status: "active" | "backlog") => {
		const value = visibleProgressRows.filter((row) => row.status === status).length;
		return progressCountIsExact ? exactCount(value) : lowerBoundCount(value);
	};
	const variantContext = { role: "standalone" as const };
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
		Promise.resolve({ allowed: false as const, reason: "ungranted" as const }),
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
		releasedOn: null,
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
		versions: [],
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
	kind: TimedMediaUnitKind,
	cursor?: [string, string],
	limit = 20,
	localizationLanguages: readonly ContentLanguage[] = [],
	contentRatingPolicy: ContentRatingPolicy = DefaultContentRatingPolicy,
) {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
		throw new RangeError("Timed media pages require 1 through 100 items");
	const unit = kind === "audio" ? audio : video;
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
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				getContentRatingCondition(contentRatingPolicy, unit.contentRating),
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
	const unit = kind === "audio" ? audio : video;
	const hasAdaptedAudioUpdate = hasAdaptedAudioRelationUpdate(kind, body);
	const updatedAt = nextUnitUpdatedAt(body.expectedUpdatedAt);
	const [updated] = await tx
		.update(unit)
		.set({
			updatedAt,
			revision: sql`${unit.revision} + 1`,
			...toTimedMediaUpdateValues(body),
			visibility: body.visibility,
			contentRating: body.contentRating,
			aiDisclosure: body.aiDisclosure,
		})
		.where(
			and(eq(unit.id, unitId), isNull(unit.deletedAt), eq(unit.updatedAt, body.expectedUpdatedAt)),
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
	if (kind === "video" && hasAdaptedAudioUpdate)
		await replaceAdaptedAudioUnitTracks(tx, unitId, body.details?.adaptedAudioUnitIds);
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
	const revision = await recordUnitRevision(tx, {
		unitId,
		actorProfileId,
		contribution: body.revisionContribution,
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
		await authorization.unit.ensureInTransaction(tx, unitId, "unit.update", ["unit"]);
		if (body.status)
			await authorization.unit.ensureInTransaction(tx, unitId, "unit.status.update", ["unit"]);
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
			selfAuthUserIdForEntity(authorization.profileId),
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
