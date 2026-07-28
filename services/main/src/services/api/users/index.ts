import { DevelopmentPreviewCapability, PlatformCapabilityValues } from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import { and, eq, or } from "drizzle-orm";
import Elysia from "elysia";
import { parseNullablePublicationLicenseId } from "@rezics/license";
import { OfficialRealmUnitIds } from "@rezics/slug";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import {
	avatarReferenceToColumns,
	isFirstUnitLocalization,
	resolvedUnitLocalizationLanguage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	unit,
	profile as profileTable,
	profileBlock,
	unitFollow,
	profilePreference,
	unitLocalization,
} from "../../database/schema";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { ensureScoreContextParticipation } from "../../scores/context";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
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
	PublicProfileResponse,
} from "../schema/response";
import {
	ReplacePreferencesBody,
	parseCollectionConfig,
	FollowingListQuery,
	FollowingUnitParams,
	StudioContentListQuery,
	StudioContentListResponse,
	StudioResourceParams,
	StudioVisitResponse,
	UpdateInterfaceLocaleBody,
	UpdateProfileBody,
	UpdateFollowingBody,
	UserIdParams,
	UserLookupParams,
	PublicProfileQuery,
} from "./schema";
import { getProfile, presentProfile, PublicProfileSelection } from "./service";
import {
	followUnit,
	getFollowingStatus,
	listFollowing,
	unfollowUnit,
	updateFollowingPresentation,
} from "../../following/service";
import { listStudioContent, recordStudioVisit } from "../../studio/service";
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
		defaultLicense: parseNullablePublicationLicenseId(preference.defaultLicense),
		defaultRealmManageMode: preference.defaultRealmManageMode,
		defaultScoreContextUnitId:
			preference.defaultScoreContextUnitId ?? OfficialRealmUnitIds.score,
		collectionConfig: parseCollectionConfig(preference.collectionConfig),
		personalizedFeed: preference.personalizedFeed,
		filterFeedByPreferredLanguages: preference.filterFeedByPreferredLanguages,
		contentRatings: preference.contentRatings,
		preferredLanguages: preference.preferredLanguages,
	};
}

export default new Elysia({ prefix: "/users" })
	.use(session)
	.get(
		"/me",
		async ({ authorization, profile, query, user }) => {
			const platformCapabilities =
				await authorization.platform.decideCapabilities(PlatformCapabilityValues);
			return {
				...(await getProfile(profile.unitId, query.localizationLanguages)),
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
			await authorization.unit.ensureCanUpdate(profile.unitId, [
				["localizations", body.language],
			]);
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
		"/me/preferences",
		async ({ profile, body }) => {
			const [preference] = await database
				.update(profilePreference)
				.set({ interfaceLocale: body.interfaceLocale })
				.where(eq(profilePreference.profileId, profile.unitId))
				.returning();
			if (!preference) throw new PreferencesNotFound();
			return presentPreferences(preference);
		},
		{
			access: "profile:update",
			body: UpdateInterfaceLocaleBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Update current user interface locale", tags: ["Users"] },
		},
	)
	.put(
		"/me/preferences",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [["preferences"]]);
			const defaultScoreContext = await ensureScoreContextParticipation(
				authorization,
				body.defaultScoreContextUnitId,
			);
			return database.transaction(async (tx) => {
				const [preference] = await tx
					.update(profilePreference)
					.set({
						interfaceLocale: body.interfaceLocale,
						defaultLicense: body.defaultLicense,
						defaultRealmManageMode: body.defaultRealmManageMode,
						defaultScoreContextUnitId: defaultScoreContext.contextUnitId,
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
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"ScoreContextUnitUnsupported",
				]),
			},
			detail: { summary: "Replace current user preferences", tags: ["Users"] },
		},
	)
	.get(
		"/me/following",
		async ({ profile, query }) =>
			listFollowing({
				followerProfileId: profile.unitId,
				kind: query.kind,
				localizationLanguages: query.localizationLanguages,
				cursor: query.cursor,
				limit: query.limit ?? 30,
			}),
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
		"/:id",
		async ({ params, query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const [result] = await database
				.select(PublicProfileSelection)
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, profileTable.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(
								profileTable.id,
								localizationLanguages,
							),
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
			const viewer = (await resolveIdentity(request.headers, "unit:read")).profile;
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
