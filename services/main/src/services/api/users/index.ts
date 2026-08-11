import { DevelopmentPreviewCapability, PlatformCapabilityValues } from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia from "elysia";
import { parseNullablePublicationLicenseId } from "@rezics/license";
import { OfficialRealmUnitIds } from "@rezics/slug";

import session, { resolveIdentity } from "../../auth/session";
import { contentRatingPolicyFromAllowlist } from "../../content-rating/policy";
import { database } from "../../database";
import {
	avatarReferenceToColumns,
	isFirstUnitLocalization,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	unit,
	profile as profileTable,
	profileBlock,
	score,
	unitFollow,
	profilePreference,
	unitLocalization,
	unitProgress,
} from "../../database/schema";
import { getProfileActivityReadCondition } from "../../authorization/profile-activity/query";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { presentUnitLocalization } from "../../units/service";
import { assignCurrentProfileSlugAddress } from "../../units/slug-address";
import {
	BlockResponse,
	FollowResponse,
	FollowingListResponse,
	FollowingPreferenceResponse,
	FollowingStatusResponse,
	UserBlockListResponse,
} from "../schema/action-response";
import {
	toApiErrorResponse,
	CurrentProfileResponse,
	PreferencesResponse,
	PrivacyPreferencesResponse,
	ProfileActivityResponse,
	PublicProfileResponse,
} from "../schema/response";
import { PublicSlugAddressResponse } from "../slug-addresses/schema";
import {
	AssignCurrentProfileSlugBody,
	ReplacePreferencesBody,
	parseCollectionConfig,
	FollowingListQuery,
	FollowingUnitParams,
	StudioContentListQuery,
	StudioContentListResponse,
	StudioResourceParams,
	StudioVisitResponse,
	UpdateDisplayPreferencesBody,
	UpdateProfileBody,
	UpdateFollowingBody,
	UserIdParams,
	UserLookupParams,
	PublicProfileQuery,
	ProfileActivityQuery,
	ReplaceFollowingSettingsBody,
	UpdatePrivacyPreferencesBody,
} from "./schema";
import { getProfile, presentProfile, publicProfileSelection } from "./service";
import {
	followUnit,
	getFollowingStatus,
	listFollowing,
	replaceFollowingSettings,
	unfollowUnit,
	updateFollowingPresentation,
} from "../../following/service";
import { listStudioContent, recordStudioVisit } from "../../studio/service";
import { resolveRecommendationViewer } from "../../recommendations/context";
import {
	PreferencesNotFound,
	ProfileChanged,
	ProfileNotFound,
	UserNotFound,
	UserSelfBlockForbidden,
} from "./errors";

const ProfileNotFoundResponse = toApiErrorResponse(["ProfileNotFound"]);
const ProfileMutationNotFoundResponse = toApiErrorResponse([
	"ProfileNotFound",
	"ImageAssetNotFound",
]);
const UnitForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);

function presentPreferences(preference: typeof profilePreference.$inferSelect) {
	return {
		profileId: preference.profileId,
		interfaceLocale: preference.interfaceLocale,
		chineseContentDisplay: preference.chineseContentDisplay,
		defaultLicense: parseNullablePublicationLicenseId(preference.defaultLicense),
		defaultRealmManageMode: preference.defaultRealmManageMode,
		defaultScoreRealmId: preference.defaultScoreRealmId ?? OfficialRealmUnitIds.score,
		scoreVisibility: preference.scoreVisibility,
		progressVisibility: preference.progressVisibility,
		collectionConfig: parseCollectionConfig(preference.collectionConfig),
		personalizedFeed: preference.personalizedFeed,
		filterFeedByPreferredLanguages: preference.filterFeedByPreferredLanguages,
		contentRatings: preference.contentRatings,
		preferredLanguages: preference.preferredLanguages,
	};
}

