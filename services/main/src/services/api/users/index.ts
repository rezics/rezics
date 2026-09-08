import { DevelopmentPreviewCapability, PlatformCapabilityValues } from "@rezics/access";
import { parseLicenseId } from "@rezics/license";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";
import type { StaticDecode } from "typebox";
import { selfAuthUserIdForEntity } from "../../participation/account-query";

import session, { resolveIdentity } from "../../auth/session";
import { getProfileActivityReadCondition } from "../../authorization/profile-activity/query";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { contentRatingPolicyFromAllowlist } from "../../content-rating/policy";
import { database } from "../../database";
import {
	accountEntityBlock,
	accountPreference,
	score,
	unit,
	unitFollow,
	unitProgress,
} from "../../database/schema";
import {
	followUnit,
	getFollowingStatus,
	listFollowing,
	replaceFollowingSettings,
	unfollowUnit,
	updateFollowingPresentation,
} from "../../following/service";
import {
	publicEntityName,
	readPublicEntityProfile,
	updateEntityPresentation,
} from "../../participation/presentation";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { listStudioContent, recordStudioVisit } from "../../studio/service";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import {
	BlockResponse,
	FollowResponse,
	FollowingListResponse,
	FollowingPreferenceResponse,
	FollowingStatusResponse,
	UserBlockListResponse,
} from "../schema/action-response";
import {
	CurrentAccountResponse,
	EntityActivityResponse,
	PreferencesResponse,
	PrivacyPreferencesResponse,
	PublicEntityProfileResponse,
	toApiErrorResponse,
} from "../schema/response";
import { PreferencesNotFound, UserSelfBlockForbidden } from "./errors";
import {
	EntityActivityQuery,
	EntityPresentationQuery,
	FollowingListQuery,
	FollowingUnitParams,
	ReplaceFollowingSettingsBody,
	ReplacePreferencesBody,
	StudioContentListQuery,
	StudioContentListResponse,
	StudioResourceParams,
	StudioVisitResponse,
	UpdateDisplayPreferencesBody,
	UpdateEntityPresentationBody,
	UpdateFollowingBody,
	UpdatePrivacyPreferencesBody,
	UserIdParams,
	UserLookupParams,
	parseCollectionConfig,
} from "./schema";

const ProfileNotFoundResponse = toApiErrorResponse(["CatalogReferenceNotFound"]);
const ProfileMutationNotFoundResponse = toApiErrorResponse([
	"CatalogReferenceNotFound",
	"ImageAssetNotFound",
]);
const UnitForbiddenResponse = toApiErrorResponse(["ParticipationDenied"]);

function presentPreferences(preference: typeof accountPreference.$inferSelect) {
	return {
		interfaceLocale: preference.interfaceLocale,
		chineseContentDisplay: preference.chineseContentDisplay,
		defaultLicenses: preference.defaultLicenses.map(parseLicenseId),
		defaultRealmManageMode: preference.defaultRealmManageMode,
		defaultScoreRealmId: preference.defaultScoreRealmId ?? OfficialRealmUnitIds.score,
		scoreVisibility: preference.scoreVisibility,
		progressVisibility: preference.progressVisibility,
		collectionConfig: parseCollectionConfig(preference.collectionConfig),
		personalizedFeed: preference.personalizedFeed,
		customThemesEnabled: preference.customThemesEnabled,
		filterFeedByPreferredLanguages: preference.filterFeedByPreferredLanguages,
		alwaysShowSpoilers: preference.alwaysShowSpoilers,
		alwaysShowNsfw: preference.alwaysShowNsfw,
		contentRatings: preference.contentRatings,
		preferredLanguages: preference.preferredLanguages,
	};
}

const activityScoreTargetUnit = alias(unit, "profile_activity_score_target_unit");
const activityScoreRealm = alias(unit, "profile_activity_score_realm");
const activityProgressTargetUnit = alias(unit, "profile_activity_progress_target_unit");

