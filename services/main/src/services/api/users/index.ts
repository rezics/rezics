import { StatusCodes } from "http-status-codes";
import { and, eq, or } from "drizzle-orm";
import Elysia from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { isPrimaryUnitLocalization, unitLocalizationImageAssetIds } from "../../units/localization";
import {
	unit,
	profile as profileTable,
	profileBlock,
	unitFollow,
	profilePreference,
	unitLocalization,
} from "../../database/schema";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { BlockResponse, FollowResponse, UserBlockListResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	CurrentProfileResponse,
	PreferencesResponse,
	PublicProfileResponse,
} from "../schema/response";
import {
	ReplacePreferencesBody,
	UpdateProfileBody,
	UserIdParams,
	UserLookupParams,
} from "./schema";
import { getProfile, presentProfile, PublicProfileSelection } from "./service";
import {
	PreferencesNotFound,
	ProfileChanged,
	ProfileNotFound,
	UserFollowBlocked,
	UserNotFound,
	UserSelfBlockForbidden,
	UserSelfFollowForbidden,
} from "./errors";

const ProfileNotFoundResponse = toApiErrorResponse(["ProfileNotFound"]);
const ProfileMutationNotFoundResponse = toApiErrorResponse([
	"ProfileNotFound",
	"ImageAssetNotFound",
]);
const UnitForbiddenResponse = toApiErrorResponse(["UnitProtected"]);
const UserNotFoundResponse = toApiErrorResponse(["UnitNotFound", "UserNotFound"]);

export default new Elysia({ prefix: "/users" })
	.use(session)
	.get(
		"/me",
		async ({ profile, user }) => {
			return {
				...(await getProfile(profile.unitId)),
				email: user.email,
				emailVerified: user.emailVerified,
				onboarding: user.emailVerified ? "complete" : "verify_email",
			};
		},
		{
			access: "profile:read",
			response: {
				[StatusCodes.OK]: CurrentProfileResponse,
				[StatusCodes.NOT_FOUND]: ProfileNotFoundResponse,
			},
			detail: { summary: "Current user profile", tags: ["Users"] },
		},
	)
	.patch(
		"/me",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [["profile"]]);
			await database.transaction(async (tx) => {
				await ensureImageAssetsAttachable(
					tx,
					profile.unitId,
					unitLocalizationImageAssetIds(body),
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
					.update(unitLocalization)
					.set({
						title: body.name,
						summary: body.summary,
						description: body.description,
						...(Object.hasOwn(body, "avatarAssetId")
							? { avatarAssetId: body.avatarAssetId }
							: {}),
						...(Object.hasOwn(body, "bannerAssetId")
							? { bannerAssetId: body.bannerAssetId }
							: {}),
					})
					.where(
						and(
							eq(unitLocalization.unitId, profile.unitId),
							isPrimaryUnitLocalization(unitLocalization.unitId),
						),
					);
				await recordUnitRevision(tx, {
					unitId: profile.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return getProfile(profile.unitId);
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
			return {
				profileId: preference.profileId,
				defaultLicense: preference.defaultLicense,
				defaultRealmManageMode: preference.defaultRealmManageMode,
				collectionConfig: preference.collectionConfig,
				personalizedFeed: preference.personalizedFeed,
				contentRatings: preference.contentRatings,
				preferredLanguages: preference.preferredLanguages,
			};
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
	.put(
		"/me/preferences",
		async ({ profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(profile.unitId, [["preferences"]]);
			await database.transaction(async (tx) => {
				const [preference] = await tx
					.update(profilePreference)
					.set({
						defaultLicense: body.defaultLicense,
						defaultRealmManageMode: body.defaultRealmManageMode,
						collectionConfig: body.collectionConfig,
						personalizedFeed: body.personalizedFeed,
						contentRatings: body.contentRatings,
						preferredLanguages: body.preferredLanguages,
					})
					.where(eq(profilePreference.profileId, profile.unitId))
					.returning({ profileId: profilePreference.profileId });
				if (!preference) throw new PreferencesNotFound();
			});
			return {
				profileId: profile.unitId,
				...body,
			};
		},
		{
			access: "write:profile:update",
			body: ReplacePreferencesBody,
			response: {
				[StatusCodes.OK]: PreferencesResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitProtected"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PreferencesNotFound"]),
			},
			detail: { summary: "Replace current user preferences", tags: ["Users"] },
		},
	)
	.get(
		"/:id",
		async ({ params, request }) => {
			const [result] = await database
				.select(PublicProfileSelection)
				.from(profileTable)
				.innerJoin(unit, eq(unit.id, profileTable.id))
				.leftJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, profileTable.id),
						isPrimaryUnitLocalization(unitLocalization.unitId),
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
			response: {
				[StatusCodes.OK]: PublicProfileResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "Public user profile", tags: ["Users"] },
		},
	)
	.put(
		"/:id/follow",
		async ({ profile, authorization, params }) => {
			if (params.id === profile.unitId) throw new UserSelfFollowForbidden();
			await authorization.unit.ensureCanRead(params.id, () => new UnitNotFound("User"));
			const [target] = await database
				.select({ id: unit.id })
				.from(unit)
				.where(and(eq(unit.id, params.id), eq(unit.kind, "profile")))
				.limit(1);
			if (!target) throw new UserNotFound();
			const [blocked] = await database
				.select({ id: profileBlock.blockedProfileId })
				.from(profileBlock)
				.where(
					or(
						and(
							eq(profileBlock.blockerProfileId, profile.unitId),
							eq(profileBlock.blockedProfileId, params.id),
						),
						and(
							eq(profileBlock.blockerProfileId, params.id),
							eq(profileBlock.blockedProfileId, profile.unitId),
						),
					),
				)
				.limit(1);
			if (blocked) throw new UserFollowBlocked();
			const notificationId = await database.transaction(async (tx) => {
				const [inserted] = await tx
					.insert(unitFollow)
					.values({ followerProfileId: profile.unitId, unitId: params.id })
					.onConflictDoNothing()
					.returning({ id: unitFollow.unitId });
				if (!inserted) return undefined;
				return createNotification(tx, {
					recipientProfileId: params.id,
					actorProfileId: profile.unitId,
					kind: "follow",
					subjectUnitId: profile.unitId,
					dedupeKey: `follow:${profile.unitId}`,
				});
			});
			await deliverNotificationEmail(notificationId);
			return { following: true };
		},
		{
			access: "contribute:interaction:write",
			params: UserIdParams,
			response: {
				[StatusCodes.OK]: FollowResponse,
				[StatusCodes.NOT_FOUND]: UserNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"UserSelfFollowForbidden",
					"UserFollowBlocked",
				]),
			},
			detail: { summary: "Follow user", tags: ["Users"] },
		},
	)
	.delete(
		"/:id/follow",
		async ({ profile, params }) => {
			await database
				.delete(unitFollow)
				.where(
					and(
						eq(unitFollow.followerProfileId, profile.unitId),
						eq(unitFollow.unitId, params.id),
					),
				);
			return { following: false };
		},
		{
			access: "write:interaction:write",
			params: UserIdParams,
			response: { [StatusCodes.OK]: FollowResponse },
			detail: { summary: "Unfollow user", tags: ["Users"] },
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
						isPrimaryUnitLocalization(unitLocalization.unitId),
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