const activityScoreTargetUnit = alias(unit, "profile_activity_score_target_unit");
const activityScoreRealm = alias(unit, "profile_activity_score_realm");
const activityProgressTargetUnit = alias(unit, "profile_activity_progress_target_unit");

export default new Elysia({ prefix: "/users" })
	.use(session)
	.get(
		"/me",
		async ({ authorization, profile, query, user }) => {
			const [platformCapabilities, currentProfile, localizations] = await Promise.all([
				authorization.platform.decideCapabilities(PlatformCapabilityValues),
				getProfile(profile.unitId, query.localizationLanguages),
				database
					.select()
					.from(unitLocalization)
					.where(eq(unitLocalization.unitId, profile.unitId))
					.orderBy(unitLocalization.position, unitLocalization.language),
			]);
			return {
				...currentProfile,
				localizations: localizations.map(presentUnitLocalization),
				email: user.email,
				emailVerified: user.emailVerified,
				onboarding: user.emailVerified ? "complete" : "verify_email",
				platformCapabilities: PlatformCapabilityValues.filter(
					(capability) => platformCapabilities.get(capability) ?? false,
				),
			};
		},
		{
			access: "profile:read",
			query: PublicProfileQuery,
			response: {
				[StatusCodes.OK]: CurrentProfileResponse,
				[StatusCodes.NOT_FOUND]: ProfileNotFoundResponse,
			},
			detail: { summary: "Current user profile", tags: ["Users"] },
		},
	)
	.put(
		"/me/profile-slug",
		async ({ body, profile }) => assignCurrentProfileSlugAddress(profile.unitId, body),
		{
			access: "session-only",
			body: AssignCurrentProfileSlugBody,
			response: {
				[StatusCodes.OK]: PublicSlugAddressResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["InteractiveSessionRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ProfileSlugChangeUnavailable", "SlugTaken"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"SlugReserved",
					"SlugDepthExceeded",
				]),
			},
			detail: {
				operationId: "assignCurrentProfileSlug",
				summary: "Assign the current Profile slug once",
				description:
					"Temporary first-party endpoint. An interactive signed-in user may assign their own Profile slug once without an additional permission. Reserved labels are rejected, and only an idempotent repeat is accepted after assignment.",
				tags: ["Users", "First-party Preview"],
			},
		},
	)
	.get(
		"/me/studio",
		async ({ authorization, profile, query }) => {
			if (query.section === "zone")
				await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			return listStudioContent({
				profileId: profile.unitId,
				authorization: authorization.unit,
				query,
			});
		},
		{
			access: "profile:read",
			query: StudioContentListQuery,
			response: {
				[StatusCodes.OK]: StudioContentListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
			},
			detail: {
				operationId: "listCurrentUserStudioContent",
				summary: "List current user's Studio work resources",
				tags: ["Users", "Studio"],
			},
		},
	)
	.put(
		"/me/studio/:unitId/visit",
		async ({ authorization, profile, params }) =>
			recordStudioVisit({
				profileId: profile.unitId,
				unitId: params.unitId,
				authorization: authorization.unit,
			}),
		{
			access: "write:interaction:write",
			params: StudioResourceParams,
			response: {
				[StatusCodes.OK]: StudioVisitResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				operationId: "recordCurrentUserStudioVisit",
				summary: "Record a Studio resource visit",
				tags: ["Users", "Studio"],
			},
		},
	)
	.patch(
		"/me",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [["localizations", body.language]]);
			await database.transaction(async (tx) => {
				await ensureImageAssetsAttachable(
					tx,
					profile.unitId,
					unitLocalizationImageAssetReferences(body),
				);
				const [current] = await tx
					.select({ id: profileTable.id })
					.from(profileTable)
					.where(eq(profileTable.id, profile.unitId))
					.limit(1);
				if (!current) throw new ProfileNotFound();
				const [updated] = await tx
					.update(unit)
					.set({ updatedAt: new Date() })
					.where(
						and(
							eq(unit.id, profile.unitId),
							eq(unit.kind, "profile"),
							eq(unit.updatedAt, new Date(body.updatedAt)),
						),
					)
					.returning({ id: unit.id });
				if (!updated) {
					const [latest] = await tx
						.select({ updatedAt: unit.updatedAt })
						.from(unit)
						.where(eq(unit.id, profile.unitId))
						.limit(1);
					if (!latest) throw new ProfileNotFound();
					throw new ProfileChanged(latest.updatedAt);
				}
				await tx
					.insert(unitLocalization)
					.values({
						unitId: profile.unitId,
						language: body.language,
						title: body.name,
						summary: body.summary,
						description: body.description,
						...avatarReferenceToColumns(body.avatar ?? null),
						bannerAssetId: body.bannerAssetId ?? null,
					})
					.onConflictDoUpdate({
						target: [unitLocalization.unitId, unitLocalization.language],
						set: {
							title: body.name,
							summary: body.summary,
							description: body.description,
							...(Object.hasOwn(body, "avatar")
								? avatarReferenceToColumns(body.avatar ?? null)
								: {}),
							...(Object.hasOwn(body, "bannerAssetId")
								? { bannerAssetId: body.bannerAssetId }
								: {}),
						},
					});
				await recordUnitRevision(tx, {
					unitId: profile.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return getProfile(profile.unitId, [body.language]);
		},
		{
			access: "write:unit:update",
			body: UpdateProfileBody,
			response: {
				[StatusCodes.OK]: PublicProfileResponse,
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProfileMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ProfileChanged"]),
			},
			detail: { summary: "Update current profile", tags: ["Users"] },
		},
	)
	.get(
		"/me/preferences",
		async ({ profile }) => {
			const [preference] = await database
				.select()
				.from(profilePreference)
				.where(eq(profilePreference.profileId, profile.unitId))
				.limit(1);
			if (!preference) throw new PreferencesNotFound();
			return presentPreferences(preference);
		},
		{
			access: "profile:read",
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Current user preferences", tags: ["Users"] },
		},
	)
	.patch(
		"/me/privacy",
		async ({ profile, body }) => {
			const [preference] = await database
				.update(profilePreference)
				.set({
					...(body.scoreVisibility === undefined ? {} : { scoreVisibility: body.scoreVisibility }),
					...(body.progressVisibility === undefined
						? {}
						: { progressVisibility: body.progressVisibility }),
				})
				.where(eq(profilePreference.profileId, profile.unitId))
				.returning({
					scoreVisibility: profilePreference.scoreVisibility,
					progressVisibility: profilePreference.progressVisibility,
				});
			if (!preference) throw new PreferencesNotFound();
			return preference;
		},
		{
			access: "session-only",
			body: UpdatePrivacyPreferencesBody,
			response: {
				[StatusCodes.OK]: PrivacyPreferencesResponse,
				[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["InteractiveSessionRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: {
				operationId: "updateCurrentUserPrivacy",
				summary: "Update current user's Score and Progress privacy",
				tags: ["Users", "First-party Preview"],
			},
		},
	)
	.patch(
		"/me/preferences",
		async ({ profile, body }) => {
			const [preference] = await database
				.update(profilePreference)
				.set({
					...(body.interfaceLocale === undefined ? {} : { interfaceLocale: body.interfaceLocale }),
					...(body.chineseContentDisplay === undefined
						? {}
						: { chineseContentDisplay: body.chineseContentDisplay }),
				})
				.where(eq(profilePreference.profileId, profile.unitId))
				.returning();
			if (!preference) throw new PreferencesNotFound();
			return presentPreferences(preference);
		},
		{
			access: "profile:update",
			body: UpdateDisplayPreferencesBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Update current user display preferences", tags: ["Users"] },
		},
	)
	.put(
		"/me/preferences",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [["preferences"]]);
			await authorization.realm.ensureParticipation(body.defaultScoreRealmId);
			return database.transaction(async (tx) => {
				const [preference] = await tx
					.update(profilePreference)
					.set({
						interfaceLocale: body.interfaceLocale,
						chineseContentDisplay: body.chineseContentDisplay,
						defaultLicense: body.defaultLicense,
						defaultRealmManageMode: body.defaultRealmManageMode,
						defaultScoreRealmId: body.defaultScoreRealmId,
						collectionConfig: body.collectionConfig,
						personalizedFeed: body.personalizedFeed,
						filterFeedByPreferredLanguages: body.filterFeedByPreferredLanguages,
						contentRatings: body.contentRatings,
						preferredLanguages: body.preferredLanguages,
					})
					.where(eq(profilePreference.profileId, profile.unitId))
					.returning();
				if (!preference) throw new PreferencesNotFound();
				return presentPreferences(preference);
			});
		},
		{
			access: "write:profile:update",
			body: ReplacePreferencesBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"RealmCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Replace current user preferences", tags: ["Users"] },
		},
	)
	.get(
		"/me/following",
		async ({ profile, query }) => {
			const viewer = await resolveRecommendationViewer(profile.unitId, false);
			return listFollowing({
				followerProfileId: profile.unitId,
				kind: query.kind,
				localizationLanguages: query.localizationLanguages,
				cursor: query.cursor,
				limit: query.limit ?? 30,
				contentRatingPolicy: contentRatingPolicyFromAllowlist(viewer.contentRatings),
			});
		},
		{
			access: "interaction:read",
			query: FollowingListQuery,
			response: {
				[StatusCodes.OK]: FollowingListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
			},
			detail: { summary: "List Units followed by the current user", tags: ["Users"] },
		},
	)
	.get(
		"/me/following/:unitId",
		async ({ profile, authorization, params }) =>
			getFollowingStatus({
				followerProfileId: profile.unitId,
				unitId: params.unitId,
				authorization: authorization.unit,
			}),
		{
			access: "interaction:read",
			params: FollowingUnitParams,
			response: {
				[StatusCodes.OK]: FollowingStatusResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Get current user's follow state for a Unit", tags: ["Users"] },
		},
	)
	.put(
		"/me/following/:unitId/settings",
		async ({ profile, authorization, params, body }) =>
			replaceFollowingSettings({
				followerProfileId: profile.unitId,
				unitId: params.unitId,
				authorization: authorization.unit,
				settings: body,
			}),
		{
			access: "write:interaction:write",
			params: FollowingUnitParams,
			body: ReplaceFollowingSettingsBody,
			response: {
				[StatusCodes.OK]: FollowingStatusResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["FollowingTargetKindMismatch"]),
			},
			detail: {
				summary: "Replace notification and personalization settings for a followed Unit",
				tags: ["Users"],
			},
		},
	)
	.put(
		"/me/following/:unitId",
		async ({ profile, authorization, params }) =>
			followUnit({
				followerProfileId: profile.unitId,
				unitId: params.unitId,
				authorization: authorization.unit,
			}),
		{
			access: "contribute:interaction:write",
			params: FollowingUnitParams,
			response: {
				[StatusCodes.OK]: FollowResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UserSelfFollowForbidden",
					"UserFollowBlocked",
				]),
			},
			detail: { summary: "Follow a Unit", tags: ["Users"] },
		},
	)
	.delete(
		"/me/following/:unitId",
		async ({ profile, params }) => unfollowUnit(profile.unitId, params.unitId),
		{
			access: "write:interaction:write",
			params: FollowingUnitParams,
			response: { [StatusCodes.OK]: FollowResponse },
			detail: { summary: "Unfollow a Unit", tags: ["Users"] },
		},
	)
	.patch(
		"/me/following/:unitId",
		async ({ profile, params, body }) =>
			updateFollowingPresentation(profile.unitId, params.unitId, body),
		{
			access: "write:interaction:write",
			params: FollowingUnitParams,
			body: UpdateFollowingBody,
			response: {
				[StatusCodes.OK]: FollowingPreferenceResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Update followed Unit presentation", tags: ["Users"] },
		},
	)
	.get(
		"/:id/activity",
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const viewerProfileId = identity.profile?.unitId;
			const referencedUnitReadOptions = {
				discoverableOnly: viewerProfileId !== params.id,
			};
			const [owner] = await database
				.select({ id: profileTable.id })
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.where(
					and(
						eq(profileTable.id, params.id),
						eq(unit.kind, "profile"),
						getUnitReadCondition(viewerProfileId, referencedUnitReadOptions),
					),
				)
				.limit(1);
			if (!owner) throw new UserNotFound();
			const localizationLanguages = query.localizationLanguages ?? [];
			const limit = query.limit ?? 20;
			const [scores, progress] = await Promise.all([
				database
					.select({
						scoreId: score.id,
						unitId: score.unitId,
						unitKind: activityScoreTargetUnit.kind,
						unitLanguage: resolvedUnitLocalizationLanguage(
							activityScoreTargetUnit.id,
							localizationLanguages,
						),
						unitTitle: resolvedUnitLocalizationTitle(
							activityScoreTargetUnit.id,
							localizationLanguages,
						),
						realmId: score.realmId,
						realmTitle: resolvedUnitLocalizationTitle(activityScoreRealm.id, localizationLanguages),
						value: score.value,
						visibility: score.visibility,
						updatedAt: score.updatedAt,
					})
					.from(score)
					.innerJoin(profilePreference, eq(profilePreference.profileId, score.profileId))
					.innerJoin(activityScoreTargetUnit, eq(activityScoreTargetUnit.id, score.unitId))
					.innerJoin(activityScoreRealm, eq(activityScoreRealm.id, score.realmId))
					.where(
						and(
							eq(score.profileId, params.id),
							getProfileActivityReadCondition({
								ownerProfileId: score.profileId,
								categoryVisibility: profilePreference.scoreVisibility,
								itemVisibility: score.visibility,
								viewerProfileId,
								surface: "profile",
							}),
							getUnitReadCondition(
								viewerProfileId,
								referencedUnitReadOptions,
								activityScoreTargetUnit,
							),
							getUnitReadCondition(viewerProfileId, referencedUnitReadOptions, activityScoreRealm),
						),
					)
					.orderBy(desc(score.updatedAt), desc(score.id))
					.limit(limit),
				database
					.select({
						unitId: unitProgress.unitId,
						unitKind: activityProgressTargetUnit.kind,
						unitLanguage: resolvedUnitLocalizationLanguage(
							activityProgressTargetUnit.id,
							localizationLanguages,
						),
						unitTitle: resolvedUnitLocalizationTitle(
							activityProgressTargetUnit.id,
							localizationLanguages,
						),
						status: unitProgress.status,
						progress: unitProgress.progress,
						completedCount: unitProgress.completedCount,
						visibility: unitProgress.visibility,
						lastSeenAt: unitProgress.lastSeenAt,
					})
					.from(unitProgress)
					.innerJoin(profilePreference, eq(profilePreference.profileId, unitProgress.profileId))
					.innerJoin(
						activityProgressTargetUnit,
						eq(activityProgressTargetUnit.id, unitProgress.unitId),
					)
					.where(
						and(
							eq(unitProgress.profileId, params.id),
							isNull(unitProgress.deletedAt),
							getProfileActivityReadCondition({
								ownerProfileId: unitProgress.profileId,
								categoryVisibility: profilePreference.progressVisibility,
								itemVisibility: unitProgress.visibility,
								viewerProfileId,
								surface: "profile",
							}),
							getUnitReadCondition(
								viewerProfileId,
								referencedUnitReadOptions,
								activityProgressTargetUnit,
							),
						),
					)
					.orderBy(desc(unitProgress.lastSeenAt), desc(unitProgress.unitId))
					.limit(limit),
			]);
			return { scores, progress } satisfies typeof ProfileActivityResponse.static;
		},
		{
			params: UserLookupParams,
			query: ProfileActivityQuery,
			response: {
				[StatusCodes.OK]: ProfileActivityResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: {
				operationId: "getUserProfileActivity",
				summary: "Get visible Score and Progress activity for a public Profile",
				tags: ["Users"],
			},
		},
	)
	.get(
		"/:id",
		async ({ params, query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const [result] = await database
				.select(publicProfileSelection(localizationLanguages))
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, profileTable.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(profileTable.id, localizationLanguages),
						),
					),
				)
				.where(
					and(
						eq(unit.id, params.id),
						eq(unit.kind, "profile"),
						eq(unit.status, "published"),
						eq(unit.visibility, "public"),
					),
				)
				.limit(1);
			if (!result) throw new UserNotFound();
			const viewer = (await resolveIdentity(request, "unit:read")).profile;
			const following = viewer
				? Boolean(
						(
							await database
								.select({ id: unitFollow.unitId })
								.from(unitFollow)
								.where(
									and(
										eq(unitFollow.followerProfileId, viewer.unitId),
										eq(unitFollow.unitId, result.id),
									),
								)
								.limit(1)
						)[0],
					)
				: false;
			return { ...(await presentProfile(result)), viewerFollowing: following };
		},
		{
			params: UserLookupParams,
			query: PublicProfileQuery,
			response: {
				[StatusCodes.OK]: PublicProfileResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "Public user profile", tags: ["Users"] },
		},
	)
	.get(
		"/me/blocks",
		async ({ profile }) => ({
			items: await database
				.select({
					userId: profileBlock.blockedProfileId,
					name: unitLocalization.title,
					createdAt: profileBlock.createdAt,
				})
				.from(profileBlock)
				.innerJoin(profileTable, eq(profileTable.id, profileBlock.blockedProfileId))
				.leftJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, profileTable.id),
						isFirstUnitLocalization(unitLocalization.unitId),
					),
				)
				.where(eq(profileBlock.blockerProfileId, profile.unitId))
				.orderBy(profileBlock.createdAt, profileBlock.blockedProfileId),
		}),
		{
			access: "interaction:read",
			response: { [StatusCodes.OK]: UserBlockListResponse },
			detail: { summary: "List blocked users", tags: ["Users"] },
		},
	)
	.put(
		"/:id/block",
		async ({ profile, authorization, params }) => {
			if (params.id === profile.unitId) throw new UserSelfBlockForbidden();
			await authorization.unit.ensureCanRead(params.id, () => new UnitNotFound("User"));
			await database.transaction(async (tx) => {
				await tx
					.insert(profileBlock)
					.values({ blockerProfileId: profile.unitId, blockedProfileId: params.id })
					.onConflictDoNothing();
				await tx
					.delete(unitFollow)
					.where(
						or(
							and(
								eq(unitFollow.followerProfileId, profile.unitId),
								eq(unitFollow.unitId, params.id),
							),
							and(
								eq(unitFollow.followerProfileId, params.id),
								eq(unitFollow.unitId, profile.unitId),
							),
						),
					);
			});
			return { blocked: true };
		},
		{
			access: "write:interaction:write",
			params: UserIdParams,
			response: {
				[StatusCodes.OK]: BlockResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UserSelfBlockForbidden"]),
			},
			detail: { summary: "Block user", tags: ["Users"] },
		},
	)
	.delete(
		"/:id/block",
		async ({ profile, params }) => {
			await database.transaction(async (tx) => {
				await tx
					.delete(profileBlock)
					.where(
						and(
							eq(profileBlock.blockerProfileId, profile.unitId),
							eq(profileBlock.blockedProfileId, params.id),
						),
					);
			});
			return { blocked: false };
		},
		{
			access: "write:interaction:write",
			params: UserIdParams,
			response: { [StatusCodes.OK]: BlockResponse },
			detail: { summary: "Unblock user", tags: ["Users"] },
		},
	);