export default new Elysia({ name: "account-entity-api" })
	.use(session)
	.get(
		"/account/me",
		{
			access: "account:read",
			query: EntityPresentationQuery,
			response: {
				[StatusCodes.OK]: CurrentAccountResponse,
				[StatusCodes.NOT_FOUND]: ProfileNotFoundResponse,
			},
			detail: { summary: "Current user profile", tags: ["Users"] },
		},
		async ({ authorization, entity, query, user, principal, authorizationRevision }) => {
			const [platformCapabilities, publicEntity] = await Promise.all([
				authorization.platform.decideCapabilities(PlatformCapabilityValues),
				readPublicEntityProfile(entity.id, query.localizationLanguages),
			]);
			return {
				entity: publicEntity,
				email: user.email,
				emailVerified: user.emailVerified,
				onboarding: user.emailVerified ? "complete" : "verify_email",
				principal,
				authorizationRevision,
				platformCapabilities: PlatformCapabilityValues.filter(
					(capability) => platformCapabilities.get(capability) ?? false,
				),
			};
		},
	)
	.get(
		"/account/me/studio",
		{
			access: "account:read",
			query: StudioContentListQuery,
			response: {
				[StatusCodes.OK]: StudioContentListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["StudioRealmSubjectLimitExceeded"]),
			},
			detail: {
				operationId: "listCurrentUserStudioContent",
				summary: "List current user's actionable Studio workspace resources",
				tags: ["Users", "Studio"],
			},
		},
		async ({ authorization, entity, query }) => {
			let includeDevelopmentPreview = false;
			if (query.section === "zone") {
				await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
				includeDevelopmentPreview = true;
			} else if (!query.section) {
				includeDevelopmentPreview = await authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
			}
			return listStudioContent({
				profileId: entity.id,
				query,
				includeDevelopmentPreview,
			});
		},
	)
	.put(
		"/account/me/studio/:unitId/visit",
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
		async ({ authorization, user, params }) =>
			recordStudioVisit({
				authUserId: user.id,
				unitId: params.unitId,
				authorization: authorization.unit,
			}),
	)
	.patch(
		"/account/me",
		{
			access: "write:unit:update",
			body: UpdateEntityPresentationBody,
			response: {
				[StatusCodes.OK]: PublicEntityProfileResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: UnitForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProfileMutationNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["CatalogRevisionConflict"]),
			},
			detail: { summary: "Update current profile", tags: ["Users"] },
		},
		async ({ entity, principal, authorizationRevision, body }) => {
			await database.transaction((tx) =>
				updateEntityPresentation(
					tx,
					{ principal, actingEntityId: entity.id, authorizationRevision },
					body,
				),
			);
			return readPublicEntityProfile(entity.id, [body.language]);
		},
	)
	.get(
		"/account/me/preferences",
		{
			access: "account:read",
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Current user preferences", tags: ["Users"] },
		},
		async ({ user }) => {
			const [preference] = await database
				.select()
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, user.id))
				.limit(1);
			if (!preference) throw new PreferencesNotFound();
			return presentPreferences(preference);
		},
	)
	.patch(
		"/account/me/privacy",
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
		async ({ user, body }) => {
			const [preference] = await database
				.update(accountPreference)
				.set({
					...(body.scoreVisibility === undefined ? {} : { scoreVisibility: body.scoreVisibility }),
					...(body.progressVisibility === undefined
						? {}
						: { progressVisibility: body.progressVisibility }),
				})
				.where(eq(accountPreference.authUserId, user.id))
				.returning({
					scoreVisibility: accountPreference.scoreVisibility,
					progressVisibility: accountPreference.progressVisibility,
				});
			if (!preference) throw new PreferencesNotFound();
			return preference;
		},
	)
	.patch(
		"/account/me/preferences",
		{
			access: "account:update",
			body: UpdateDisplayPreferencesBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Update current user display preferences", tags: ["Users"] },
		},
		async ({ user, body }) => {
			const [preference] = await database
				.update(accountPreference)
				.set({
					...(body.interfaceLocale === undefined ? {} : { interfaceLocale: body.interfaceLocale }),
					...(body.chineseContentDisplay === undefined
						? {}
						: { chineseContentDisplay: body.chineseContentDisplay }),
					...(body.alwaysShowSpoilers === undefined
						? {}
						: { alwaysShowSpoilers: body.alwaysShowSpoilers }),
					...(body.alwaysShowNsfw === undefined ? {} : { alwaysShowNsfw: body.alwaysShowNsfw }),
					...(body.customThemesEnabled === undefined
						? {}
						: { customThemesEnabled: body.customThemesEnabled }),
				})
				.where(eq(accountPreference.authUserId, user.id))
				.returning();
			if (!preference) throw new PreferencesNotFound();
			return presentPreferences(preference);
		},
	)
	.put(
		"/account/me/preferences",
		{
			access: "write:account:update",
			body: ReplacePreferencesBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"ParticipationDenied",
					"RealmCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Replace current user preferences", tags: ["Users"] },
		},
		async ({ user, authorization, body }) => {
			await authorization.realm.ensureParticipation(body.defaultScoreRealmId);
			return database.transaction(async (tx) => {
				const [preference] = await tx
					.update(accountPreference)
					.set({
						interfaceLocale: body.interfaceLocale,
						chineseContentDisplay: body.chineseContentDisplay,
						defaultLicenses: body.defaultLicenses,
						defaultRealmManageMode: body.defaultRealmManageMode,
						defaultScoreRealmId: body.defaultScoreRealmId,
						collectionConfig: body.collectionConfig,
						personalizedFeed: body.personalizedFeed,
						customThemesEnabled: body.customThemesEnabled,
						filterFeedByPreferredLanguages: body.filterFeedByPreferredLanguages,
						alwaysShowSpoilers: body.alwaysShowSpoilers,
						alwaysShowNsfw: body.alwaysShowNsfw,
						contentRatings: body.contentRatings,
						preferredLanguages: body.preferredLanguages,
					})
					.where(eq(accountPreference.authUserId, user.id))
					.returning();
				if (!preference) throw new PreferencesNotFound();
				return presentPreferences(preference);
			});
		},
	)
	.get(
		"/account/me/following",
		{
			access: "interaction:read",
			query: FollowingListQuery,
			response: {
				[StatusCodes.OK]: FollowingListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
			},
			detail: { summary: "List Units followed by the current user", tags: ["Users"] },
		},
		async ({ user, entity, query }) => {
			const viewer = await resolveRecommendationViewer(entity.id, false);
			return listFollowing({
				authUserId: user.id,
				followerProfileId: entity.id,
				kind: query.kind,
				localizationLanguages: query.localizationLanguages,
				cursor: query.cursor,
				limit: query.limit ?? 30,
				contentRatingPolicy: contentRatingPolicyFromAllowlist(viewer.contentRatings),
			});
		},
	)
	.get(
		"/account/me/following/:unitId",
		{
			access: "interaction:read",
			params: FollowingUnitParams,
			response: {
				[StatusCodes.OK]: FollowingStatusResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Get current user's follow state for a Unit", tags: ["Users"] },
		},
		async ({ user, entity, authorization, params }) =>
			getFollowingStatus({
				authUserId: user.id,
				followerProfileId: entity.id,
				unitId: params.unitId,
				authorization: authorization.unit,
			}),
	)
	.put(
		"/account/me/following/:unitId/settings",
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
		async ({ user, entity, authorization, params, body }) =>
			replaceFollowingSettings({
				authUserId: user.id,
				followerProfileId: entity.id,
				unitId: params.unitId,
				authorization: authorization.unit,
				settings: body,
			}),
	)
	.put(
		"/account/me/following/:unitId",
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
		async ({ user, entity, authorization, params }) =>
			followUnit({
				authUserId: user.id,
				followerProfileId: entity.id,
				unitId: params.unitId,
				authorization: authorization.unit,
			}),
	)
	.delete(
		"/account/me/following/:unitId",
		{
			access: "write:interaction:write",
			params: FollowingUnitParams,
			response: { [StatusCodes.OK]: FollowResponse },
			detail: { summary: "Unfollow a Unit", tags: ["Users"] },
		},
		async ({ user, entity, params }) => unfollowUnit(user.id, entity.id, params.unitId),
	)
	.patch(
		"/account/me/following/:unitId",
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
		async ({ user, entity, params, body }) =>
			updateFollowingPresentation(user.id, entity.id, params.unitId, body),
	)
	.get(
		"/entities/:id/activity",
		{
			params: UserLookupParams,
			query: EntityActivityQuery,
			response: {
				[StatusCodes.OK]: EntityActivityResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: {
				operationId: "getUserProfileActivity",
				summary: "Get visible Score and Progress activity for a public Profile",
				tags: ["Users"],
			},
		},
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const viewerProfileId = identity.entity?.id;
			const referencedUnitReadOptions = {
				discoverableOnly: viewerProfileId !== params.id,
			};
			await readPublicEntityProfile(params.id, query.localizationLanguages);
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
					.innerJoin(
						accountPreference,
						eq(accountPreference.authUserId, selfAuthUserIdForEntity(score.profileId)),
					)
					.innerJoin(activityScoreTargetUnit, eq(activityScoreTargetUnit.id, score.unitId))
					.innerJoin(activityScoreRealm, eq(activityScoreRealm.id, score.realmId))
					.where(
						and(
							eq(score.profileId, params.id),
							getProfileActivityReadCondition({
								ownerProfileId: score.profileId,
								categoryVisibility: accountPreference.scoreVisibility,
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
					.innerJoin(accountPreference, eq(accountPreference.authUserId, unitProgress.authUserId))
					.innerJoin(
						activityProgressTargetUnit,
						eq(activityProgressTargetUnit.id, unitProgress.unitId),
					)
					.where(
						and(
							eq(unitProgress.authUserId, selfAuthUserIdForEntity(params.id)),
							isNull(unitProgress.deletedAt),
							getProfileActivityReadCondition({
								ownerProfileId: sql`${params.id}::uuid`,
								categoryVisibility: accountPreference.progressVisibility,
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
			return { scores, progress } satisfies StaticDecode<typeof EntityActivityResponse>;
		},
	)
	.get(
		"/entities/:id/profile",
		{
			params: UserLookupParams,
			query: EntityPresentationQuery,
			response: {
				[StatusCodes.OK]: PublicEntityProfileResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "Public user profile", tags: ["Users"] },
		},
		async ({ params, query }) => readPublicEntityProfile(params.id, query.localizationLanguages),
	)
	.get(
		"/account/me/blocks",
		{
			access: "interaction:read",
			response: { [StatusCodes.OK]: UserBlockListResponse },
			detail: { summary: "List blocked users", tags: ["Users"] },
		},
		async ({ user }) => ({
			items: await database
				.select({
					entityId: accountEntityBlock.blockedEntityId,
					name: publicEntityName(accountEntityBlock.blockedEntityId),
					createdAt: accountEntityBlock.createdAt,
				})
				.from(accountEntityBlock)

				.where(eq(accountEntityBlock.blockerAuthUserId, user.id))
				.orderBy(accountEntityBlock.createdAt, accountEntityBlock.blockedEntityId),
		}),
	)
	.put(
		"/account/blocks/:id",
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
		async ({ entity, user, params }) => {
			if (params.id === entity.id) throw new UserSelfBlockForbidden();
			await readPublicEntityProfile(params.id);
			await database.transaction(async (tx) => {
				await tx
					.insert(accountEntityBlock)
					.values({ blockerAuthUserId: user.id, blockedEntityId: params.id })
					.onConflictDoNothing();
				await tx
					.delete(unitFollow)
					.where(
						or(
							and(eq(unitFollow.followerProfileId, entity.id), eq(unitFollow.unitId, params.id)),
							and(eq(unitFollow.followerProfileId, params.id), eq(unitFollow.unitId, entity.id)),
						),
					);
			});
			return { blocked: true };
		},
	)
	.delete(
		"/account/blocks/:id",
		{
			access: "write:interaction:write",
			params: UserIdParams,
			response: { [StatusCodes.OK]: BlockResponse },
			detail: { summary: "Unblock user", tags: ["Users"] },
		},
		async ({ user, params }) => {
			await database.transaction(async (tx) => {
				await tx
					.delete(accountEntityBlock)
					.where(
						and(
							eq(accountEntityBlock.blockerAuthUserId, user.id),
							eq(accountEntityBlock.blockedEntityId, params.id),
						),
					);
			});
			return { blocked: false };
		},
	);
